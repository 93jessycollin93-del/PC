---
name: Sticky notepad widget
description: The global floating notepad — where it lives, how voice capture and archiving work.
---

A single `StickyNotepadWidget` is mounted once at the top level of `App.tsx` (not per-window), so it floats above every app/window and persists across navigation. States: minimized (small tab) / compact (default card, drag-resizable) / fullscreen.

Content autosaves via the same `lib/storage.ts` file mechanism NotepadApp uses (own file id), independent of any single app window.

**Voice notes:** uses the real browser Speech Recognition API (no wake-word engine). Saying "take note ..." / "note that ..." / "jot down ..." appends the trailing speech as a timestamped line; "save that" / "archive that" archives the current note. Spoken feedback is intentionally minimal (single words: "noted", "saved", "error") rather than conversational.

**Archiving:** reuses the existing DataPodsApp IndexedDB vault (`SAS_ZERO_VAULT` / `pods` store) via `lib/archivePod.ts`, tagging each note with its source so notes from different origins stay organized/separated rather than mixed into one blob — this satisfies the user's "keep things separate, low-compute pod keeper" requirement without needing an actual AI agent for filing.

**Why:** matches the user's ask for something always-reachable while doing other things (e.g. talking to Jackie) rather than living inside one app window.
