import "server-only";

import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/lib/types";

export function errorResponse(
  status: number,
  code: string,
  message: string
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Map OpenAI SDK failures to stable, user-presentable API errors. */
export function openAIErrorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof OpenAI.APIError) {
    const detail = err.message ?? "";
    switch (err.status) {
      case 401:
        return errorResponse(
          502,
          "invalid_api_key",
          "OpenAI rejected the API key. Check OPENAI_API_KEY in .env.local."
        );
      case 403:
        if (/verif/i.test(detail)) {
          return errorResponse(
            502,
            "org_not_verified",
            "This OpenAI organization is not verified for GPT Image models. Complete API Organization Verification in the OpenAI developer console, then retry."
          );
        }
        return errorResponse(
          502,
          "forbidden",
          `OpenAI refused the request. ${detail}`
        );
      case 429:
        return errorResponse(
          429,
          "rate_limited",
          "OpenAI rate limit or quota reached. Wait a moment and try again."
        );
      case 400:
        return errorResponse(
          502,
          "bad_upstream_request",
          `OpenAI rejected the request. ${detail}`
        );
      default:
        return errorResponse(
          502,
          "openai_error",
          `OpenAI returned an error (${err.status ?? "unknown"}). ${detail}`
        );
    }
  }
  if (err instanceof Error && err.name === "AbortError") {
    return errorResponse(
      504,
      "timeout",
      "The OpenAI request timed out. Try again."
    );
  }
  console.error("Unexpected server error:", err);
  return errorResponse(
    500,
    "internal",
    "Something failed on the server. Try again."
  );
}
