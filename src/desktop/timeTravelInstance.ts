/**
 * The single TimeTravel instance for the desktop. Kept as one module-level
 * singleton (same pattern as quotaLedger in lib/aiClient.ts) rather than
 * constructed inline, so every part of the app that commits or reads
 * history is working against the same log.
 */
import { TimeTravel } from './timeTravel';

export const timeTravel = new TimeTravel();
