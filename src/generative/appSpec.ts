/**
 * appSpec — the declarative shape a generated app is described in.
 *
 * Deliberately NOT executable code: "safe execution sandbox for generated
 * code" was the open gap on this idea, and a browser has no real sandbox to
 * offer. Sidestepping that requirement entirely — the generator never emits
 * code, only data a fixed, hand-written renderer (GeneratedAppRunner)
 * interprets — is the actual solution, not a workaround pending a sandbox
 * that was never going to ship safely.
 */

export interface CounterConfig {
  label: string;
  step: number;
  initial: number;
}

export interface ChecklistConfig {
  title: string;
  items: string[];
}

export interface TimerConfig {
  label: string;
  durationSeconds: number;
}

export interface FlashcardsConfig {
  title: string;
  cards: { front: string; back: string }[];
}

export interface NotesConfig {
  title: string;
  initialContent: string;
}

export type GeneratedAppSpec =
  | { v: 1; id: string; name: string; kind: 'counter'; config: CounterConfig }
  | { v: 1; id: string; name: string; kind: 'checklist'; config: ChecklistConfig }
  | { v: 1; id: string; name: string; kind: 'timer'; config: TimerConfig }
  | { v: 1; id: string; name: string; kind: 'flashcards'; config: FlashcardsConfig }
  | { v: 1; id: string; name: string; kind: 'notes'; config: NotesConfig };

export type GeneratedAppKind = GeneratedAppSpec['kind'];
