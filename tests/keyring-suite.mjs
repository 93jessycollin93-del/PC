import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const results = [];
const ok = (n, pass, extra='') => { results.push({n, pass, extra}); console.log(`${pass?'PASS':'FAIL'}  ${n}${extra?`  — ${extra}`:''}`); };

// Groq behaviour is driven per-key so we can force rotation deterministically.
let groqBehaviour = {};   // key -> 'ok' | 429 | 401
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => console.log('   PAGEERROR:', e.message.slice(0,120)));
  const PROVIDER_HOSTS = [
    '**://openrouter.ai/**','**://generativelanguage.googleapis.com/**','**://api.groq.com/**',
    '**://api.cerebras.ai/**','**://api.mistral.ai/**','**://models.inference.ai.azure.com/**',
    '**://router.huggingface.co/**','**://api.openai.com/**','**://api.anthropic.com/**',
    '**://api.deepseek.com/**','**://api.x.ai/**','**://api.together.xyz/**','**://acme.test/**',
  ];
  const handler = async (route) => {
    const url = route.request().url();
    const auth = route.request().headers()['authorization'] || route.request().headers()['x-goog-api-key'] || '';
    const key = auth.replace(/^Bearer\s+/i,'');
    if (url.includes('api.groq.com') && url.includes('chat/completions')) {
      const b = groqBehaviour[key] ?? 'ok';
      if (b === 429) return route.fulfill({ status:429, headers:{'retry-after':'30'}, contentType:'application/json', body: JSON.stringify({error:{message:'rate limit'}}) });
      if (b === 401) return route.fulfill({ status:401, contentType:'application/json', body: JSON.stringify({error:{message:'invalid key'}}) });
      return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ choices:[{message:{content:`ok-from-${key}`}}] }) });
    }
    if (url.includes('acme.test')) {
      return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ choices:[{message:{content:'ok-from-acme'}}] }) });
    }
    if (url.includes('/models')) return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ data:[{id:'llama-3.3-70b-versatile'}] }) });
    return route.fulfill({ status:401, contentType:'application/json', body: JSON.stringify({error:{message:'no key'}}) });
  };
  for (const pattern of PROVIDER_HOSTS) await page.route(pattern, handler);
  await page.goto('http://127.0.0.1:5174/', { waitUntil:'domcontentloaded', timeout:45000 });
  await page.waitForTimeout(5500);
  return page;
}

let page = await newPage();

// ── 1. legacy migration: old flat key must become usable
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('groq_api_key','LEGACY123'); });
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(3000);
let r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  kr.invalidate(); kr.migrate();
  return kr.listKeys('groq').map(k => k.key);
});
ok('1. legacy groq_api_key migrates into keyring', r.includes('LEGACY123'), JSON.stringify(r));

// ── 2. multiple keys per provider + persistence across reload
await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  kr.addKey('groq','KEY_A','account A');
  kr.addKey('groq','KEY_B','account B');
  kr.addKey('groq','KEY_C','account C');
});
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(3000);
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts'); kr.invalidate();
  return kr.listKeys('groq').map(k => `${k.label||'-'}:${k.key}`);
});
ok('2. multiple keys saved and survive reload', r.length === 4 && r.some(x=>x.includes('KEY_C')), `${r.length} keys`);

// ── 3. duplicate keys are not stacked
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  const before = kr.listKeys('groq').length;
  kr.addKey('groq','KEY_A');
  return { before, after: kr.listKeys('groq').length };
});
ok('3. duplicate key rejected', r.before === r.after, `${r.before} -> ${r.after}`);

// ── 4. STICKY: first healthy key is used, repeatedly
groqBehaviour = {};
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts'); kr.invalidate();
  // leave only A,B,C in a known order
  for (const k of kr.listKeys('groq')) if (!['KEY_A','KEY_B','KEY_C'].includes(k.key)) kr.removeKey('groq', k.id);
  const { chat } = await import('/lib/ai/gateway.ts');
  const a = await chat({ messages:[{role:'user',content:'x'}], model:'groq:llama-3.3-70b-versatile' });
  const b = await chat({ messages:[{role:'user',content:'x'}], model:'groq:llama-3.3-70b-versatile' });
  return [a.text, b.text];
});
ok('4. sticky — same key used twice', r[0]==='ok-from-KEY_A' && r[1]==='ok-from-KEY_A', r.join(', '));

// ── 5. ROTATION: A rate-limits -> B answers, automatically
groqBehaviour = { KEY_A: 429 };
r = await page.evaluate(async () => {
  const { chat } = await import('/lib/ai/gateway.ts');
  const res = await chat({ messages:[{role:'user',content:'x'}], model:'groq:llama-3.3-70b-versatile' });
  const kr = await import('/lib/ai/keyring.ts');
  const a = kr.listKeys('groq').find(k=>k.key==='KEY_A');
  return { text: res.text, aStatus: a.status, cooling: !!(a.cooldownUntil && a.cooldownUntil > Date.now()) };
});
ok('5. rotation — 429 on A falls through to B', r.text==='ok-from-KEY_B', r.text);
ok('6. cooled key marked + Retry-After honoured', r.aStatus==='cooling' && r.cooling, `status=${r.aStatus}`);

