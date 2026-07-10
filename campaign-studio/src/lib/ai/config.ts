import type { Aspect } from "@/lib/options";

/**
 * Single tuning surface for every OpenAI call in the app.
 *
 * Model IDs verified against https://developers.openai.com/api/docs/models
 * (gpt-5.5 = latest text/reasoning model, gpt-image-2 = latest image model).
 *
 * What to adjust here later:
 * - text.model        swap to a snapshot (e.g. "gpt-5.5-2026-04-23") to pin
 *                     behavior, or "gpt-5.4-mini" to cut cost while testing.
 * - text.reasoningEffort  "none" | "low" | "medium" | "high" — raise it only
 *                     if evals show the concept quality actually improves.
 * - text.verbosity    "low" | "medium" | "high" — output length, not quality.
 * - image.toolModel   "gpt-image-2" (best) | "gpt-image-1.5" | "gpt-image-1-mini"
 *                     (cheapest). All require org verification.
 * - image.quality     "low" | "medium" | "high" | "auto" — cost/latency lever.
 * - image.outputFormat / outputCompression — payload size lever.
 * - image.sizes       per-aspect pixel sizes. gpt-image-2 accepts arbitrary
 *                     WIDTHxHEIGHT (divisible by 16, ratio 1:3–3:1).
 *
 * This file is pure data — safe to import anywhere. The OpenAI client itself
 * lives in ./client.ts and is server-only.
 */
export const aiConfig = {
  text: {
    model: "gpt-5.5",
    reasoningEffort: "low",
    verbosity: "medium",
  },
  image: {
    /** GPT Image model used by the Responses API image_generation tool. */
    toolModel: "gpt-image-2",
    quality: "medium",
    outputFormat: "webp",
    outputCompression: 85,
    sizes: {
      square: "1024x1024",
      landscape: "1536x1024",
      portrait: "1024x1536",
    } satisfies Record<Aspect, string>,
  },
  /** Hard cap on image prompts rendered per job (cost guard). */
  maxImagePrompts: 3,
} as const;

export const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpeg: "image/jpeg",
};
