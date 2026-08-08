/**
 * The back road: does it lead anywhere, and does it stay honest.
 *
 * The last describe block is the one that matters. It is a structural test
 * over the real source, and it exists because the failure mode here is
 * specific: a router that keeps its OWN list of destinations instead of
 * resolving through the road. That list drifts, and the drift is silent —
 * a menu entry pointing at a renamed app is not a crash, it is a click that
 * does nothing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    clearBackroad,
    countByKind,
    destinations,
    go,
    lookup,
    reachable,
    register,
    registerApps,
    registerKind,
    resolve,
    resolveOne,
    manifest,
    manifestText,
    nearestTo,
    setNextHopAdvisor,
    travel,
    travelAll,
    UnknownDestinationError,
} from './backroad';
import { runBackroadTool } from './backroadTool';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A destination that records that it was travelled to. */
function stub(address: string, label: string, keywords: string[] = []) {
    const calls: Record<string, unknown>[] = [];
    register({
        address,
        kind: address.split(':')[0] as 'app',
        label,
        keywords,
        go: (params) => {
            calls.push(params ?? {});
        },
    });
    return calls;
}

describe('addresses', () => {
    beforeEach(() => clearBackroad());

    it('registers and looks up by exact address', () => {
        stub('app:cortex', 'Offline Cortex');
        expect(lookup('app:cortex')?.label).toBe('Offline Cortex');
        expect(reachable('app:cortex')).toBe(true);
    });

    it('re-registering an address replaces rather than duplicates', () => {
        stub('app:cortex', 'Old name');
        stub('app:cortex', 'Offline Cortex');
        expect(destinations()).toHaveLength(1);
        expect(lookup('app:cortex')?.label).toBe('Offline Cortex');
    });

    it('registerKind replaces the whole kind, so a deleted app stops being reachable', () => {
        registerApps([
            { id: 'a', name: 'Alpha' },
            { id: 'b', name: 'Beta' },
        ]);
        expect(countByKind().app).toBe(2);
        // The owner re-registers after the user deletes Beta.
        registerApps([{ id: 'a', name: 'Alpha' }]);
        expect(countByKind().app).toBe(1);
        expect(reachable('app:b')).toBe(false);
    });

    it('keeps kinds independent — replacing apps leaves themes alone', () => {
        registerApps([{ id: 'a', name: 'Alpha' }]);
        registerKind('theme', [
            { address: 'theme:win95', kind: 'theme', label: 'Windows 95', go: () => {} },
        ]);
        registerApps([{ id: 'a', name: 'Alpha' }, { id: 'c', name: 'Gamma' }]);
        expect(reachable('theme:win95')).toBe(true);
    });

    it('uses appId over id, which is the rule the deep link already follows', () => {
        registerApps([{ id: 'tile-1', appId: 'cortex', name: 'Offline Cortex' }]);
        expect(reachable('app:cortex')).toBe(true);
        expect(reachable('app:tile-1')).toBe(false);
    });
});

describe('resolving', () => {
    beforeEach(() => {
        clearBackroad();
        stub('app:cortex', 'Offline Cortex');
        stub('app:budget_radar', 'Budget Radar');
        stub('app:speed_racer', 'Speed Racer');
        stub('theme:win95', 'Windows 95');
    });

    it('ranks an exact address above everything', () => {
        expect(resolve('app:cortex')[0].address).toBe('app:cortex');
    });

    it('matches by label, case and punctuation insensitively', () => {
        expect(resolveOne('offline cortex')?.address).toBe('app:cortex');
        expect(resolveOne('Windows 95!')?.address).toBe('theme:win95');
    });

    it('matches by id when someone types the snake_case name', () => {
        expect(resolveOne('budget_radar')?.address).toBe('app:budget_radar');
    });

    it('requires every term to match, so two names do not both half-match', () => {
        // "budget cartographer" names two different things; answering with
        // either one would be a guess presented as an answer.
        expect(resolve('budget cartographer')).toHaveLength(0);
    });

    it('returns nothing for an empty query rather than everything', () => {
        expect(resolve('')).toHaveLength(0);
    });

    it('honours a confidence floor', () => {
        // Present but weak: a loose keyword hit should not clear a high bar.
        expect(resolveOne('racer', 0.95)).toBeNull();
        expect(resolveOne('speed racer', 0.8)?.address).toBe('app:speed_racer');
    });
});

