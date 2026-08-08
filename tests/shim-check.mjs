import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,160)));
let groqFail = {};  // key -> status; per-key so rotation is observable
for (const p of ['**://api.groq.com/**','**://generativelanguage.googleapis.com/**']) {
  await page.route(p, (route) => {
    const url = route.request().url();
    const key = (route.request().headers()['authorization']||'').replace(/^Bearer\s+/i,'');
    if (url.includes('groq') && url.includes('chat/completions')) {
      if (groqFail[key] === 429) return route.fulfill({status:429, contentType:'application/json', body:'{"error":{"message":"limit"}}'});
      return route.fulfill({status:200, contentType:'application/json', body: JSON.stringify({choices:[{message:{content:`shim-ok-${key}`}}]})});
    }
    return route.fulfill({status:200, contentType:'application/json', body: JSON.stringify({data:[{id:'llama-3.3-70b-versatile'}]})});
  });
}
await page.goto('http://127.0.0.1:5174/', { waitUntil:'domcontentloaded', timeout:45000 });
await page.waitForTimeout(5500);

const r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  kr.invalidate();
  kr.addKey('groq','SHIM_A','a'); kr.addKey('groq','SHIM_B','b');
  const { getAiClient } = await import('/lib/gemini.ts');
  const ai = getAiClient();
  // The exact call shape 25 roster apps use.
  const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'say hi' });
  return { text: res.text, hasCandidates: Array.isArray(res.candidates) };
});
console.log(r.text === 'shim-ok-SHIM_A' ? 'PASS' : 'FAIL', '1. roster app reaches a provider via the keyring —', r.text);
console.log(r.hasCandidates ? 'PASS' : 'FAIL', '2. legacy candidates[] shape preserved');

groqFail = { SHIM_A: 429 };  // only the first key is limited
const r2 = await page.evaluate(async () => {
  const { getAiClient } = await import('/lib/gemini.ts');
  const res = await getAiClient().models.generateContent({ contents: [{ role:'user', parts:[{text:'again'}] }] });
  return res.text;
});
console.log(r2 === 'shim-ok-SHIM_B' ? 'PASS' : 'FAIL', '3. roster app rotates keys on 429 —', r2);
await browser.close();
