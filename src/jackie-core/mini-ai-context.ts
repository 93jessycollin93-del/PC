/**
 * Mini-AI Context — a tiny (<1MB) per-app intent interpreter.
 *
 * Every page/app in the PC gets one of these. Its only job is cheap, local,
 * near-instant understanding of "what does the user mean *inside this app*"
 * so Jackie (and the app itself) can act without spending a full model call.
 *
 * It is intentionally small and heuristic-first: a compact keyword/regex layer
 * resolves the common cases on-device for free, and only escalates to a real
 * model (through the provided `escalate` hook) when it isn't confident. That
 * keeps the per-page footprint well under a megabyte while still feeling smart.
 */

export interface AppIntentSpec {
  /** Intent id, e.g. "search", "delete", "summarize" */
  id: string;
  /** Human label for the intent */
  label: string;
  /** Trigger phrases / keywords (matched case-insensitively) */
  triggers: string[];
  /** Optional regex triggers for structured input */
  patterns?: RegExp[];
}

export interface MiniAiResult {
  intentId: string | null;
  label: string | null;
  /** 0..1 heuristic confidence */
  confidence: number;
  /** Whether the caller should escalate to a full model */
  needsEscalation: boolean;
  /** Slots pulled out of the input (e.g. a matched query) */
  slots: Record<string, string>;
}

export interface MiniAiConfig {
  /** The app this brain serves, e.g. "flipper", "mail" */
  appId: string;
  /** Short description of the app's job — used when escalating */
  appPurpose: string;
  /** The intents this app understands */
  intents: AppIntentSpec[];
  /** Confidence below this triggers escalation (default 0.45) */
  escalateBelow?: number;
}

/**
 * A per-app interpreter. Construct one per app; it holds no heavy state, so its
 * memory cost is a handful of small arrays — comfortably sub-1MB.
 */
export class MiniAiContext {
  private cfg: MiniAiConfig;
  private threshold: number;

  constructor(cfg: MiniAiConfig) {
    this.cfg = cfg;
    this.threshold = cfg.escalateBelow ?? 0.45;
  }

  get appId(): string {
    return this.cfg.appId;
  }

  /**
   * Interpret raw user input against this app's known intents. Pure, local,
   * instant. Never throws — worst case it returns needsEscalation=true.
   */
  interpret(input: string): MiniAiResult {
    const text = (input || '').toLowerCase().trim();
    if (!text) {
      return {
        intentId: null,
        label: null,
        confidence: 0,
        needsEscalation: false,
        slots: {},
      };
    }

    let best: { spec: AppIntentSpec; score: number; slots: Record<string, string> } | null =
      null;

    for (const spec of this.cfg.intents) {
      let score = 0;
      const slots: Record<string, string> = {};

      for (const trigger of spec.triggers) {
        const t = trigger.toLowerCase();
        if (text === t) score = Math.max(score, 1);
        else if (text.includes(t)) score = Math.max(score, 0.7);
      }

      if (spec.patterns) {
        for (const rx of spec.patterns) {
          const m = text.match(rx);
          if (m) {
            score = Math.max(score, 0.85);
            if (m[1]) slots.value = m[1].trim();
          }
        }
      }

      if (score > 0 && (!best || score > best.score)) {
        best = { spec, score, slots };
      }
    }

    if (!best) {
      return {
        intentId: null,
        label: null,
        confidence: 0,
        needsEscalation: true,
        slots: {},
      };
    }

    return {
      intentId: best.spec.id,
      label: best.spec.label,
      confidence: best.score,
      needsEscalation: best.score < this.threshold,
      slots: best.slots,
    };
  }

  /**
   * Build a compact escalation prompt for when the heuristic isn't confident.
   * Kept short on purpose so escalations stay cheap.
   */
  escalationPrompt(input: string): string {
    const intentList = this.cfg.intents.map((i) => i.id).join(', ');
    return [
      `App: ${this.cfg.appId} — ${this.cfg.appPurpose}`,
      `Known intents: ${intentList}`,
      `User said: "${input}"`,
      `Reply with the single best matching intent id, or "none".`,
    ].join('\n');
  }
}

/**
 * Convenience factory so apps can register a mini-AI in one line.
 */
export function createMiniAi(cfg: MiniAiConfig): MiniAiContext {
  return new MiniAiContext(cfg);
}
