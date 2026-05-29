import {
  AdapterError,
  GenerateInput,
  GenerateOutput,
  ImageAdapter,
  ParamSpec,
  parseDataUrl,
} from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// OpenRouter exposes image-output models behind an OpenAI-compatible
// chat/completions endpoint. Requesting the "image" modality makes the model
// return generated images in `message.images[]` as data URLs.
export const openRouterAdapter: ImageAdapter = {
  provider: "openrouter",

  defaultParamsSchema(): ParamSpec[] {
    return [
      {
        key: "negative_prompt",
        label: "Negative prompt",
        type: "text",
        default: "",
        help: "Appended as guidance for what to avoid (model dependent).",
      },
    ];
  },

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    if (!input.apiKey) {
      throw new AdapterError(
        "No OpenRouter API key configured (set OPENROUTER_API_KEY or a per-model key in Settings).",
      );
    }

    const userText = buildPrompt(input);

    const body = {
      model: input.modelId,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: userText }],
      ...(typeof input.seed === "number" ? { seed: input.seed } : {}),
    };

    let res: Response;
    try {
      res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_APP_URL || "http://localhost:3000",
          "X-Title": process.env.OPENROUTER_APP_TITLE || "ImageGen Dashboard",
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new AdapterError(
        `Network error reaching OpenRouter: ${(e as Error).message}`,
      );
    }

    const text = await res.text();
    if (!res.ok) {
      throw new AdapterError(
        `OpenRouter ${res.status}: ${extractError(text) ?? text.slice(0, 300)}`,
      );
    }

    let json: OpenRouterResponse;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AdapterError("OpenRouter returned a non-JSON response.");
    }

    const image = extractImage(json);
    if (!image) {
      const finish = json.choices?.[0]?.message?.content;
      throw new AdapterError(
        "Model returned no image. " +
          (typeof finish === "string" && finish
            ? `Model said: "${finish.slice(0, 200)}"`
            : "This model id may not be an image-output model."),
      );
    }

    return { imageBase64: image.base64, mime: image.mime, seed: input.seed };
  },
};

function buildPrompt(input: GenerateInput): string {
  let prompt = input.prompt;
  const negative = input.params?.negative_prompt;
  if (typeof negative === "string" && negative.trim()) {
    prompt += `\n\nAvoid: ${negative.trim()}`;
  }
  if (input.aspectRatio && input.aspectRatio !== "1:1") {
    prompt += `\n\nAspect ratio: ${input.aspectRatio}.`;
  }
  return prompt;
}

interface OpenRouterResponse {
  choices?: {
    message?: {
      content?: string;
      images?: { type?: string; image_url?: { url?: string } }[];
    };
  }[];
  error?: { message?: string };
}

function extractImage(
  json: OpenRouterResponse,
): { mime: string; base64: string } | null {
  const images = json.choices?.[0]?.message?.images;
  if (!images?.length) return null;
  for (const img of images) {
    const url = img?.image_url?.url;
    if (url) {
      const parsed = parseDataUrl(url);
      if (parsed) return parsed;
    }
  }
  return null;
}

function extractError(text: string): string | null {
  try {
    const j = JSON.parse(text) as OpenRouterResponse;
    return j.error?.message ?? null;
  } catch {
    return null;
  }
}
