import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Idempotent: only seeds example models on a fresh database so container
// restarts don't create duplicates.
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

  // Example OpenRouter image-output models. Edit / add / remove these freely in
  // Settings — model ids must match a real OpenRouter image-capable model.
  const examples = [
    {
      name: "Gemini Flash Image",
      modelId: "google/gemini-2.5-flash-image-preview",
      color: "#22d3ee",
    },
    {
      name: "Gemini 2.0 Flash (exp, free)",
      modelId: "google/gemini-2.0-flash-exp:free",
      color: "#f59e0b",
    },
  ];

  let order = 0;
  for (const m of examples) {
    await prisma.modelAdapter.create({
      data: {
        name: m.name,
        provider: "openrouter",
        modelId: m.modelId,
        color: m.color,
        enabled: true,
        aspectRatio: "1:1",
        paramsSchemaJson: negativeSchema,
        defaultParamsJson: "{}",
        sortOrder: order++,
      },
    });
  }
  console.log(`[seed] inserted ${examples.length} example models.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
