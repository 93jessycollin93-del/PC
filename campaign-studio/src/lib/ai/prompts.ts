import type { BriefRequest } from "@/lib/schemas";

/**
 * Prompt builders, versioned in code (per current OpenAI guidance —
 * reusable prompt objects are deprecated). Adjust wording here; the
 * output *shape* is owned by the JSON schema in lib/schemas.ts, so keep
 * schema descriptions and these instructions consistent.
 */

export const CONCEPT_INSTRUCTIONS = `You are the creative director of a sharp, senior marketing studio. A client hands you a campaign brief; you return one focused campaign concept package.

Success criteria:
- The concept is specific to this brief — swap in a different product and it should stop making sense.
- Exactly three copy variants labeled A, B, C, each taking a genuinely different persuasion angle (e.g. emotional, practical, social proof). Never three rewordings of one idea.
- Copy matches the requested tone and reads like a human wrote it. No "elevate", no "unlock", no "game-changer".
- The launch checklist covers all four phases (Prep, Build, Launch, Measure) with 2-4 concrete, actionable items each, scoped to the requested channels.
- Exactly three image prompts, each a different visual direction (not three crops of one scene). Each prompt must be self-contained: subject, setting, style, lighting, mood. Never include brand logos, rendered text, or real people's likenesses. Choose the aspect that suits the direction.

If the brief is too vague to ground a concept, still produce the package: make reasonable assumptions and state them plainly inside the concept summary.`;

export function buildBriefInput(req: BriefRequest): string {
  return [
    `CAMPAIGN BRIEF: ${req.brief}`,
    `TARGET AUDIENCE: ${req.audience}`,
    `PRODUCT DETAILS: ${req.product}`,
    `TONE: ${req.tone}`,
    `CHANNELS: ${req.channels.join(", ")}`,
  ].join("\n");
}

export function buildImageInput(prompt: string): string {
  return `Generate one marketing campaign image. Follow this art direction exactly, and do not add any text, lettering, watermarks, or logos to the image:\n\n${prompt}`;
}
