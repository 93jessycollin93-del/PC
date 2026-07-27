import { NextRequest, NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";

import { aiConfig } from "@/lib/ai/config";
import { getOpenAI, hasApiKey, isMockMode } from "@/lib/ai/client";
import { errorResponse, openAIErrorResponse } from "@/lib/ai/errors";
import { delay, mockConceptPackage } from "@/lib/ai/mock";
import { buildBriefInput, CONCEPT_INSTRUCTIONS } from "@/lib/ai/prompts";
import { briefRequestSchema, conceptPackageSchema } from "@/lib/schemas";
import type { GenerateResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/generate
 * Brief in → structured campaign concept package out.
 *
 * Uses the OpenAI Responses API with Structured Outputs: the JSON schema in
 * lib/schemas.ts is sent as a strict `text.format`, so the model's reply is
 * guaranteed to match `ConceptPackage`.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "invalid_json", "The request body is not valid JSON.");
  }

  const parsed = briefRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return errorResponse(
      400,
      "invalid_brief",
      first?.message ?? "The brief is incomplete."
    );
  }

  if (isMockMode()) {
    await delay(1600);
    const payload: GenerateResponse = {
      jobId: `mock_${Date.now().toString(36)}`,
      package: mockConceptPackage(parsed.data),
    };
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
    const response = await getOpenAI().responses.parse({
      model: aiConfig.text.model,
      reasoning: { effort: aiConfig.text.reasoningEffort },
      instructions: CONCEPT_INSTRUCTIONS,
      input: buildBriefInput(parsed.data),
      text: {
        format: zodTextFormat(conceptPackageSchema, "campaign_concept_package"),
        verbosity: aiConfig.text.verbosity,
      },
    });

    const pkg = response.output_parsed;
    if (!pkg) {
      const refusal = response.output
        .filter((item) => item.type === "message")
        .flatMap((item) => item.content)
        .find((part) => part.type === "refusal");
      if (refusal) {
        return errorResponse(
          422,
          "refused",
          `The model declined this brief: ${refusal.refusal}`
        );
      }
      return errorResponse(
        502,
        "empty_output",
        "The model returned no concept package. Try again."
      );
    }

    // Counts are promised by the prompt, not the schema — enforce the cap here.
    const payload: GenerateResponse = {
      jobId: response.id,
      package: {
        ...pkg,
        copyVariants: pkg.copyVariants.slice(0, 3),
        imagePrompts: pkg.imagePrompts.slice(0, aiConfig.maxImagePrompts),
      },
    };
    return NextResponse.json(payload);
  } catch (err) {
    return openAIErrorResponse(err);
  }
}
