import { z } from "zod";
import { ASPECTS, CHANNELS, TONES } from "@/lib/options";

/* ------------------------------------------------------------------ */
/* Request validation (client input → API routes)                      */
/* ------------------------------------------------------------------ */

export const briefRequestSchema = z.object({
  brief: z
    .string()
    .trim()
    .min(12, "Give the studio at least a sentence to work with.")
    .max(1200, "Keep the brief under 1,200 characters."),
  audience: z
    .string()
    .trim()
    .min(4, "Name the audience — who is this for?")
    .max(400, "Keep the audience under 400 characters."),
  product: z
    .string()
    .trim()
    .min(4, "Describe the product in a few words.")
    .max(600, "Keep the product notes under 600 characters."),
  tone: z.enum(TONES),
  channels: z
    .array(z.enum(CHANNELS))
    .min(1, "Pick at least one channel.")
    .max(CHANNELS.length),
});

export type BriefRequest = z.infer<typeof briefRequestSchema>;

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(8).max(2000),
  aspect: z.enum(ASPECTS),
});

export type ImageRequest = z.infer<typeof imageRequestSchema>;

/* ------------------------------------------------------------------ */
/* Structured output schema (what the model must return)               */
/*                                                                     */
/* Passed to the Responses API as a strict JSON schema via             */
/* `zodTextFormat`. Strict mode requires every field to be present,    */
/* so nothing here is optional. Counts (3 variants, 3 image prompts)   */
/* are enforced in the prompt and re-checked after parsing.            */
/* ------------------------------------------------------------------ */

const conceptSchema = z.object({
  name: z.string().describe("Short, memorable campaign name (2-5 words)."),
  tagline: z.string().describe("One-line tagline under 12 words."),
  summary: z
    .string()
    .describe("2-3 sentence summary of the creative idea and why it fits."),
  keyMessage: z
    .string()
    .describe("The single message every asset must communicate."),
});

const copyVariantSchema = z.object({
  label: z.enum(["A", "B", "C"]),
  angle: z
    .string()
    .describe("The persuasion angle in 2-4 words, e.g. 'social proof'."),
  headline: z.string().describe("Headline under 10 words."),
  body: z.string().describe("Body copy, 2-3 sentences, in the requested tone."),
  channelFit: z
    .string()
    .describe("Which of the requested channels this variant suits best."),
});

const checklistItemSchema = z.object({
  task: z.string().describe("Imperative task, under 10 words."),
  detail: z.string().describe("One sentence of practical guidance."),
});

const checklistPhaseSchema = z.object({
  phase: z.enum(["Prep", "Build", "Launch", "Measure"]),
  items: z.array(checklistItemSchema).describe("2-4 items per phase."),
});

const imagePromptSchema = z.object({
  title: z.string().describe("Short label for this visual direction."),
  prompt: z
    .string()
    .describe(
      "Complete image-generation prompt: subject, setting, style, lighting, mood. No brand logos, no text overlays, no real people."
    ),
  aspect: z.enum(ASPECTS),
});

export const conceptPackageSchema = z.object({
  concept: conceptSchema,
  copyVariants: z
    .array(copyVariantSchema)
    .describe("Exactly three variants labeled A, B, C."),
  launchChecklist: z
    .array(checklistPhaseSchema)
    .describe("All four phases in order: Prep, Build, Launch, Measure."),
  imagePrompts: z
    .array(imagePromptSchema)
    .describe("Exactly three distinct visual directions."),
});

export type ConceptPackage = z.infer<typeof conceptPackageSchema>;
export type CopyVariant = z.infer<typeof copyVariantSchema>;
export type ChecklistPhase = z.infer<typeof checklistPhaseSchema>;
export type ImagePrompt = z.infer<typeof imagePromptSchema>;
