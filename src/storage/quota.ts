/**
 * How much room is actually available, asked rather than assumed.
 *
 * A hardcoded ceiling is wrong on every device and goes stale — which is
 * exactly the thing worth not revisiting in a year. `navigator.storage.estimate()`
 * reports what THIS browser on THIS device is willing to give, which on a
 * modern desktop is commonly several gigabytes and on a phone hundreds of
 * megabytes. So the number is measured at runtime, not written down.
 *
 * `persist()` matters as much as the size: without it the browser may evict
 * the whole origin under disk pressure, which for an offline-first OS means
 * losing everything precisely when the network is not there to restore it.
 * Persistence is requested once and the answer is reported honestly, because
 * a browser is allowed to say no.
 */

export interface QuotaReport {
  /** Bytes the browser says are available to this origin, when it will say. */
  quotaBytes: number | null;
  /** Bytes currently used across IndexedDB, caches and localStorage. */
  usageBytes: number | null;
  /** Free space, when both numbers are known. */
  availableBytes: number | null;
  /** True when the browser promised not to evict this origin. */
  persistent: boolean;
  /** False when the API is missing — an old browser, or a locked-down mode. */
  supported: boolean;
}

const UNSUPPORTED: QuotaReport = {
  quotaBytes: null,
  usageBytes: null,
  availableBytes: null,
  persistent: false,
  supported: false,
};

/** Ask the browser what it will give. Never throws. */
export async function measureQuota(): Promise<QuotaReport> {
  try {
    const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!s || typeof s.estimate !== 'function') return UNSUPPORTED;

    const est = await s.estimate();
    const quotaBytes = typeof est.quota === 'number' ? est.quota : null;
    const usageBytes = typeof est.usage === 'number' ? est.usage : null;
    let persistent = false;
    if (typeof s.persisted === 'function') {
      persistent = await s.persisted().catch(() => false);
    }
    return {
      quotaBytes,
      usageBytes,
      availableBytes:
        quotaBytes !== null && usageBytes !== null ? Math.max(0, quotaBytes - usageBytes) : null,
      persistent,
      supported: true,
    };
  } catch {
    return UNSUPPORTED;
  }
}

/**
 * Ask the browser not to evict this origin.
 *
 * Returns what actually happened rather than assuming success — Chrome grants
 * this based on engagement heuristics and Safari may refuse outright, so
 * treating the request as a guarantee would be a lie the user pays for later.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!s || typeof s.persist !== 'function') return false;
    if (typeof s.persisted === 'function' && (await s.persisted())) return true;
    return await s.persist();
  } catch {
    return false;
  }
}

/** Human-readable bytes. Used wherever a capacity is shown. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/**
 * Conservative floor used only when the browser will not report a number.
 *
 * Deliberately modest: promising capacity that may not exist is worse than
 * under-promising, because the failure lands after the data is already written.
 */
export const FALLBACK_DEEP_CAPACITY_BYTES = 50 * 1024 * 1024;

/** What Pod 2 can hold — measured when possible, floored when not. */
export async function deepPodCapacityBytes(): Promise<number> {
  const report = await measureQuota();
  if (report.quotaBytes !== null) return report.quotaBytes;
  return FALLBACK_DEEP_CAPACITY_BYTES;
}
