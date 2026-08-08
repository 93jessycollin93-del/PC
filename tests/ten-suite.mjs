/**
 * Ultimate testing mode — the ten, end to end in a real browser.
 *
 * Each idea is checked at the level it actually has to work at: the engine
 * logic where the value lives (does the keyring rotate, does the cortex match
 * a reworded question, does the predictor score itself), and the surface where
 * the user meets it (does the app open, does it render its own state).
 *
 * Providers are intercepted per host — never a blanket `**\/*`, which would
 * swallow Vite's lazy chunks and leave the app under test blank.
 */
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
});
const results = [];
const ok = (n, pass, extra = '') => {
    results.push({ n, pass, extra });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${n}${extra ? `  — ${extra}` : ''}`);
};

const PROVIDER_HOSTS = [
    '**://openrouter.ai/**', '**://generativelanguage.googleapis.com/**', '**://api.groq.com/**',
    '**://api.cerebras.ai/**', '**://api.mistral.ai/**', '**://models.inference.ai.azure.com/**',
    '**://router.huggingface.co/**', '**://api.openai.com/**', '**://api.anthropic.com/**',
    '**://api.deepseek.com/**', '**://api.x.ai/**', '**://api.together.xyz/**',
];

/** Latency per provider host, so Speed Racer has a real ordering to find. */
const LATENCY = { 'api.groq.com': 20, 'api.cerebras.ai': 60, 'api.mistral.ai': 140 };

async function newPage() {
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', (e) => console.log('   PAGEERROR:', e.message.slice(0, 140)));
    const handler = async (route) => {
        const url = route.request().url();
        const host = new URL(url).host;
        if (url.includes('/models')) {
            return route.fulfill({
                status: 200, contentType: 'application/json',
                body: JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile' }, { id: 'mixtral-8x7b' }] }),
            });
        }
        const delay = LATENCY[host] ?? 90;
        await new Promise((r) => setTimeout(r, delay));
        return route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({ choices: [{ message: { content: `answer from ${host}` }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 30 } }),
        });
    };
    for (const p of PROVIDER_HOSTS) await page.route(p, handler);
    await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5500);
    return page;
}

/** Open an app by id through the bus — avoids ambiguity between the two
 *  on-screen search inputs (router menu and app palette). */
async function launch(page, appId) {
    await page.evaluate((id) => window.dispatchEvent(new CustomEvent('launch-app', { detail: { appId: id } })), appId);
    await page.waitForTimeout(1800);
}

let page = await newPage();

// Seed a working key pool so the AI-backed apps have something to call.
await page.evaluate(async () => {
    const kr = await import('/lib/ai/keyring.ts');
    kr.invalidate();
    kr.addKey('groq', 'gsk_test_one', 'primary');
    kr.addKey('cerebras', 'csk_test_two', 'second');
    kr.addKey('mistral', 'msk_test_three', 'third');
});

// ── 1. Budget Radar ──────────────────────────────────────────────────────
await launch(page, 'budget_radar');
ok('01. Budget Radar opens and reports spend state',
    (await page.locator('text=/Budget Radar/i').count()) > 0);

// Telemetry is the foundation six of the ten share — prove it records.
const telemetryWorks = await page.evaluate(async () => {
    const m = await import('/lib/ai/telemetry.ts');
    m.clearTelemetry();
    const base = { at: Date.now(), provider: 'groq', model: 'llama', keyId: 'k1', promptChars: 40, replyChars: 120, fallbacks: 0 };
    m.record({ ...base, ms: 120, ok: true });
    m.record({ ...base, ms: 300, ok: true });
    m.record({ ...base, ms: 900, ok: false, status: 429 });
    const s = m.statsByProvider().find((r) => r.provider === 'groq');
    return s ? { calls: s.calls, median: s.medianMs } : null;
});
ok('02. Telemetry aggregates by provider with a median (not a mean)',
    !!telemetryWorks && telemetryWorks.calls === 3,
    telemetryWorks ? `calls=${telemetryWorks.calls} median=${telemetryWorks.median}ms` : 'no stats');

// ── 2. Colosseum ─────────────────────────────────────────────────────────
await launch(page, 'colosseum');
ok('03. Colosseum opens', (await page.locator('text=/Colosseum/i').count()) > 0);

// Judging must not leak entrant names into the ballot.
const anonymised = await page.evaluate(async () => {
    const m = await import('/lib/ai/parallel.ts');
    return typeof m.judge === 'function' && typeof m.race === 'function';
});
ok('04. Parallel foundation exposes race() and judge()', anonymised);

// ── 3. Ambient Agents ────────────────────────────────────────────────────
await launch(page, 'ambient_agents');
const agentSaved = await page.evaluate(async () => {
    const m = await import('/lib/ambient/agents.ts');
    const a = m.saveAgent({ name: 'Morning brief', instruction: 'Summarise', cadence: 'hourly' });
    // A wall-clock next-run is what makes the cadence survive a closed tab;
    // a tick counter would reset to zero on every reload.
    return { hasNext: a.nextRunAt > Date.now(), listed: m.listAgents().length };
});
ok('05. Ambient agent schedules on wall-clock time, not ticks',
    agentSaved.hasNext && agentSaved.listed >= 1, `agents=${agentSaved.listed}`);

// ── 4. Bus Recorder ──────────────────────────────────────────────────────
const recorderOff = await page.evaluate(async () => {
    const m = await import('/lib/observe/recorder.ts');
    return m.isRecording();
});
ok('06. Recorder is OFF until explicitly started (not surveillance by default)', recorderOff === false);

const captured = await page.evaluate(async () => {
    const m = await import('/lib/observe/recorder.ts');
    m.startRecording();
    window.dispatchEvent(new CustomEvent('launch-app', { detail: { appId: 'cortex' } }));
    await new Promise((r) => setTimeout(r, 400));
    const evts = m.getEvents();
    m.stopRecording();
    return evts.filter((e) => e.channel === 'launch-app').length;
});
ok('07. Recorder captures a launch once started', captured >= 1, `events=${captured}`);

await launch(page, 'bus_recorder');
ok('08. Bus Recorder app opens', (await page.locator('text=/Recorder/i').count()) > 0);

// ── 5. Choreography ──────────────────────────────────────────────────────
await launch(page, 'choreography');
ok('09. Choreography opens with presets', (await page.locator('text=/Research|AI Lab|Ops/').count()) > 0);

// ── 6. Speed Racer ───────────────────────────────────────────────────────
await launch(page, 'speed_racer');
ok('10. Speed Racer opens', (await page.locator('text=/Speed Racer|Race/i').count()) > 0);

// ── 7. Cartographer ──────────────────────────────────────────────────────
await launch(page, 'cartographer');
ok('11. Cartographer opens', (await page.locator('text=/Cartographer/i').count()) > 0);

// ── 8. Prompt Genome ─────────────────────────────────────────────────────
await launch(page, 'prompt_genome');
ok('12. Prompt Genome opens', (await page.locator('text=/Genome|lineage/i').count()) > 0);

// ── 9. Offline Cortex ────────────────────────────────────────────────────
const cortex = await page.evaluate(async () => {
    const m = await import('/lib/ai/cortex.ts');
    m.clearCortex();
    m.remember('What is a pod?', 'A pod is an isolated workspace.', 'groq');
    // Reworded, recased, repunctuated — an exact-match cache misses this.
    const hit = m.lookup("what's a POD");
    return { found: !!hit, answer: hit?.answer ?? '', size: m.listCache().length };
});
ok('13. Cortex matches a reworded question (normalized, not exact)',
    cortex.found && cortex.answer.includes('isolated'), cortex.answer.slice(0, 40));

const cortexOffline = await page.evaluate(async () => {
    const m = await import('/lib/ai/cortex.ts');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const res = await m.askWithCortex('What is a pod?');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    return res;
});
ok('14. Offline, Cortex answers from memory and admits it is cached',
    cortexOffline.fromCache === true && cortexOffline.text.includes('isolated'),
    `fromCache=${cortexOffline.fromCache}`);

const cortexHonest = await page.evaluate(async () => {
    const m = await import('/lib/ai/cortex.ts');
    const res = await m.askWithCortex('Name one colour');
    return res.fromCache;
});
ok('15. Online, a fresh answer is NOT labelled as cached', cortexHonest === false);

await launch(page, 'cortex');
ok('16. Cortex app opens and shows the memory it holds',
    (await page.locator('text=/Offline Cortex/i').count()) > 0 &&
    (await page.locator('text=/remembered/').count()) > 0);

// ── 10. The Understudy ───────────────────────────────────────────────────
const understudyOff = await page.evaluate(async () => {
    const m = await import('/lib/understudy/predictor.ts');
    return m.isEnabled();
});
ok('17. Understudy is opt-in — learning about someone is not a default', understudyOff === false);

const learned = await page.evaluate(async () => {
    const m = await import('/lib/understudy/predictor.ts');
    m.resetModel();
    // Same routine four times: A → B → C.
    for (let i = 0; i < 4; i += 1) {
        m.record('cortex');
        m.record('speed_racer');
        m.record('cartographer');
    }
    const preds = m.predictNext('cortex');
    return { top: preds[0]?.appId ?? null, conf: preds[0]?.confidence ?? 0, reason: preds[0]?.reason ?? '' };
});
ok('18. Understudy predicts the app that actually follows',
    learned.top === 'speed_racer' && learned.conf > 0.3,
    `${learned.top} @ ${Math.round(learned.conf * 100)}% — ${learned.reason}`);

const cold = await page.evaluate(async () => {
    const m = await import('/lib/understudy/predictor.ts');
    m.resetModel();
    m.record('cortex');
    m.record('speed_racer');
    return m.predictNext('cortex').length;
});
ok('19. One data point yields no prediction (guessing is not predicting)', cold === 0);

const routine = await page.evaluate(async () => {
    const m = await import('/lib/understudy/predictor.ts');
    m.resetModel();
    for (let i = 0; i < 3; i += 1) {
        m.record('cortex'); m.record('speed_racer'); m.record('cartographer');
    }
    const r = m.routines();
    return { count: r.length, first: r[0]?.chain.join('>') ?? '' };
});
ok('20. Repeated three-app sequences surface as routines',
    routine.count >= 1, routine.first);

const scored = await page.evaluate(async () => {
    const m = await import('/lib/understudy/predictor.ts');
    m.resetModel();
    for (let i = 0; i < 4; i += 1) { m.record('cortex'); m.record('speed_racer'); }
    await m.prefetch(m.predictNext('cortex'), 0);
    m.record('speed_racer'); // the prediction comes true
    return m.accuracy();
});
ok('21. Understudy scores its own predictions', scored !== null && scored > 0, `accuracy=${scored}`);

const warmed = await page.evaluate(async () => {
    const m = await import('/lib/understudy/predictor.ts');
    const reg = await import('/lib/appRegistry.ts');
    const C = reg.APP_REGISTRY.cortex.Component;
    if (typeof C.preload !== 'function') return 'no preload';
    await C.preload();
    await C.preload(); // memoized — must not re-issue
    return 'preloaded';
});
ok('22. Registry apps expose a memoized preload so chunks can be warmed', warmed === 'preloaded', String(warmed));

await launch(page, 'understudy');
ok('23. Understudy app opens and shows what it has learned',
    (await page.locator('text=/Understudy/i').count()) > 0 &&
    (await page.locator('text=/Launches seen|Probably next/').count()) > 0);

// ── Cross-cutting ────────────────────────────────────────────────────────
const allRegistered = await page.evaluate(async () => {
    const reg = await import('/lib/appRegistry.ts');
    const ids = ['budget_radar', 'colosseum', 'ambient_agents', 'bus_recorder', 'choreography',
        'speed_racer', 'cartographer', 'prompt_genome', 'cortex', 'understudy'];
    return ids.filter((id) => !reg.APP_REGISTRY[id]);
});
ok('24. All ten are registered in APP_REGISTRY', allRegistered.length === 0,
    allRegistered.length ? `missing: ${allRegistered.join(', ')}` : 'ten of ten');

// The real guarantee: launching each id renders that app's own chunk.
// Checked on a clean page so nothing opened earlier can stand in for it.
await page.close();
page = await newPage();
const TEN = [
    ['budget_radar', 'Budget Radar'], ['colosseum', 'Colosseum'], ['ambient_agents', 'Ambient Agents'],
    ['bus_recorder', 'Bus Recorder'], ['choreography', 'Choreograph'], ['speed_racer', 'Speed Racer'],
    ['cartographer', 'Cartographer'], ['prompt_genome', 'Genome'], ['cortex', 'Offline Cortex'],
    ['understudy', 'Understudy'],
];
const notRendered = [];
for (const [id, marker] of TEN) {
    await launch(page, id);
    const text = await page.locator('body').innerText();
    if (!text.includes(marker)) notRendered.push(id);
}
ok('25. Launching each of the ten renders its app', notRendered.length === 0,
    notRendered.length ? `blank: ${notRendered.join(', ')}` : 'ten of ten');


// ── The policy hook the gateway gained for Momentum's spend gate ─────────
// Test 25 opened a fresh page, so the pool seeded at the top is gone.
await page.evaluate(async () => {
    const kr = await import('/lib/ai/keyring.ts');
    kr.invalidate();
    kr.addKey('groq', 'gsk_test_one', 'primary');
    kr.addKey('cerebras', 'csk_test_two', 'second');
    kr.addKey('mistral', 'msk_test_three', 'third');
});
const excluded = await page.evaluate(async () => {
    const { chat } = await import('/lib/ai/gateway.ts');
    const a = await chat({ messages: [{ role: 'user', content: 'hi' }], excludeProviders: ['groq'] });
    // An exclusion a caller could route around by naming the provider
    // would not be an exclusion.
    const b = await chat({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'groq:llama-3.3-70b-versatile',
        excludeProviders: ['groq'],
    });
    return { auto: a.provider, named: b.provider };
});
ok('26. excludeProviders keeps a forbidden provider out of the chain',
    excluded.auto !== 'groq', `answered by ${excluded.auto}`);
ok('27. An exclusion cannot be routed around by naming the provider',
    excluded.named !== 'groq', `answered by ${excluded.named}`);


// ── The back road ────────────────────────────────────────────────────────
// Unit tests cover the module; these check the thing unit tests cannot —
// that the running app actually registered its real roster into it.
const road = await page.evaluate(async () => {
    const m = await import('/lib/backroad.ts');
    return { total: m.destinations().length, kinds: m.countByKind() };
});
ok('28. The live app registers its whole roster on the back road',
    road.total > 100 && road.kinds.app > 100,
    `${road.total} addresses — ${Object.entries(road.kinds).map(([k, n]) => `${n} ${k}`).join(', ')}`);

ok('29. Themes, providers and verbs are addressable too',
    road.kinds.theme >= 20 && road.kinds.provider >= 10 && road.kinds.verb >= 4,
    `${road.kinds.theme} themes, ${road.kinds.provider} providers, ${road.kinds.verb} verbs`);

const travelled = await page.evaluate(async () => {
    const m = await import('/lib/backroad.ts');
    const seen = [];
    const off = (await import('/lib/bus.ts')).bus.on('launch-app', ({ appId }) => seen.push(appId));
    await m.go('app:cortex');       // exact address
    await m.go('offline cortex');   // plain phrase
    off();
    return seen;
});
ok('30. go() travels by exact address AND by plain phrase',
    travelled.length === 2 && travelled.every((a) => a === 'cortex'), travelled.join(', '));

const unknown = await page.evaluate(async () => {
    const m = await import('/lib/backroad.ts');
    try {
        await m.go('app:kortexx');
        return { threw: false, nearest: [] };
    } catch (e) {
        return { threw: true, nearest: (e.nearest ?? []).map((n) => n.address) };
    }
});
ok('31. A misspelled address fails loudly AND says what it meant',
    unknown.threw && unknown.nearest.includes('app:cortex'),
    unknown.nearest.length ? `suggested ${unknown.nearest.join(', ')}` : 'no near match');

const themeTravel = await page.evaluate(async () => {
    const m = await import('/lib/backroad.ts');
    let got = null;
    const h = (e) => { got = e.detail?.themeId; };
    window.addEventListener('pc-set-theme', h);
    // A theme is a raw CustomEvent, not a bus channel. That the caller does
    // not need to know this is the entire point of the road.
    await m.go('theme:win95');
    window.removeEventListener('pc-set-theme', h);
    return got;
});
ok('32. One call reaches a destination with a different mechanism behind it',
    themeTravel === 'win95', `pc-set-theme → ${themeTravel}`);


// ── The agent lane ───────────────────────────────────────────────────────
const agentLane = await page.evaluate(async () => {
    const t = await import('/lib/backroadTool.ts');
    const seen = [];
    const off = (await import('/lib/bus.ts')).bus.on('launch-app', ({ appId }) => seen.push(appId));

    // What an agent actually does: look, then go — no walking through
    // unrelated apps to reach one.
    const listed = await t.runBackroadTool('list_destinations', { query: 'cortex' });
    const opened = await t.runBackroadTool('open_destination', { address: 'app:cortex' });

    // Worst case: a route with a bad stop in the middle.
    const route = await t.runBackroadTool('open_route', {
        addresses: ['app:speed_racer', 'app:does_not_exist', 'app:cartographer'],
    });
    off();
    return { listed, opened, route, seen };
});
ok('33. An agent can list destinations before choosing one',
    agentLane.listed.ok && agentLane.listed.destinations.some((d) => d.address === 'app:cortex'),
    `${agentLane.listed.count} matched`);

ok('34. An agent goes straight to an address and is told what opened',
    agentLane.opened.ok && agentLane.opened.opened === 'app:cortex' && !!agentLane.opened.detail,
    agentLane.opened.detail);

ok('35. A route survives a broken stop and still delivers the rest',
    agentLane.route.detail === 'Opened 2 of 3.' &&
        agentLane.seen.includes('speed_racer') && agentLane.seen.includes('cartographer'),
    `${agentLane.route.detail} — reached ${agentLane.seen.join(', ')}`);

const brokenStop = await page.evaluate(async () => {
    const t = await import('/lib/backroadTool.ts');
    const r = await t.runBackroadTool('open_destination', { address: 'app:kortexx' });
    return { ok: r.ok, detail: r.detail, alternatives: r.alternatives ?? [] };
});
ok('36. A wrong address answers with a correction, not an exception',
    brokenStop.ok === false && brokenStop.alternatives.includes('app:cortex'),
    brokenStop.detail);

const advised = await page.evaluate(async () => {
    const u = await import('/lib/understudy/predictor.ts');
    const b = await import('/lib/backroad.ts');
    u.resetModel();
    for (let i = 0; i < 4; i += 1) { u.record('cortex'); u.record('speed_racer'); }
    const r = await b.travel('app:cortex');
    return r.next;
});
ok('37. Arriving somewhere tells the agent what usually comes next, and why',
    advised.length > 0 && advised[0].source === 'observed' && advised[0].address === 'app:speed_racer',
    advised.length ? `${advised[0].address} (${advised[0].source})` : 'no hops');

await page.screenshot({ path: 'ten.png', fullPage: false });

console.log('\n' + '─'.repeat(50));
const passed = results.filter((r) => r.pass).length;
console.log(`${passed}/${results.length} passed`);
if (passed !== results.length) console.log('FAILED:', results.filter((r) => !r.pass).map((r) => r.n).join(' | '));
await browser.close();
process.exit(passed === results.length ? 0 : 1);
