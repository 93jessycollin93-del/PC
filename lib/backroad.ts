/**
 * The back road — one straight line every router can drive.
 *
 * The bus (lib/bus.ts) already connects everything, and lib/bypass.ts lets you
 * WATCH that spine. What neither gives you is a way to TRAVEL it: to say "take
 * me to X" without already knowing which mechanism X happens to live behind.
 *
 * Today that mechanism differs per destination. An app is `launch-app` with an
 * appId. A theme is a raw `pc-set-theme` CustomEvent. A provider is a call into
 * the gateway. A settings pane is an app plus a tab. So every router — the
 * command palette, the router menu, the terminal, voice, automation, deep
 * links, the Understudy — has had to learn all of them, and each keeps its own
 * hand-written list of what exists.
 *
 * Those lists drift, and the drift is not hypothetical: the router menu ships
 * a test that scrapes App.tsx's dispatch branches to catch dead entries, and
 * scripts/gen-pc-apps.mjs parses App.tsx *as text* to find the app roster,
 * because there was no other way to ask. Parsing your own source to learn what
 * you contain is the symptom this file treats.
 *
 * So: one address space, `kind:id` — `app:cortex`, `theme:win95`,
 * `provider:groq`, `verb:command-palette`. One `go(address)`. One
 * `resolve(query)` that every router can share instead of reimplementing.
 *
 * TWO RULES keep this from becoming another list that drifts:
 *
 *   1. THE OWNER REGISTERS. A destination is registered by whatever already
 *      holds the truth about it — App.tsx registers the desktop roster it
 *      builds, the theme registry registers themes, the catalog registers
 *      providers. Nothing here maintains a second copy, so there is nothing
 *      to fall out of sync.
 *
 *   2. TRAVEL IS OBSERVED. Every `go()` reports to the bypass recorder, so
 *      the road can be watched with the same tool that watches the bus. A
 *      shortcut nobody can see is how a codebase gets a hidden second
 *      architecture.
 *
 * What this is NOT: a replacement for the bus. Destinations mostly `go` by
 * emitting on the bus. The back road is an index and an on-ramp, not a
 * parallel transport — building one of those would be the exact tangle it
 * exists to prevent.
 */

import { bus } from './bus';
import { bypass } from './bypass';

export type DestinationKind = 'app' | 'theme' | 'provider' | 'setting' | 'verb' | 'folder';

export interface Destination {
    /** Canonical address, `kind:id`. Stable — routers store these. */
    address: string;
    kind: DestinationKind;
    /** What a person calls it. */
    label: string;
    /** How someone might actually phrase it. Matched loosely. */
    keywords?: string[];
    /** One line for a palette row, and for an agent reading the manifest. */
    description?: string;
    /**
     * Addresses an owner declares should usually be open first. Empty for
     * almost everything — a dependency invented to look thorough is worse
     * than none, because an agent will believe it.
     */
    requires?: string[];
    /** What becomes possible once here. Feeds an agent's next step. */
    provides?: string[];
    /** Take me there. May be async; callers need not await. */
    go: (params?: Record<string, unknown>) => void | Promise<void>;
}

export interface ResolvedDestination extends Destination {
    /** 0-1. How well it matched — routers rank on this. */
    score: number;
}

const registry = new Map<string, Destination>();

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            /* one bad listener must not stop the rest */
        }
    });
}

export function subscribeBackroad(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Register one destination. Re-registering the same address replaces it. */
export function register(dest: Destination): void {
    registry.set(dest.address, dest);
    notify();
}

/**
 * Register a whole set at once, replacing everything previously registered
 * under the same kind.
 *
 * Replacement rather than merge is deliberate: an owner re-registering after
 * the user deletes an app must be able to say "this is now the whole set".
 * Merging would leave the deleted app reachable — a road to somewhere that
 * is not there any more.
 */
export function registerKind(kind: DestinationKind, list: Destination[]): void {
    for (const [address, dest] of registry) {
        if (dest.kind === kind) registry.delete(address);
    }
    for (const dest of list) registry.set(dest.address, dest);
    notify();
}

export function unregister(address: string): void {
    if (registry.delete(address)) notify();
}

/** Everything reachable right now. */
export function destinations(): Destination[] {
    return [...registry.values()];
}

export function lookup(address: string): Destination | undefined {
    return registry.get(address);
}

export function countByKind(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const d of registry.values()) out[d.kind] = (out[d.kind] ?? 0) + 1;
    return out;
}