// ── 7. cooling key is SKIPPED on the next call (no wasted request)
r = await page.evaluate(async () => {
  const { chat } = await import('/lib/ai/gateway.ts');
  const res = await chat({ messages:[{role:'user',content:'x'}], model:'groq:llama-3.3-70b-versatile' });
  return { text: res.text, attempts: res.attempts.length };
});
ok('7. cooling key skipped entirely', r.text==='ok-from-KEY_B' && r.attempts===0, `attempts=${r.attempts}`);

// ── 8. rejected key (401) taken out of rotation
groqBehaviour = { KEY_A: 429, KEY_B: 401 };
r = await page.evaluate(async () => {
  const { chat } = await import('/lib/ai/gateway.ts');
  const res = await chat({ messages:[{role:'user',content:'x'}], model:'groq:llama-3.3-70b-versatile' });
  const kr = await import('/lib/ai/keyring.ts');
  return { text: res.text, b: kr.listKeys('groq').find(k=>k.key==='KEY_B').status };
});
ok('8. 401 key rejected, next key answers', r.text==='ok-from-KEY_C' && r.b==='rejected', `${r.text} b=${r.b}`);

// ── 9. custom provider ("Others") works end to end
r = await page.evaluate(async () => {
  const cp = await import('/lib/ai/customProviders.ts');
  const saved = cp.saveCustomProvider({ label:'Acme AI', endpoint:'https://acme.test/v1/chat/completions', wire:'openai', authKind:'bearer', seedModels:['acme-large'] });
  const kr = await import('/lib/ai/keyring.ts');
  kr.addKey(saved.id, 'ACME_KEY');
  const { chat } = await import('/lib/ai/gateway.ts');
  const res = await chat({ messages:[{role:'user',content:'x'}], model:`${saved.id}:acme-large` });
  return { text: res.text, provider: res.provider };
});
ok('9. custom provider answers via gateway', r.text==='ok-from-acme', `${r.provider}`);

// ── 10. custom provider validation rejects http
r = await page.evaluate(async () => {
  const cp = await import('/lib/ai/customProviders.ts');
  return cp.saveCustomProvider({ label:'Bad', endpoint:'http://insecure.example/v1/chat', wire:'openai', authKind:'bearer', seedModels:['x'] });
});
ok('10. http endpoint rejected with a reason', r.ok===false && /https/i.test(r.error||''), r.error||'');

// ── 11. export / import round trip
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  const dump = kr.exportKeyring();
  const before = kr.listKeys('groq').length;
  localStorage.removeItem('jackie_keyring_v1'); kr.invalidate();
  const cleared = kr.listKeys('groq').length;
  const res = kr.importKeyring(dump);
  return { before, cleared, after: kr.listKeys('groq').length, added: res.added };
});
ok('11. export → wipe → import restores keys', r.cleared===0 && r.after===r.before, `${r.before}→${r.cleared}→${r.after}`);

// ── 12-14. the UI, on a fresh page so earlier tests cannot bleed into it
await page.close();
page = await newPage();
// Seed a known pool so the counts are predictable.
await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  kr.invalidate();
  kr.addKey('groq','UI_KEY_1','first account');
  kr.addKey('groq','UI_KEY_2','second account');
});
await page.evaluate(() => window.dispatchEvent(new CustomEvent('launch-app',{detail:{appId:'api_keys'}})));
await page.waitForTimeout(4000);
ok('12. API Keys app opens and reports the pool size',
   (await page.locator('text=/keys? stored/').count()) > 0 && (await page.locator('text=Test every key').count()) > 0,
   (await page.locator('text=/\\d+ keys? stored/').first().innerText().catch(()=>'')) || '');

await page.locator('button:has-text("Groq")').first().click();
await page.waitForTimeout(1200);
const addRow = await page.locator('input[placeholder*="add another key"]').count();
const labels = await page.locator('input[value="first account"], input[value="second account"]').count();
ok('13. provider expands: both keys + an add-another row', addRow > 0 && labels === 2,
   `addRow=${addRow} labelledKeys=${labels}`);

await page.locator('button:has-text("others")').first().click();
await page.waitForTimeout(1200);
ok('14. Others tab offers a custom provider builder',
   (await page.locator('text=Add a provider').count()) > 0 &&
   (await page.locator('option:has-text("OpenAI-compatible")').count()) > 0, '');
await page.screenshot({ path: 'keys.png' });

console.log('\n' + '─'.repeat(50));
const passed = results.filter(r=>r.pass).length;
console.log(`${passed}/${results.length} passed`);
if (passed !== results.length) console.log('FAILED:', results.filter(r=>!r.pass).map(r=>r.n).join(' | '));
await browser.close();
process.exit(passed === results.length ? 0 : 1);
