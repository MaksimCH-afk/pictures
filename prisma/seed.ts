import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Idempotent: only seeds models on a fresh database so container restarts
// don't create duplicates. For a clean re-seed run `docker compose down -v`.
//
// Per-model OpenRouter API keys are read from environment variables (kept in
// .env, never committed) so secrets stay out of source control.
async function main() {
  const count = await prisma.modelAdapter.count();
  if (count > 0) {
    console.log(`[seed] ${count} model(s) already present — skipping.`);
    return;
  }

  const negativeSchema = JSON.stringify([
    {
      key: "negative_prompt",
      label: "Negative prompt",
      type: "text",
      default: "",
      help: "What to avoid (model dependent).",
    },
  ]);

  // The configured image models. `modelId` must match the exact OpenRouter
  // slug — verify/adjust on https://openrouter.ai/models if a model errors.
  // `keyEnv` names the env var holding that model's personal API key.
  const models = [
    {
      name: "FLUX.2 Pro",
      modelId: "black-forest-labs/flux-2-pro",
      color: "#22d3ee",
      keyEnv: "OR_KEY_FLUX2_PRO",
    },
    {
      name: "FLUX.2 Max",
      modelId: "black-forest-labs/flux-2-max",
      color: "#3b82f6",
      keyEnv: "OR_KEY_FLUX2_MAX",
    },
    {
      name: "Seedream 4.5",
      modelId: "bytedance/seedream-4.5",
      color: "#ec4899",
      keyEnv: "OR_KEY_SEEDREAM",
    },
    {
      name: "xAI: Grok Imagine",
      modelId: "x-ai/grok-imagine",
      color: "#f59e0b",
      keyEnv: "OR_KEY_GROK_IMAGINE",
    },
    {
      name: "Recraft V4.1 Pro",
      modelId: "recraft-ai/recraft-v4.1-pro",
      color: "#fb7185",
      keyEnv: "OR_KEY_RECRAFT",
    },
  ];

  let order = 0;
  for (const m of models) {
    const apiKey = process.env[m.keyEnv]?.trim() || null;
    await prisma.modelAdapter.create({
      data: {
        name: m.name,
        provider: "openrouter",
        modelId: m.modelId,
        color: m.color,
        apiKey,
        enabled: true,
        aspectRatio: "1:1",
        paramsSchemaJson: negativeSchema,
        defaultParamsJson: "{}",
        sortOrder: order++,
      },
    });
    console.log(
      `[seed] + ${m.name} (${m.modelId})${apiKey ? " [key set]" : " [no key — set in Settings]"}`,
    );
  }
  console.log(`[seed] inserted ${models.length} models.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
