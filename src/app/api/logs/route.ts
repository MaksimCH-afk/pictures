import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  PROJECT_LOG,
  listLogFiles,
  logSize,
  modelLogName,
} from "@/lib/logger";

export const dynamic = "force-dynamic";

// Lists available log files: the global project log + one per model that has
// logged anything, annotated with the model name and current size.
export async function GET() {
  const files = new Set(listLogFiles());

  const models = await prisma.modelAdapter.findMany({
    select: { id: true, name: true },
  });
  const nameById = new Map(models.map((m) => [m.id, m.name]));

  const modelLogs = [...files]
    .filter((f) => f.startsWith("model-"))
    .map((f) => {
      const id = f.replace(/^model-/, "").replace(/\.log$/, "");
      return {
        file: f,
        modelId: id,
        modelName: nameById.get(id) ?? id,
        size: logSize(f),
      };
    })
    .sort((a, b) => a.modelName.localeCompare(b.modelName));

  return NextResponse.json({
    project: { file: PROJECT_LOG, size: logSize(PROJECT_LOG) },
    models: modelLogs,
    // helper so the client can build the per-model file name if needed
    modelLogName: modelLogName("ID").replace("ID", "<id>"),
  });
}