describe('travelling', () => {
    beforeEach(() => clearBackroad());

    it('go() reaches a destination by exact address', async () => {
        const calls = stub('app:cortex', 'Offline Cortex');
        await go('app:cortex');
        expect(calls).toHaveLength(1);
    });

    it('go() reaches a destination by plain phrase', async () => {
        const calls = stub('app:cortex', 'Offline Cortex');
        await go('offline cortex');
        expect(calls).toHaveLength(1);
    });

    it('passes params through', async () => {
        const calls = stub('app:notepad', 'Notepad');
        await go('app:notepad', { text: 'hello' });
        expect(calls[0]).toEqual({ text: 'hello' });
    });

    it('throws with the nearest matches attached, not a bare failure', async () => {
        stub('app:cortex', 'Offline Cortex');
        // "That does not exist" and "you meant this" are the same answer to a
        // router, and only one of them lets it do something useful.
        await expect(go('app:cortexx')).rejects.toBeInstanceOf(UnknownDestinationError);
        try {
            await go('app:kortex');
        } catch (e) {
            expect((e as UnknownDestinationError).nearest.length).toBeGreaterThanOrEqual(0);
            expect((e as UnknownDestinationError).address).toBe('app:kortex');
        }
    });

    it('surfaces a destination that throws instead of swallowing it', async () => {
        register({
            address: 'app:broken',
            kind: 'app',
            label: 'Broken',
            go: () => {
                throw new Error('boom');
            },
        });
        await expect(go('app:broken')).rejects.toThrow('boom');
    });

    it('suggests the right destination for a genuine misspelling', async () => {
        stub('app:cortex', 'Offline Cortex');
        stub('app:budget_radar', 'Budget Radar');
        // `resolve` finds nothing here — every term must appear — which is
        // precisely when a suggestion earns its keep.
        expect(resolve('kortexx')).toHaveLength(0);
        try {
            await go('app:kortexx');
            throw new Error('should not have travelled');
        } catch (e) {
            expect((e as UnknownDestinationError).nearest.map((n) => n.address)).toContain('app:cortex');
        }
    });

    it('suggests but never travels on a misspelling', async () => {
        const calls = stub('app:cortex', 'Offline Cortex');
        await expect(go('app:kortexx')).rejects.toBeInstanceOf(UnknownDestinationError);
        // The whole safety property: a near miss must not open the neighbour.
        expect(calls).toHaveLength(0);
    });

    it('nearestTo stays quiet when nothing is genuinely close', () => {
        stub('app:cortex', 'Offline Cortex');
        expect(nearestTo('zzzzzzqqqq')).toHaveLength(0);
    });

    it('reachable() never throws on an unknown address', () => {
        expect(reachable('nothing:at:all')).toBe(false);
    });
});

describe('keeping the road true', () => {
    it('the command palette resolves through the back road, not its own list', () => {
        // This is the drift guard. A palette with a private matcher will rank
        // differently from every other router, and its list will go stale
        // independently — which is the state this module was built to end.
        const src = readFileSync(join(root, 'components/CommandPalette.tsx'), 'utf8');
        expect(src).toMatch(/from '\.\.\/lib\/backroad'/);
        expect(src).not.toMatch(/function fuzzyScore/);
    });

    it('App.tsx registers the roster it builds, rather than a second copy', () => {
        const src = readFileSync(join(root, 'App.tsx'), 'utf8');
        expect(src).toMatch(/registerApps\(/);
        // Registered FROM the live desktop state — a literal array here would
        // be exactly the parallel list this replaces.
        expect(src).toMatch(/walk\(desktopItems\)/);
    });

    it('every on-ramp used by App.tsx is exported by the back road', () => {
        const app = readFileSync(join(root, 'App.tsx'), 'utf8');
        const road = readFileSync(join(root, 'lib/backroad.ts'), 'utf8');
        const imported = app.match(/import \{([^}]*)\} from '\.\/lib\/backroad'/)?.[1] ?? '';
        for (const name of imported.split(',').map((n) => n.trim()).filter(Boolean)) {
            expect(road).toMatch(new RegExp(`export (async )?function ${name}\\b`));
        }
    });
});


