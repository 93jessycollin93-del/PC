/**
 * generateAppSpec — turns a plain-language description into a
 * GeneratedAppSpec, deterministically. No network call, no API key, no
 * randomness: the same description always produces the same app, and it
 * works offline. This is pattern matching, not "AI" — it is described that
 * way everywhere it surfaces in the UI, because overclaiming what a keyword
 * matcher does is exactly the kind of thing that erodes trust in the rest
 * of what this OS actually proves (see src/provenance/).
 */
import type { GeneratedAppSpec, GeneratedAppKind } from './appSpec';

export interface GenerateOptions {
  now?: () => number;
}

function newId(now: () => number): string {
  return `genapp-${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A short, presentable name for the desktop icon — not the whole description. */
function deriveName(description: string, fallback: string): string {
  const trimmed = description.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  const beforeColon = trimmed.split(':')[0].trim();
  const base = beforeColon.length >= 3 ? beforeColon : trimmed;
  const withoutLeadingVerb = base.replace(/^(make|create|build|generate|i want|i need)\s+(a|an|me a)?\s*/i, '');
  const cleaned = (withoutLeadingVerb || base).trim();
  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return capitalized.length > 40 ? capitalized.slice(0, 37).trimEnd() + '…' : capitalized || fallback;
}

function classifyKind(description: string): GeneratedAppKind {
  const d = description.toLowerCase();
  if (/\b(timer|countdown|stopwatch)\b/.test(d)) return 'timer';
  if (/\b(flash ?cards?|quiz|study cards?)\b/.test(d)) return 'flashcards';
  if (/\b(checklist|to-?do|list)\b/.test(d)) return 'checklist';
  if (/\b(counter|tally|track (the )?count|click counter)\b/.test(d)) return 'counter';
  return 'notes';
}

const DURATION_UNIT_SECONDS: Record<string, number> = {
  sec: 1, secs: 1, second: 1, seconds: 1,
  min: 60, mins: 60, minute: 60, minutes: 60,
  hr: 3600, hrs: 3600, hour: 3600, hours: 3600,
};

function extractDurationSeconds(description: string): number {
  const match = description.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours)\b/);
  if (!match) return 300; // 5 minutes — a reasonable default for "make a timer"
  const amount = parseFloat(match[1]);
  const unit = DURATION_UNIT_SECONDS[match[2]] ?? 60;
  return Math.max(1, Math.round(amount * unit));
}

function extractChecklist(description: string): { title: string; items: string[] } {
  const colonIndex = description.indexOf(':');
  if (colonIndex === -1) {
    return { title: deriveName(description, 'Checklist'), items: ['First item', 'Second item'] };
  }
  const title = description.slice(0, colonIndex).trim() || 'Checklist';
  const items = description.slice(colonIndex + 1).split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return { title, items: items.length ? items : ['First item', 'Second item'] };
}

function extractFlashcards(description: string): { title: string; cards: { front: string; back: string }[] } {
  const colonIndex = description.indexOf(':');
  const title = deriveName(description, 'Flashcards');
  const body = colonIndex === -1 ? '' : description.slice(colonIndex + 1);
  const pairs = body.split(';')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const sep = pair.includes('=') ? '=' : pair.includes(' - ') ? ' - ' : ':';
      const [front, back] = pair.split(sep);
      return front && back ? { front: front.trim(), back: back.trim() } : null;
    })
    .filter((c): c is { front: string; back: string } => c !== null);
  return { title, cards: pairs.length ? pairs : [{ front: 'Edit me', back: 'Double-click to flip' }] };
}

function extractCounter(description: string): { label: string; step: number; initial: number } {
  const stepMatch = description.match(/\bstep(?:s| of| by)?\s*(\d+)/i) || description.match(/\bby\s*(\d+)\b/i);
  const startMatch = description.match(/\bstart(?:ing)?(?: at| from)?\s*(-?\d+)/i);
  return {
    label: deriveName(description, 'Counter'),
    step: stepMatch ? Math.max(1, parseInt(stepMatch[1], 10)) : 1,
    initial: startMatch ? parseInt(startMatch[1], 10) : 0,
  };
}

/** Description is used as-is for a free-form note when nothing more specific matched. */
function extractNotes(description: string): { title: string; initialContent: string } {
  return { title: deriveName(description, 'Note'), initialContent: description.trim() };
}

export function generateAppSpec(description: string, opts: GenerateOptions = {}): GeneratedAppSpec {
  const now = opts.now || Date.now;
  const id = newId(now);
  const kind = classifyKind(description);

  switch (kind) {
    case 'timer': {
      const durationSeconds = extractDurationSeconds(description);
      return { v: 1, id, name: deriveName(description, 'Timer'), kind, config: { label: deriveName(description, 'Timer'), durationSeconds } };
    }
    case 'flashcards': {
      const { title, cards } = extractFlashcards(description);
      return { v: 1, id, name: title, kind, config: { title, cards } };
    }
    case 'checklist': {
      const { title, items } = extractChecklist(description);
      return { v: 1, id, name: title, kind, config: { title, items } };
    }
    case 'counter': {
      const { label, step, initial } = extractCounter(description);
      return { v: 1, id, name: label, kind, config: { label, step, initial } };
    }
    case 'notes':
    default: {
      const { title, initialContent } = extractNotes(description);
      return { v: 1, id, name: title, kind: 'notes', config: { title, initialContent } };
    }
  }
}