/** Lowercase, strip punctuation, collapse space — so "Web Cam!" ≈ "webcam". */
function norm(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Score one destination against a query.
 *
 * Deliberately simple and explainable. A router that cannot say why something
 * ranked first will eventually rank the wrong thing first and nobody will be
 * able to tell.
 */
function score(dest: Destination, q: string): number {
    const query = norm(q);
    if (!query) return 0;

    const label = norm(dest.label);
    const id = norm(dest.address.split(':').slice(1).join(':'));
    const words = norm([dest.label, dest.address, ...(dest.keywords ?? []), dest.description ?? ''].join(' '));

    if (dest.address.toLowerCase() === q.toLowerCase().trim()) return 1; // exact address
    if (label === query || id === query) return 0.95;
    if (label.startsWith(query) || id.startsWith(query)) return 0.8;

    // Every query term has to appear somewhere, or "budget cartographer"
    // would match both apps at half strength and rank neither usefully.
    const terms = query.split(' ').filter(Boolean);
    if (!terms.every((t) => words.includes(t))) return 0;

    if (label.includes(query)) return 0.65;
    return 0.4;
}

/** Ranked destinations for a query. Every router should use this one. */
export function resolve(query: string, limit = 12): ResolvedDestination[] {
    return destinations()
        .map((d) => ({ ...d, score: score(d, query) }))
        .filter((d) => d.score > 0)
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .slice(0, limit);
}

/** The single best match, or null when nothing is confidently close. */
export function resolveOne(query: string, minScore = 0.4): ResolvedDestination | null {
    const [best] = resolve(query, 1);
    return best && best.score >= minScore ? best : null;
}

/**
 * Edit distance, bounded so a long pair cannot cost much.
 *
 * Used ONLY for suggestions, never for travel. Fuzzy matching is right when
 * answering "did you mean" and wrong when deciding where to go — a typo that
 * silently opens a neighbouring app is the failure this whole module exists
 * to avoid.
 */
function editDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length || !b.length) return Math.max(a.length, b.length);
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
        const row = [i];
        for (let j = 1; j <= b.length; j += 1) {
            row[j] = Math.min(
                prev[j] + 1,
                row[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        prev = row;
    }
    return prev[b.length];
}

function similarity(a: string, b: string): number {
    const longest = Math.max(a.length, b.length);
    return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

/**
 * The closest things to a query that does not resolve.
 *
 * `resolve` deliberately requires every term to appear, so a misspelling
 * matches nothing at all — correct for travel, useless for a suggestion.
 * This is the softer pass, reached only on failure.
 */
export function nearestTo(query: string, limit = 3, minSimilarity = 0.55): ResolvedDestination[] {
    const q = norm(query.includes(':') ? query.split(':').slice(1).join(':') : query);
    if (!q) return [];
    return destinations()
        .map((d) => {
            const id = norm(d.address.split(':').slice(1).join(':'));
            return { ...d, score: Math.max(similarity(q, norm(d.label)), similarity(q, id)) };
        })
        .filter((d) => d.score >= minSimilarity)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

export class UnknownDestinationError extends Error {
    constructor(
        readonly address: string,
        /** What the router could have meant — so a caller can offer them. */
        readonly nearest: ResolvedDestination[],
    ) {
        super(
            nearest.length
                ? `Nothing is registered at "${address}". Did you mean ${nearest.map((n) => n.address).join(', ')}?`
                : `Nothing is registered at "${address}".`,
        );
        this.name = 'UnknownDestinationError';
    }
}

/**
 * Travel to an address.
 *
 * Takes an exact address, or a phrase — `go('cortex')` and
 * `go('app:cortex')` both arrive. An unknown address throws WITH the nearest
 * matches attached, because "that does not exist" and "you meant this" are
 * the same answer to a router and only one of them is useful.
 */
export async function go(address: string, params?: Record<string, unknown>): Promise<Destination> {
    const exact = registry.get(address);
    const dest = exact ?? resolveOne(address);
    if (!dest) {
        // Suggestions come from the soft pass: `resolve` returns nothing for a
        // misspelling, which is exactly the case where a suggestion is worth
        // most.
        const near = resolve(address, 3);
        throw new UnknownDestinationError(address, near.length ? near : nearestTo(address));
    }

    // Recorded before the jump, so a destination that throws still shows the
    // attempt — an unrecorded failed trip is the hardest kind to debug.
    bypass.noteEmit(`backroad:${dest.kind}`, { address: dest.address });
    await dest.go(params);
    return dest;
}

/** True when an address (or phrase) leads somewhere. Never throws. */
export function reachable(address: string): boolean {
    return registry.has(address) || resolveOne(address) !== null;
}

export function clearBackroad(): void {
    registry.clear();
    notify();
}

/* ── the agent lane ───────────────────────────────────────────────────────

   Everything above moves a *person* — a click, a keystroke, a spoken phrase.
   An agent working inside the app needs three more things, and not having
   them is why an agent ends up walking through unrelated screens to reach one
   pod:

     A MAP it can read before deciding. `manifest()`.
     AN ANSWER when it arrives. `travel()` returns what happened and what is
       now in reach, instead of `go()`'s silence.
     A WAY TO FAIL USEFULLY. `travel()` never throws. A thrown error ends an
       agent's turn; a report it can read lets it try the next thing.
*/

export interface NextHop {
    address: string;
    label: string;
    /**
     * Where this suggestion comes from, always stated:
     *   'declared' — an owner said so in `requires`/`provides`.
     *   'observed' — this is what actually tends to follow, learned from use.
     * An agent should weigh those differently, so it is never left guessing
     * which one it is looking at.
     */
    source: 'declared' | 'observed';
    /** For observed hops: how often it followed, 0-1. */
    confidence?: number;
}

type NextHopAdvisor = (address: string) => NextHop[];

let advisor: NextHopAdvisor | null = null;

/**
 * Teach the road what tends to follow what.
 *
 * Deliberately injected rather than imported: the road must not depend on the
 * Understudy existing, and the Understudy is opt-in. With no advisor wired,
 * `next` simply carries declared hops and says nothing it cannot support.
 */
export function setNextHopAdvisor(fn: NextHopAdvisor | null): void {
    advisor = fn;
}

export interface TravelReport {
    ok: boolean;
    /** The address asked for — not necessarily the one reached. */
    requested: string;
    /** Where it actually went. Null when it did not go anywhere. */
    arrived: { address: string; label: string; kind: DestinationKind } | null;
    /** Plain sentence an agent can put straight into its reasoning. */
    detail: string;
    /** Where to go next from here, each labelled with why. */
    next: NextHop[];
    /** On failure: the closest addresses, so the agent can retry rather than stop. */
    alternatives: { address: string; label: string }[];
}

function hopsFrom(dest: Destination): NextHop[] {
    const declared: NextHop[] = [];
    for (const address of [...(dest.requires ?? []), ...(dest.provides ?? [])]) {
        const d = registry.get(address);
        if (d) declared.push({ address, label: d.label, source: 'declared' });
    }
    const observed = advisor ? advisor(dest.address) : [];
    // Declared first: a stated dependency outranks a statistical habit.
    const seen = new Set(declared.map((h) => h.address));
    return [...declared, ...observed.filter((h) => !seen.has(h.address))].slice(0, 6);
}

/**
 * Travel, and report back. The agent-facing counterpart to `go`.
 *
 * Never throws — including when the destination itself throws. An agent that
 * loses its turn to an exception cannot recover; one holding a report saying
 * what broke and what else was close can.
 */
export async function travel(address: string, params?: Record<string, unknown>): Promise<TravelReport> {
    const dest = registry.get(address) ?? resolveOne(address);

    if (!dest) {
        const near = resolve(address, 3);
        const alternatives = (near.length ? near : nearestTo(address)).map((n) => ({
            address: n.address,
            label: n.label,
        }));
        return {
            ok: false,
            requested: address,
            arrived: null,
            detail: alternatives.length
                ? `Nothing is registered at "${address}". Closest: ${alternatives.map((a) => a.address).join(', ')}.`
                : `Nothing is registered at "${address}", and nothing is close to it.`,
            next: [],
            alternatives,
        };
    }

    try {
        bypass.noteEmit(`backroad:${dest.kind}`, { address: dest.address });
        await dest.go(params);
    } catch (err) {
        return {
            ok: false,
            requested: address,
            arrived: null,
            detail: `Reached "${dest.address}" but it failed to open: ${
                err instanceof Error ? err.message : String(err)
            }`,
            next: hopsFrom(dest),
            alternatives: [],
        };
    }

    return {
        ok: true,
        requested: address,
        arrived: { address: dest.address, label: dest.label, kind: dest.kind },
        detail: `Opened ${dest.label} (${dest.address}).${dest.description ? ` ${dest.description}` : ''}`,
        next: hopsFrom(dest),
        alternatives: [],
    };
}

/**
 * Several stops in order.
 *
 * Keeps going after a failed stop rather than abandoning the run, because a
 * plan of four where the second is unreachable should still deliver three.
 * Pass `stopOnError` when a later stop genuinely depends on an earlier one.
 */
export async function travelAll(
    addresses: string[],
    { stopOnError = false }: { stopOnError?: boolean } = {},
): Promise<TravelReport[]> {
    const reports: TravelReport[] = [];
    for (const address of addresses) {
        const report = await travel(address);
        reports.push(report);
        if (!report.ok && stopOnError) break;
    }
    return reports;
}

export interface ManifestEntry {
    address: string;
    label: string;
    kind: DestinationKind;
    description?: string;
}

/**
 * Everywhere an agent could go, in a shape it can be handed directly.
 *
 * `kinds` narrows it, because a prompt does not need 26 themes to answer a
 * question about pods, and every irrelevant line is one more chance to pick
 * the wrong door.
 */
export function manifest(opts: { kinds?: DestinationKind[]; query?: string } = {}): ManifestEntry[] {
    let list = opts.query ? (resolve(opts.query, 200) as Destination[]) : destinations();
    if (opts.kinds) list = list.filter((d) => opts.kinds!.includes(d.kind));
    return list
        .map((d) => ({ address: d.address, label: d.label, kind: d.kind, description: d.description }))
        .sort((a, b) => a.address.localeCompare(b.address));
}

/** The manifest as compact lines, for dropping into a prompt. */
export function manifestText(opts: Parameters<typeof manifest>[0] = {}): string {
    return manifest(opts)
        .map((e) => `${e.address}\t${e.label}${e.description ? ` — ${e.description}` : ''}`)
        .join('\n');
}

/* ── on-ramps ─────────────────────────────────────────────────────────────
   Helpers for the owners that register. Each one exists so a caller does not
   have to know the mechanism behind a kind — which is the whole point. */

export interface AppLike {
    id: string;
    /** The dispatch id. Falls back to `id` — the deep-link rule App.tsx uses. */
    appId?: string;
    name: string;
    keywords?: string[];
}

/** Register the desktop roster. Called by whoever builds it. */
export function registerApps(items: AppLike[]): void {
    registerKind(
        'app',
        items.map((item) => {
            const target = item.appId ?? item.id;
            return {
                address: `app:${target}`,
                kind: 'app' as const,
                label: item.name,
                keywords: ['open', 'launch', 'start', target.replace(/_/g, ' '), ...(item.keywords ?? [])],
                go: () => {
                    bus.emit('launch-app', { appId: target });
                },
            };
        }),
    );
}

export function registerThemes(themes: { id: string; label: string; era?: string }[]): void {
    registerKind(
        'theme',
        themes.map((t) => ({
            address: `theme:${t.id}`,
            kind: 'theme' as const,
            label: t.label,
            description: t.era ? `Desktop era: ${t.era}` : undefined,
            keywords: ['theme', 'skin', 'look', 'era', 'appearance', t.era ?? ''].filter(Boolean),
            go: () => {
                // The theme switch is a raw CustomEvent rather than a bus
                // channel; the back road is where that asymmetry stops being
                // every caller's problem.
                window.dispatchEvent(new CustomEvent('pc-set-theme', { detail: { themeId: t.id } }));
            },
        })),
    );
}

export function registerProviders(providers: { id: string; label: string }[]): void {
    registerKind(
        'provider',
        providers.map((p) => ({
            address: `provider:${p.id}`,
            kind: 'provider' as const,
            label: p.label,
            keywords: ['provider', 'model', 'ai', 'key', p.id],
            description: 'Open AI Providers',
            go: () => {
                bus.emit('launch-app', { appId: 'ai_providers' });
            },
        })),
    );
}

/** The verbs that are not tied to any one destination. */
export function registerGlobalVerbs(): void {
    registerKind('verb', [
        {
            address: 'verb:command-palette',
            kind: 'verb',
            label: 'Search apps',
            keywords: ['search', 'find', 'palette', 'command', 'spotlight'],
            go: () => bus.emit('open-command-palette'),
        },
        {
            address: 'verb:router-menu',
            kind: 'verb',
            label: 'Open the router menu',
            keywords: ['router', 'menu', 'front door', 'manual'],
            go: () => bus.emit('open-router-menu'),
        },
        {
            address: 'verb:back',
            kind: 'verb',
            label: 'Go back',
            keywords: ['back', 'close', 'escape', 'return'],
            go: () => bus.emit('global-back-request'),
        },
        {
            address: 'verb:refresh-desktop',
            kind: 'verb',
            label: 'Refresh the desktop',
            keywords: ['refresh', 'reload', 'redraw'],
            go: () => bus.emit('refresh-desktop'),
        },
    ]);
}
