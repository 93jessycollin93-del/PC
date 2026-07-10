import "server-only";

import type { Aspect } from "@/lib/options";
import type { BriefRequest, ConceptPackage } from "@/lib/schemas";

/**
 * Mock mode (MOCK_AI=1): canned data + generated SVG placeholders so the
 * full UI flow can be exercised without an API key or spend. Delays are
 * deliberate so loading states stay visible.
 */

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mockConceptPackage(req: BriefRequest): ConceptPackage {
  const channelList = req.channels.join(", ");
  return {
    concept: {
      name: "First Light Standard",
      tagline: "The morning decides the day.",
      summary: `A concept proofed in mock mode from your brief ("${req.brief.slice(0, 60)}…"). It frames the product as the one fixed point in the audience's morning, in a ${req.tone.toLowerCase()} voice, built to run on ${channelList}.`,
      keyMessage:
        "One dependable ritual beats a dozen small decisions before 9am.",
    },
    copyVariants: [
      {
        label: "A",
        angle: "Emotional ritual",
        headline: "Keep one promise to yourself daily.",
        body: "Mornings scatter. This one thing doesn't. Set it once and let the first ten minutes of your day belong to you again.",
        channelFit: req.channels[0] ?? "Email",
      },
      {
        label: "B",
        angle: "Practical proof",
        headline: "Four steps down to one.",
        body: "We counted the fiddly steps in your old routine and removed three. What's left takes ninety seconds and works every single time.",
        channelFit: req.channels[1] ?? req.channels[0] ?? "Paid social",
      },
      {
        label: "C",
        angle: "Social proof",
        headline: "The 6am club already switched.",
        body: "Early risers are loud about what works. Read the reviews, then see why the switch sticks — most people never go back.",
        channelFit: req.channels[req.channels.length - 1] ?? "Organic social",
      },
    ],
    launchChecklist: [
      {
        phase: "Prep",
        items: [
          {
            task: "Lock the key message",
            detail:
              "Get sign-off on the single sentence every asset must carry.",
          },
          {
            task: "Audit landing page",
            detail:
              "Make sure the page headline matches variant copy word-for-word.",
          },
        ],
      },
      {
        phase: "Build",
        items: [
          {
            task: "Produce channel-cut assets",
            detail: `Export sizes and copy lengths for ${channelList}.`,
          },
          {
            task: "Set up UTM scheme",
            detail: "One campaign code, one code per channel, one per variant.",
          },
          {
            task: "QA dark-mode rendering",
            detail: "Check email and social cards in both themes.",
          },
        ],
      },
      {
        phase: "Launch",
        items: [
          {
            task: "Stagger channel go-lives",
            detail: "Owned channels first, paid after organic signal appears.",
          },
          {
            task: "Brief support team",
            detail: "Share the offer terms and expected common questions.",
          },
        ],
      },
      {
        phase: "Measure",
        items: [
          {
            task: "Read variant results at 72h",
            detail: "Compare A/B/C click-through before shifting budget.",
          },
          {
            task: "Hold a one-page retro",
            detail: "What ran, what worked, what the next flight changes.",
          },
        ],
      },
    ],
    imagePrompts: [
      {
        title: "Morning still life",
        prompt:
          "A warm editorial still life on a sunlit kitchen counter at dawn, soft golden side light, shallow depth of field, calm and orderly composition, film photography feel.",
        aspect: "landscape",
      },
      {
        title: "Hands in motion",
        prompt:
          "Close-up of hands mid-ritual over a clean workspace, natural morning light from a window, honest documentary style, muted warm palette.",
        aspect: "square",
      },
      {
        title: "City at first light",
        prompt:
          "A quiet city street at sunrise seen from a window, long soft shadows, a sense of a day about to begin, painterly light, vertical composition.",
        aspect: "portrait",
      },
    ],
  };
}

const MOCK_DIMS: Record<Aspect, { w: number; h: number }> = {
  square: { w: 1024, h: 1024 },
  landscape: { w: 1536, h: 1024 },
  portrait: { w: 1024, h: 1536 },
};

/** Deterministic placeholder artwork: an SVG proof sheet, base64-encoded. */
export function mockImage(aspect: Aspect, seed: number): {
  b64: string;
  mimeType: string;
} {
  const { w, h } = MOCK_DIMS[aspect];
  const hues = [214, 32, 158];
  const hue = hues[seed % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},42%,88%)"/>
      <stop offset="1" stop-color="hsl(${hue},48%,64%)"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w * 0.72}" cy="${h * 0.3}" r="${Math.min(w, h) * 0.18}" fill="hsl(${hue},55%,52%)" opacity="0.55"/>
  <rect x="${w * 0.1}" y="${h * 0.62}" width="${w * 0.5}" height="${h * 0.05}" rx="8" fill="hsl(${hue},35%,30%)" opacity="0.35"/>
  <rect x="${w * 0.1}" y="${h * 0.72}" width="${w * 0.34}" height="${h * 0.05}" rx="8" fill="hsl(${hue},35%,30%)" opacity="0.25"/>
  <text x="${w * 0.1}" y="${h * 0.12}" font-family="monospace" font-size="${Math.round(Math.min(w, h) * 0.035)}" fill="hsl(${hue},35%,25%)">MOCK PROOF ${String(seed + 1).padStart(2, "0")} — ${aspect.toUpperCase()}</text>
</svg>`;
  return {
    b64: Buffer.from(svg).toString("base64"),
    mimeType: "image/svg+xml",
  };
}
