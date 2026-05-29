import { prisma } from "./db";
import { getAdapter } from "./adapters/registry";
import { saveImage } from "./images";
import { resolveApiKey } from "./settings";
import { fireWebhook } from "./webhook";
import { invalidateTags, CacheTags } from "./cache";

export interface SessionConfig {
  seedSync: boolean;
  batchSize: number;
  presetId?: string | null;
  blindMode: boolean;
  seed?: number; // base seed
}

export function parseConfig(json: string): SessionConfig {
  const def: SessionConfig = {
    seedSync: true,
    batchSize: 1,
    blindMode: false,
  };
  try {
    return { ...def, ...JSON.parse(json) };
  } catch {
    return def;
  }
}

const CONCURRENCY = 4;
const randomSeed = () => Math.floor(Math.random() * 2_147_483_647);

// Process all pending results for a session. Designed to be invoked without
// awaiting (background). Each result is updated independently so the UI can
// show cards appearing as models finish.
export async function runSession(sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return;

  const results = await prisma.result.findMany({
    where: { sessionId, status: "pending" },
    include: { model: true },
    orderBy: { createdAt: "asc" },
  });

  let index = 0;
  async function worker() {
    while (index < results.length) {
      const r = results[index++];
      await processResult(r);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, results.length) }, worker),
  );

  // Finalize session.
  const counts = await prisma.result.groupBy({
    by: ["status"],
    where: { sessionId },
    _count: true,
  });
  const errored = counts.find((c) => c.status === "error")?._count ?? 0;
  const done = counts.find((c) => c.status === "done")?._count ?? 0;
  const status = done === 0 && errored > 0 ? "error" : "done";

  await prisma.session.update({
    where: { id: sessionId },
    data: { status, completedAt: new Date() },
  });
  invalidateTags(CacheTags.analytics);

  if (session.webhookUrl) {
    await fireWebhook(session.webhookUrl, {
      event: "session.completed",
      sessionId,
      status,
      results: { done, errored, total: results.length },
      completedAt: new Date().toISOString(),
    });
    await prisma.session.update({
      where: { id: sessionId },
      data: { webhookFiredAt: new Date() },
    });
  }
}

type ResultWithModel = Awaited<
  ReturnType<typeof prisma.result.findMany>
>[number] & { model: { provider: string; modelId: string; apiKey: string | null } };

async function processResult(r: ResultWithModel) {
  const startedAt = Date.now();
  await prisma.result.update({
    where: { id: r.id },
    data: { status: "running" },
  });

  try {
    const adapter = getAdapter(r.model.provider);
    const apiKey = await resolveApiKey(r.model.apiKey);
    const params = safeParse(r.paramsJson, {} as Record<string, unknown>);

    const out = await adapter.generate({
      prompt: await promptForResult(r),
      seed: r.seed ?? undefined,
      params,
      modelId: r.model.modelId,
      apiKey,
      aspectRatio: "1:1",
    });

    const imagePath = await saveImage(r.sessionId, r.id, out.imageBase64, out.mime);
    await prisma.result.update({
      where: { id: r.id },
      data: {
        status: "done",
        imagePath,
        latencyMs: Date.now() - startedAt,
        seed: out.seed ?? r.seed ?? undefined,
      },
    });
  } catch (e) {
    await prisma.result.update({
      where: { id: r.id },
      data: {
        status: "error",
        error: (e as Error).message?.slice(0, 500) ?? "Unknown error",
        latencyMs: Date.now() - startedAt,
      },
    });
  }
}

async function promptForResult(r: { sessionId: string; promptIndex: number }) {
  const s = await prisma.session.findUnique({ where: { id: r.sessionId } });
  const prompts = safeParse<string[]>(s?.promptsJson ?? "[]", []);
  return prompts[r.promptIndex] ?? prompts[0] ?? "";
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// Compute the seed for a (model, promptIndex, batchIndex) cell.
export function seedFor(
  config: SessionConfig,
  batchIndex: number,
): number {
  const base = typeof config.seed === "number" ? config.seed : randomSeed();
  if (config.seedSync) return base + batchIndex;
  return randomSeed();
}
