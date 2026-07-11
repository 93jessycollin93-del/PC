/**
 * Permission / Capability Broker.
 *
 * A matrix of {scope} × {capability} toggle switches that decide whether a given
 * app or agent is allowed to use a sensitive capability (touch the filesystem,
 * run a shell command, reach the network, read/write the clipboard, call a model,
 * or spend money on paid providers).
 *
 * This is the generalized form of the "toggle switch whether I want access or
 * not" idea: every gate is default-allow so nothing breaks out of the box, but
 * the user can revoke any capability globally (scope `*`) or for a specific
 * app/agent, and gated call sites (see lib/aiClient.ts) enforce it.
 *
 * Changes broadcast on the Jackie Bus (`permission-changed`); denials broadcast
 * `permission-denied` so the Notification Center can surface them.
 */

import { bus } from './bus';

export type Capability =
  | 'filesystem'
  | 'shell'
  | 'network'
  | 'clipboard'
  | 'model_access'
  | 'spend';

export const CAPABILITIES: { id: Capability; label: string; description: string }[] = [
  { id: 'model_access', label: 'Model Access', description: 'Call AI models via the router / providers' },
  { id: 'spend', label: 'Paid Spend', description: 'Use paid providers that cost money' },
  { id: 'network', label: 'Network', description: 'Make outbound network requests' },
  { id: 'filesystem', label: 'Filesystem', description: 'Read/write the sandboxed terminal filesystem' },
  { id: 'shell', label: 'Shell', description: 'Run whitelisted shell commands' },
  { id: 'clipboard', label: 'Clipboard', description: 'Read from / write to the system clipboard' },
];

/** Global scope — a toggle here applies to every app/agent unless overridden. */
export const GLOBAL_SCOPE = '*';

const STORAGE_KEY = 'jackie_permissions_v1';

interface PermissionState {
  /** Explicit grants keyed `${scope}::${capability}` → allowed. */
  grants: Record<string, boolean>;
  /** Per-capability fallback used when no explicit grant exists. */
  defaults: Record<Capability, boolean>;
}

function defaultState(): PermissionState {
  return {
    grants: {},
    defaults: {
      model_access: true,
      spend: true,
      network: true,
      filesystem: true,
      shell: true,
      clipboard: true,
    },
  };
}

function keyOf(scope: string, capability: Capability): string {
  return `${scope}::${capability}`;
}

class PermissionBroker {
  private state: PermissionState = defaultState();
  private listeners = new Set<() => void>();

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<PermissionState>;
      const base = defaultState();
      this.state = {
        grants: parsed.grants ?? {},
        defaults: { ...base.defaults, ...(parsed.defaults ?? {}) },
      };
    } catch {
      this.state = defaultState();
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  /**
   * Is `scope` allowed to use `capability`?
   * Resolution order: explicit scope grant → global (`*`) grant → capability default.
   */
  can(scope: string, capability: Capability): boolean {
    const explicit = this.state.grants[keyOf(scope, capability)];
    if (explicit !== undefined) return explicit;
    const global = this.state.grants[keyOf(GLOBAL_SCOPE, capability)];
    if (global !== undefined) return global;
    return this.state.defaults[capability];
  }

  /**
   * Enforce a capability at a call site. Returns true if allowed; if denied,
   * emits `permission-denied` + a notification and returns false.
   */
  require(scope: string, capability: Capability, detail?: string): boolean {
    if (this.can(scope, capability)) return true;
    bus.emit('permission-denied', { scope, capability, detail });
    bus.emit('jackie-notification', {
      level: 'warning',
      title: 'Permission blocked',
      message: `${scope} is not allowed to use ${capability}${detail ? ` (${detail})` : ''}.`,
      source: 'permissions',
    });
    return false;
  }

  /** Set an explicit grant for a scope+capability. */
  set(scope: string, capability: Capability, granted: boolean): void {
    this.state.grants[keyOf(scope, capability)] = granted;
    this.persist();
    this.notify();
    bus.emit('permission-changed', { scope, capability, granted });
  }

  grant(scope: string, capability: Capability): void {
    this.set(scope, capability, true);
  }

  revoke(scope: string, capability: Capability): void {
    this.set(scope, capability, false);
  }

  /** Remove an explicit grant, reverting the scope+capability to its default. */
  reset(scope: string, capability: Capability): void {
    delete this.state.grants[keyOf(scope, capability)];
    this.persist();
    this.notify();
    bus.emit('permission-changed', { scope, capability, granted: this.can(scope, capability) });
  }

  /** All scopes that currently have at least one explicit grant. */
  getScopes(): string[] {
    const scopes = new Set<string>([GLOBAL_SCOPE]);
    Object.keys(this.state.grants).forEach(k => scopes.add(k.split('::')[0]));
    return Array.from(scopes);
  }

  /** Whether a scope+capability has an explicit (non-default) grant. */
  isExplicit(scope: string, capability: Capability): boolean {
    return this.state.grants[keyOf(scope, capability)] !== undefined;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const permissions = new PermissionBroker();

// Permission Profiles (Phase B step 17): preset configurations for different security postures
export type PermissionProfile = 'open' | 'balanced' | 'hardened' | 'paranoid';

export const PERMISSION_PROFILES: Record<PermissionProfile, Record<Capability, boolean>> = {
  // Default: everything allowed
  open: {
    model_access: true,
    spend: true,
    network: true,
    filesystem: true,
    shell: true,
    clipboard: true,
  },
  // Moderate restrictions: disable paid spend by default
  balanced: {
    model_access: true,
    spend: false,
    network: true,
    filesystem: true,
    shell: true,
    clipboard: true,
  },
  // Strict: disable dangerous capabilities (shell, filesystem)
  hardened: {
    model_access: true,
    spend: false,
    network: true,
    filesystem: false,
    shell: false,
    clipboard: true,
  },
  // Extreme: disable all but model access
  paranoid: {
    model_access: true,
    spend: false,
    network: false,
    filesystem: false,
    shell: false,
    clipboard: false,
  },
};

/**
 * Apply a permission profile to the global scope.
 * Sets all capability defaults in one operation.
 */
export function applyPermissionProfile(profile: PermissionProfile): void {
  const caps: Capability[] = ['model_access', 'spend', 'network', 'filesystem', 'shell', 'clipboard'];
  const settings = PERMISSION_PROFILES[profile];
  for (const cap of caps) {
    permissions.set(GLOBAL_SCOPE, cap, settings[cap]);
  }
}

export default permissions;
