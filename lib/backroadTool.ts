/**
 * The back road as a tool an AI in this app can actually call.
 *
 * The road is useless to an agent it has to be told about in prose. This is
 * the callable surface: a Gemini-shaped function declaration plus the executor
 * behind it, so any tool-calling site wires the whole road in one line.
 *
 * Three functions rather than one, because they answer three different
 * questions an agent has at different moments:
 *
 *   list_destinations  "what is there?"  — before deciding.
 *   open_destination   "take me there"   — and tell me what I found.
 *   open_route         "take me through" — several stops, one call.
 *
 * Every result is a plain object with a `detail` sentence. An agent that has
 * to parse a UI to learn whether its own action worked is an agent that will
 * eventually be wrong about it.
 */
import { manifest, travel, travelAll, type DestinationKind, type TravelReport } from './backroad';

/** Gemini function-calling wire format — the shape lib/gemini.ts passes through. */
export const BACKROAD_TOOL = {
    functionDeclarations: [
        {
            name: 'list_destinations',
            description:
                'List everywhere in this desktop that can be opened directly — apps, themes, AI providers and global verbs — as stable addresses like "app:cortex". Call this before opening something so the address is real rather than guessed.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    query: {
                        type: 'STRING',
                        description: 'Optional filter, e.g. "pod" or "budget". Omit to list everything.',
                    },
                    kind: {
                        type: 'STRING',
                        description: 'Optional: one of app, theme, provider, verb, setting, folder.',
                    },
                },
            },
        },
        {
            name: 'open_destination',
            description:
                'Go straight to one address, without opening anything else on the way. Returns what opened and what is commonly reached from there next.',
            parameters: {
                type: 'OBJECT',
                required: ['address'],
                properties: {
                    address: {
                        type: 'STRING',
                        description: 'An address from list_destinations, e.g. "app:data_pods". A plain name also works.',
                    },
                },
            },
        },
        {
            name: 'open_route',
            description:
                'Open several addresses in order, in one call. Continues past a stop that fails and reports each one, so a partly-reachable route still delivers the reachable part.',
            parameters: {
                type: 'OBJECT',
                required: ['addresses'],
                properties: {
                    addresses: {
                        type: 'ARRAY',
                        description: 'Addresses in the order they should open.',
                        items: { type: 'STRING' },
                    },
                    stopOnError: {
                        type: 'BOOLEAN',
                        description: 'Stop at the first failure. Use only when a later stop truly depends on an earlier one.',
                    },
                },
            },
        },
    ],
};

export const BACKROAD_TOOL_NAMES = ['list_destinations', 'open_destination', 'open_route'];

/** Trimmed for a prompt: a report carries fields an agent does not need to read back. */
function summarize(r: TravelReport) {
    return {
        ok: r.ok,
        detail: r.detail,
        ...(r.arrived ? { opened: r.arrived.address } : {}),
        ...(r.next.length
            ? { next: r.next.map((n) => `${n.address} (${n.source}${n.confidence ? ` ${Math.round(n.confidence * 100)}%` : ''})`) }
            : {}),
        ...(r.alternatives.length ? { alternatives: r.alternatives.map((a) => a.address) } : {}),
    };
}

/**
 * Run one back-road tool call.
 *
 * Returns a result object for every outcome including an unknown tool name —
 * a thrown error here would surface to the agent as a dead turn rather than
 * something it can correct.
 */
export async function runBackroadTool(
    name: string,
    args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
    switch (name) {
        case 'list_destinations': {
            const kind = typeof args.kind === 'string' ? (args.kind as DestinationKind) : undefined;
            const entries = manifest({
                query: typeof args.query === 'string' ? args.query : undefined,
                kinds: kind ? [kind] : undefined,
            });
            return {
                ok: true,
                count: entries.length,
                // Capped: a 150-line list inside a prompt crowds out the task.
                destinations: entries.slice(0, 60),
                ...(entries.length > 60 ? { note: `Showing 60 of ${entries.length}. Narrow with "query".` } : {}),
            };
        }

        case 'open_destination': {
            const address = typeof args.address === 'string' ? args.address : '';
            if (!address) return { ok: false, detail: 'No address was given.' };
            return summarize(await travel(address));
        }

        case 'open_route': {
            const list = Array.isArray(args.addresses) ? args.addresses.filter((a): a is string => typeof a === 'string') : [];
            if (!list.length) return { ok: false, detail: 'No addresses were given.' };
            const reports = await travelAll(list, { stopOnError: args.stopOnError === true });
            const opened = reports.filter((r) => r.ok).length;
            return {
                ok: reports.every((r) => r.ok),
                detail: `Opened ${opened} of ${list.length}.`,
                stops: reports.map(summarize),
            };
        }

        default:
            return { ok: false, detail: `"${name}" is not a back-road tool.` };
    }
}
