import { NextRequest, NextResponse } from "next/server";

import { aiConfig, IMAGE_MIME } from "@/lib/ai/config";
import { getOpenAI, hasApiKey, isMockMode } from "@/lib/ai/client";
import { errorResponse, openAIErrorResponse } from "@/lib/ai/errors";
import { delay, mockImage } from "@/lib/ai/mock";
import { buildImageInput } from "@/lib/ai/prompts";
import { imageRequestSchema } from "@/lib/schemas";
import type { ImageResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/image
 * One image prompt in → one rendered campaign image out (base64).
 *
 * Uses the OpenAI Responses API with the hosted `image_generation` tool
 * (backed by gpt-image-2 — see lib/ai/config.ts). `tool_choice` forces the
 * tool so every request produces an image. The client fans out one request
 * per prompt so each image loads, fails, and retries independently.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "invalid_json", "The request body is not valid JSON.");
  }

  const parsed = imageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "invalid_prompt", "The image prompt is invalid.");
  }
  const { prompt, aspect } = parsed.data;

  if (isMockMode()) {
    await delay(1800 + Math.random() * 1700);
    const mock = mockImage(aspect, prompt.length);
    const payload: ImageResponse = { ...mock, revisedPrompt: null };
    return NextResponse.json(payload);
  }

  if (!hasApiKey()) {
    return errorResponse(
      500,
      "missing_api_key",
      "OPENAI_API_KEY is not set on the server. Add it to .env.local (see README) or run with MOCK_AI=1."
    );
  }

  try {
    const response = await getOpenAI().responses.create({
      model: aiConfig.text.model,
      reasoning: { effort: "low" },
      input: buildImageInput(prompt),
      tools: [
        {
          type: "image_generation",
          model: aiConfig.image.toolModel,
          size: aiConfig.image.sizes[aspect],
          quality: aiConfig.image.quality,
          output_format: aiConfig.image.outputFormat,
          output_compression: aiConfig.image.outputCompression,
        },
      ],
      tool_choice: { type: "image_generation" },
    });

    const call = response.output.find(
      (item) => item.type === "image_generation_call"
    );
    if (!call || !call.result) {
      return errorResponse(
        502,
        "no_image",
        "The model finished without returning an image. Try again."
      );
    }

    // `revised_prompt` is documented on image_generation_call output items
    // but not yet present in the SDK's TypeScript types — read defensively.
    const revised = (call as unknown as { revised_prompt?: string })
      .revised_prompt;

    const payload: ImageResponse = {
      b64: call.result,
      mimeType: IMAGE_MIME[aiConfig.image.outputFormat] ?? "image/png",
      revisedPrompt: revised ?? null,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return openAIErrorResponse(err);
  }
}
