/**
 * wholeDesktopSnapshot — the shape idea #06 seals: everything needed to
 * rehydrate this desktop exactly somewhere else, in one payload.
 *
 * Deliberately excluded, and why:
 *  - Open windows / focus / z-order: session furniture, not desktop state —
 *    same boundary src/desktop/timeTravel.ts already draws for the same
 *    reason (a real OS restore point captures your files and settings, not
 *    your open tabs).
 *  - Secrets (secretsVault, API keys): never travel in a plain exported
 *    file. A whole-desktop file is meant to be emailed to yourself or
 *    handed to a colleague; a secret sitting in it would be a real
 *    exposure, not a convenience.
 *  - The device's own provenance signing key (src/provenance/deviceKey.ts):
 *    device-specific by design — importing someone else's key onto this
 *    device would be actively wrong, not just extraneous.
 */
import type { StoredItem } from '../desktop/desktopOps';

export interface WholeDesktopSnapshot {
  v: 1;
  exportedAt: string;
  /** Every item as it currently renders on the desktop, built-in and
   *  user-created alike, in full. A whole-desktop restore replaces the
   *  desktop outright rather than merging with whatever the importing
   *  machine already has — that is what "rehydrates exactly" requires. */
  desktopItems: StoredItem[];
  desktopVisibility: Record<string, boolean>;
  wallpaperUrl: string | null;
  /** Raw persisted PC theme state (src/pc-themes/types.ts), applied as-is. */
  pcTheme: unknown;
  /** Raw time-travel log (src/desktop/timeTravel.ts's exportState()), so a
   *  restored desktop's history is the real history, not a fresh log. */
  timeTravelLog: string;
}
