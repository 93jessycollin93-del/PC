/**
 * Parallel — one prompt, many models, at the same time.
 *
 * The gateway answers one question with one model. Owning hundreds of models
 * only pays off if you can put them side by side, so this fans a single
 * prompt across a chosen set and reports each result as it lands.
 *
 * Independent by construction: one model failing, hanging, or rate-limiting
 * must not delay or fail the others, so every contestant gets its own
 * timeout and its own error. `Promise.all` would surrender the whole race to
 * the slowest or unluckiest entrant; this settles each on its own terms.
 */
import { chat, type ChatMessage } from './gateway';

export interface Contestant {
    /** `provider:model`. */
    ref: string;
    label: string;
}

export interface RaceResult {
    ref: string;
    label: string;
    ok: boolean;
    text?: string;
    error?: string;
    ms: number;
    /** Finish position among successful entrants; 1 is first. */
    place?: number;
}

export interface RaceOptions {
    system?: string;
    /** Per-model ceiling. A hung provider must not stall the board. */
    timeoutMs?: number;
    signal?: AbortSignal;
    onResult?: (r: RaceResult) => void;
}

const DEFAULT_TIMEOUT = 90_000;

/** Run one contestant, never throwing — failure is a result, not an exception. */
async function runOne(
    c: Contestant,
    messages: ChatMessage[],
    opts: RaceOptions,
): Promise<RaceResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);
    // Honour an outer cancel (the user closing the app) as well as the timeout.
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort);
    try {
        const res = await chat({ messages, model: c.ref, signal: controller.signal });
        return { ref: c.ref, label: c.label, ok: true, text: res.text, ms: Date.now() - started };
    } catch (err) {
        const aborted = controller.signal.aborted;
        return {
            ref: c.ref,
            label: c.label,
            ok: false,
            error: aborted ? `timed out after ${Math.round((opts.timeoutMs ?? DEFAULT_TIMEOUT) / 1000)}s` : err instanceof Error ? err.message : String(err),
            ms: Date.now() - started,
        };
    } finally {
        clearTimeout(timer);
        opts.signal?.removeEventListener('abort', onAbort);
    }
}

/**
 * Race a prompt across contestants. Resolves when all have settled; results
 * stream through `onResult` as each finishes so the UI can fill in live.
 */
export async function race(
    prompt: string,
    contestants: Contestant[],
    opts: RaceOptions = {},
): Promise<RaceResult[]> {
    const messages: ChatMessage[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });

    let finished = 0;
    const results = await Promise.all(
        contestants.map(async (c) => {
            const r = await runOne(c, messages, opts);
            if (r.ok) {
                finished += 1;
                r.place = finished;
            }
            opts.onResult?.(r);
            return r;
        }),
    );
    return results;
}

/**
 * Ask a model to judge the answers.
 *
 * The entrants are anonymised as A, B, C before judging. A judge told which
 * model wrote which answer is being invited to rate reputations instead of
 * text, and models do show that bias — so the mapping is kept on this side
 * and restored afterwards.
 */
export async function judge(
    prompt: string,
    results: RaceResult[],
    judgeRef?: string,
): Promise<{ verdict: string; ranking: string[] }> {
    const answered = results.filter((r) => r.ok && r.text);
    if (answered.length < 2) {
        return { verdict: 'Need at least two answers to compare.', ranking: [] };
    }

    const letters = answered.map((_, i) => String.fromCharCode(65 + i));
    const anonymised = answered
        .map((r, i) => `### Answer ${letters[i]}\n${r.text}`)
        .join('\n\n');

    const system =
        'You are judging answers to the same question. Be specific and terse. ' +
        'Rank them best to worst, give one sentence of justification each, and ' +
        'name the single best. Judge only the text — you do not know who wrote what.';

    const res = await chat({
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: `Question:\n${prompt}\n\n${anonymised}\n\nRank them.` },
        ],
        model: judgeRef,
    });

    // Restore identities in the verdict, so the reader sees real names.
    let verdict = res.text;
    answered.forEach((r, i) => {
        verdict = verdict.replace(new RegExp(`Answer ${letters[i]}\\b`, 'g'), r.label);
    });

    // Ranking follows the order the judge first mentions each entrant.
    const ranking: string[] = [];
    for (const r of answered) {
        const idx = verdict.indexOf(r.label);
        if (idx >= 0) ranking.push(r.label);
    }
    return { verdict, ranking };
}
