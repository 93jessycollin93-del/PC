/**
 * Shared, client-safe constants. No secrets, no server imports.
 * Used by both the form UI and the server-side request validation.
 */

export const TONES = [
  "Bold",
  "Warm",
  "Premium",
  "Playful",
  "Direct",
  "Witty",
] as const;

export type Tone = (typeof TONES)[number];

export const CHANNELS = [
  "Email",
  "Organic social",
  "Paid social",
  "Search",
  "Display",
  "In-store",
  "Events",
  "Influencer",
] as const;

export type Channel = (typeof CHANNELS)[number];

/** Proof-bar chip colors — one hue per channel, used as data, not decoration. */
export const CHANNEL_COLORS: Record<Channel, string> = {
  Email: "#2743D6",
  "Organic social": "#1F7A4D",
  "Paid social": "#C0392B",
  Search: "#B07C10",
  Display: "#7A3FA0",
  "In-store": "#B85C1E",
  Events: "#1B7B8C",
  Influencer: "#A82E63",
};

export const ASPECTS = ["square", "landscape", "portrait"] as const;
export type Aspect = (typeof ASPECTS)[number];