describe('the agent lane', () => {
    beforeEach(() => {
        clearBackroad();
        setNextHopAdvisor(null);
    });

    it('travel() reports what opened, in a sentence an agent can use', async () => {
        stub('app:data_pods', 'Data Pods');
        const r = await travel('app:data_pods');
        expect(r.ok).toBe(true);
        expect(r.arrived?.address).toBe('app:data_pods');
        expect(r.detail).toContain('Data Pods');
    });

    it('travel() never throws on an unknown address — it reports alternatives', async () => {
        stub('app:data_pods', 'Data Pods');
        // A thrown error ends an agent's turn. A report lets it try again.
        const r = await travel('app:data_podz');
        expect(r.ok).toBe(false);
        expect(r.alternatives.map((a) => a.address)).toContain('app:data_pods');
    });

    it('travel() never throws when the destination itself breaks', async () => {
        register({
            address: 'app:broken',
            kind: 'app',
            label: 'Broken',
            go: () => {
                throw new Error('boom');
            },
        });
        const r = await travel('app:broken');
        expect(r.ok).toBe(false);
        expect(r.detail).toContain('boom');
    });

    it('reports declared next hops, labelled as declared', async () => {
        stub('app:pod_system', 'Pod System');
        register({
            address: 'app:data_pods',
            kind: 'app',
            label: 'Data Pods',
            provides: ['app:pod_system'],
            go: () => {},
        });
        const r = await travel('app:data_pods');
        expect(r.next).toEqual([
            { address: 'app:pod_system', label: 'Pod System', source: 'declared' },
        ]);
    });

    it('reports observed next hops, and never presents them as declared', async () => {
        stub('app:cortex', 'Offline Cortex');
        stub('app:speed_racer', 'Speed Racer');
        setNextHopAdvisor(() => [
            { address: 'app:speed_racer', label: 'Speed Racer', source: 'observed', confidence: 0.8 },
        ]);
        const r = await travel('app:cortex');
        expect(r.next[0].source).toBe('observed');
        expect(r.next[0].confidence).toBe(0.8);
    });

    it('says nothing about next hops when nothing has been learned', async () => {
        stub('app:cortex', 'Offline Cortex');
        // Silence beats invention: an agent will act on whatever it is told.
        const r = await travel('app:cortex');
        expect(r.next).toEqual([]);
    });

    it('a route continues past a broken stop and still delivers the rest', async () => {
        const a = stub('app:one', 'One');
        const c = stub('app:three', 'Three');
        const reports = await travelAll(['app:one', 'app:nope', 'app:three']);
        expect(reports.map((r) => r.ok)).toEqual([true, false, true]);
        expect(a).toHaveLength(1);
        expect(c).toHaveLength(1);
    });

    it('stopOnError halts a route whose later stops depend on earlier ones', async () => {
        const c = stub('app:three', 'Three');
        const reports = await travelAll(['app:nope', 'app:three'], { stopOnError: true });
        expect(reports).toHaveLength(1);
        expect(c).toHaveLength(0);
    });

    it('the manifest is filterable, so a prompt is not flooded', () => {
        stub('app:cortex', 'Offline Cortex');
        registerKind('theme', [
            { address: 'theme:win95', kind: 'theme', label: 'Windows 95', go: () => {} },
        ]);
        expect(manifest({ kinds: ['app'] }).map((e) => e.address)).toEqual(['app:cortex']);
        expect(manifestText({ kinds: ['theme'] })).toContain('theme:win95');
    });
});

describe('the tool an agent actually calls', () => {
    beforeEach(() => {
        clearBackroad();
        setNextHopAdvisor(null);
    });

    it('lists destinations it can then open', async () => {
        stub('app:data_pods', 'Data Pods');
        const res = (await runBackroadTool('list_destinations', { query: 'pods' })) as {
            ok: boolean;
            destinations: { address: string }[];
        };
        expect(res.ok).toBe(true);
        expect(res.destinations.map((d) => d.address)).toContain('app:data_pods');
    });

    it('opens one destination directly', async () => {
        const calls = stub('app:data_pods', 'Data Pods');
        const res = await runBackroadTool('open_destination', { address: 'app:data_pods' });
        expect(res.ok).toBe(true);
        expect(calls).toHaveLength(1);
    });

    it('opens a route and says how much of it worked', async () => {
        stub('app:one', 'One');
        stub('app:three', 'Three');
        const res = (await runBackroadTool('open_route', {
            addresses: ['app:one', 'app:nope', 'app:three'],
        })) as { ok: boolean; detail: string };
        expect(res.ok).toBe(false);
        expect(res.detail).toBe('Opened 2 of 3.');
    });

    it('returns a readable result for an unknown tool instead of throwing', async () => {
        const res = await runBackroadTool('teleport', {});
        expect(res.ok).toBe(false);
        expect(String(res.detail)).toContain('teleport');
    });

    it('handles a missing argument without throwing', async () => {
        expect((await runBackroadTool('open_destination', {})).ok).toBe(false);
        expect((await runBackroadTool('open_route', { addresses: [] })).ok).toBe(false);
    });
});
