/**
 * Jackie Brains — swappable model/agent toolset for Jackie.
 *
 * Jackie is always Jackie. A "brain" only changes which underlying AI does the
 * raw thinking underneath her persona. Brains are ordered free-first with a
 * fallback chain to paid tiers, so Jackie preserves credits by default and only
 * escalates to premium reasoning when asked or when the free tiers fail.
 */

export type BrainTier = 'free' | 'paid';

export interface JackieBrain {
  /** Stable id used for selection + persistence */
  id: string;
  /** Display name shown in the brain selector */
  label: string;
  /** Provider family (groq, gemini, grok, openai, ollama, anthropic, ...) */
  provider: string;
  /** free tiers are tried first; paid are the fallback / premium option */
  tier: BrainTier;
  /** One-line description of what this brain is good at */
  blurb: string;
  /** Ordered ids to fall back to if this brain is unavailable */
  fallbackChain: string[];
  /** Runs fully on-device (no network, works offline) */
  local?: boolean;
}

/**
 * The brain registry. Free brains are listed first and form Jackie's default
 * waterfall; paid brains sit at the end as premium fallbacks (PDI = premium
 * deep intelligence).
 */
export const JACKIE_BRAINS: JackieBrain[] = [
  {
    id: 'groq-llama',
    label: 'Groq · Llama 3',
    provider: 'groq',
    tier: 'free',
    blurb: 'Fastest free reasoning. Jackie’s default day-to-day brain.',
    fallbackChain: ['gemini-free', 'grok-free', 'openai-free', 'ollama-local'],
  },
  {
    id: 'gemini-free',
    label: 'Gemini Flash (free)',
    provider: 'gemini',
    tier: 'free',
    blurb: 'Balanced free multimodal reasoning with a large context window.',
    fallbackChain: ['groq-llama', 'grok-free', 'openai-free', 'ollama-local'],
  },
  {
    id: 'grok-free',
    label: 'Grok (free)',
    provider: 'grok',
    tier: 'free',
    blurb: 'Free xAI Grok tier. Good for candid, current-events reasoning.',
    fallbackChain: ['groq-llama', 'gemini-free', 'openai-free'],
  },
  {
    id: 'openai-free',
    label: 'OpenAI (free tier)',
    provider: 'openai',
    tier: 'free',
    blurb: 'Free OpenAI tier for general-purpose thinking.',
    fallbackChain: ['groq-llama', 'gemini-free', 'grok-free'],
  },
  {
    id: 'ollama-local',
    label: 'Local (Ollama)',
    provider: 'ollama',
    tier: 'free',
    local: true,
    blurb: 'Runs on your machine. Zero cost, fully offline, private.',
    fallbackChain: ['groq-llama', 'gemini-free'],
  },
  {
    id: 'claude-pdi',
    label: 'Claude · PDI (premium)',
    provider: 'anthropic',
    tier: 'paid',
    blurb: 'Premium Deep Intelligence. Top-of-the-line reasoning, used sparingly.',
    fallbackChain: ['gemini-free', 'groq-llama'],
  },
  {
    id: 'gpt-premium',
    label: 'GPT (premium)',
    provider: 'openai',
    tier: 'paid',
    blurb: 'Premium OpenAI reasoning as a paid fallback.',
    fallbackChain: ['claude-pdi', 'gemini-free', 'groq-llama'],
  },
];

/**
 * Personalities are lenses over Jackie's single identity. Switching a
 * personality never changes *who* Jackie is — it only shifts her tone and how
 * she frames answers. The persona ("Jackie") is constant.
 */
export interface JackiePersonality {
  id: string;
  label: string;
  /** Short description of the mindset this lens applies */
  vibe: string;
  /** Prompt fragment appended to Jackie's system instruction */
  systemModifier: string;
}

export const JACKIE_PERSONALITIES: JackiePersonality[] = [
  {
    id: 'default',
    label: 'Jackie (core)',
    vibe: 'Warm, sharp, protective. Her true self.',
    systemModifier:
      'Speak as Jackie: warm, direct, quietly brilliant, always on the user’s side.',
  },
  {
    id: 'strategist',
    label: 'Strategist',
    vibe: 'Cool, systems-level, thinks in trade-offs.',
    systemModifier:
      'Stay Jackie, but lead with structure: surface trade-offs, name assumptions, plan in steps.',
  },
  {
    id: 'guardian',
    label: 'Guardian',
    vibe: 'Security-first, skeptical of risk.',
    systemModifier:
      'Stay Jackie, but weigh every action for security and safety first; flag risk before convenience.',
  },
  {
    id: 'builder',
    label: 'Builder',
    vibe: 'Hands-on, ships code, minimal ceremony.',
    systemModifier:
      'Stay Jackie, but be maximally practical: prefer working code and concrete next steps over theory.',
  },
  {
    id: 'muse',
    label: 'Muse',
    vibe: 'Expansive, lateral, idea-generative.',
    systemModifier:
      'Stay Jackie, but think laterally: offer unexpected connections and generative options.',
  },
];

const BRAIN_KEY = 'jackie_active_brain';
const PERSONALITY_KEY = 'jackie_active_personality';
const PREFER_FREE_KEY = 'jackie_prefer_free';

export function getBrain(id: string): JackieBrain | undefined {
  return JACKIE_BRAINS.find((b) => b.id === id);
}

export function getActiveBrainId(): string {
  if (typeof localStorage === 'undefined') return 'groq-llama';
  return localStorage.getItem(BRAIN_KEY) || 'groq-llama';
}

export function setActiveBrainId(id: string): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(BRAIN_KEY, id);
}

export function getActivePersonalityId(): string {
  if (typeof localStorage === 'undefined') return 'default';
  return localStorage.getItem(PERSONALITY_KEY) || 'default';
}

export function setActivePersonalityId(id: string): void {
  if (typeof localStorage !== 'undefined')
    localStorage.setItem(PERSONALITY_KEY, id);
}

/** When true (default) Jackie always tries free brains before any paid one. */
export function prefersFree(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(PREFER_FREE_KEY) !== 'false';
}

export function setPrefersFree(value: boolean): void {
  if (typeof localStorage !== 'undefined')
    localStorage.setItem(PREFER_FREE_KEY, value ? 'true' : 'false');
}

/**
 * Resolve the ordered list of brains Jackie should attempt for a request,
 * honouring the free-first preference. This is the waterfall the runtime walks:
 * try each in order until one responds.
 */
export function resolveBrainWaterfall(startId = getActiveBrainId()): JackieBrain[] {
  const start = getBrain(startId) || JACKIE_BRAINS[0];
  const ordered: JackieBrain[] = [start];
  for (const fid of start.fallbackChain) {
    const b = getBrain(fid);
    if (b && !ordered.includes(b)) ordered.push(b);
  }
  // Ensure every brain is reachable as a last resort.
  for (const b of JACKIE_BRAINS) if (!ordered.includes(b)) ordered.push(b);

  if (prefersFree()) {
    return [
      ...ordered.filter((b) => b.tier === 'free'),
      ...ordered.filter((b) => b.tier === 'paid'),
    ];
  }
  return ordered;
}
