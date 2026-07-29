/**
 * The single TimeTravel instance for the desktop. Kept as one module-level
 * singleton (same pattern as quotaLedger in lib/aiClient.ts) rather than
 * constructed inline, so every part of the app that commits or reads
 * history is working against the same log.
 *
 * This is also where the persist reporter is wired to the notification bus.
 * TimeTravel takes it as a callback rather than importing the bus itself, so
 * the engine stays free of app wiring and testable in isolation — the coupling
 * lives here, at the composition point, which is the only place that should
 * know about both halves.
 */
import { TimeTravel } from './timeTravel';
import { bus } from '../../lib/bus';

/** Once per session is enough: the condition persists until space is freed,
 *  and repeating it on every commit would bury everything else. */
let reported = false;

export const timeTravel = new TimeTravel({
  onPersistError: ({ quota, message }) => {
    if (reported) return;
    reported = true;
    bus.emit('jackie-notification', {
      level: quota ? 'error' : 'warning',
      title: quota ? 'Storage is full' : 'History could not be saved',
      message,
      source: 'time-travel',
    });
  },
});
