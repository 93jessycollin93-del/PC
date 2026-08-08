import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const results = [];
const ok = (n,p,x='') => { results.push({n,p}); console.log(`${p?'PASS':'FAIL'}  ${n}${x?`  — ${x}`:''}`); };

async function fresh() {
  const page = await browser.newPage({ viewport:{width:1280,height:900} });
  page.on('pageerror', e => console.log('   PAGEERROR:', e.message.slice(0,120)));
  await page.goto('http://127.0.0.1:5174/', { waitUntil:'domcontentloaded', timeout:45000 });
  await page.waitForTimeout(5500);
  return page;
}
let page = await fresh();

// seed keys, then encrypt
let r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  kr.invalidate();
  kr.addKey('groq','SECRET_KEY_1','acct one');
  kr.addKey('gemini','SECRET_KEY_2','acct two');
  const before = kr.listKeys('groq').length + kr.listKeys('gemini').length;
  const res = await kr.enableEncryption('correct horse battery');
  return {
    before, res,
    plaintextGone: localStorage.getItem('jackie_keyring_v1') === null,
    cipherPresent: !!localStorage.getItem('jackie_keyring_encrypted_v1'),
    rawDump: JSON.stringify(localStorage).includes('SECRET_KEY_1'),
    stillUsable: kr.listKeys('groq').length,
  };
});
ok('1. encryption enables and removes the plaintext copy', r.res.ok && r.plaintextGone && r.cipherPresent, JSON.stringify(r.res));
ok('2. no key material anywhere in localStorage', r.rawDump === false, r.rawDump ? 'LEAK!' : 'clean');
ok('3. keys still usable in the same session', r.stillUsable === 1, `${r.stillUsable}`);

// reload -> must be locked, and no keys visible
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(4000);
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts'); kr.invalidate();
  return { locked: kr.isLocked(), encrypted: kr.isEncrypted(), keys: kr.listKeys('groq').length, hasAny: kr.hasAnyKey() };
});
ok('4. reload re-locks the vault', r.locked && r.encrypted, `locked=${r.locked}`);
ok('5. locked vault exposes no keys', r.keys === 0 && !r.hasAny, `keys=${r.keys}`);

// gateway must refuse cleanly while locked, not crash
r = await page.evaluate(async () => {
  const { chat } = await import('/lib/ai/gateway.ts');
  try { await chat({ messages:[{role:'user',content:'hi'}] }); return 'unexpected success'; }
  catch (e) { return e.message; }
});
ok('6. gateway fails cleanly while locked', /No AI provider is set up|could not answer/.test(r), r.slice(0,60));

// wrong passphrase changes nothing
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  const bad = await kr.unlock('wrong passphrase');
  return { bad, stillLocked: kr.isLocked(), keys: kr.listKeys('groq').length };
});
ok('7. wrong passphrase rejected, vault stays locked', r.bad.ok === false && r.stillLocked, r.bad.error||'');

// correct passphrase restores everything
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  const good = await kr.unlock('correct horse battery');
  const g = kr.listKeys('groq'), m = kr.listKeys('gemini');
  return { good, groq: g[0]?.key, groqLabel: g[0]?.label, gemini: m[0]?.key, locked: kr.isLocked() };
});
ok('8. correct passphrase unlocks and restores keys+labels',
   r.good.ok && r.groq==='SECRET_KEY_1' && r.groqLabel==='acct one' && r.gemini==='SECRET_KEY_2' && !r.locked,
   `${r.groq}/${r.gemini}`);

// edits while unlocked must persist encrypted (not leak plaintext)
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  kr.addKey('groq','SECRET_KEY_3','acct three');
  await new Promise(res => setTimeout(res, 400));
  return { plaintext: localStorage.getItem('jackie_keyring_v1'), leak: JSON.stringify(localStorage).includes('SECRET_KEY_3') };
});
ok('9. edits while unlocked stay encrypted on disk', r.plaintext === null && r.leak === false, r.leak ? 'LEAK!' : 'clean');

// and survive a reload + unlock
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(4000);
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts'); kr.invalidate();
  await kr.unlock('correct horse battery');
  return kr.listKeys('groq').map(k=>k.key);
});
ok('10. the new key survives lock → reload → unlock', r.includes('SECRET_KEY_3'), JSON.stringify(r));

// lock now, then disable requires unlock
r = await page.evaluate(async () => {
  const kr = await import('/lib/ai/keyring.ts');
  kr.lockNow();
  const refused = kr.disableEncryption();
  await kr.unlock('correct horse battery');
  const allowed = kr.disableEncryption();
  return { refused, allowed, encrypted: kr.isEncrypted(), keys: kr.listKeys('groq').length,
           plaintextBack: !!localStorage.getItem('jackie_keyring_v1') };
});
ok('11. disabling while locked is refused (would destroy keys)', r.refused.ok === false, r.refused.error||'');
ok('12. disabling while unlocked restores plaintext keyring', r.allowed.ok && !r.encrypted && r.keys===2 && r.plaintextBack, `keys=${r.keys}`);

// UI
await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForTimeout(4500);
await page.evaluate(() => window.dispatchEvent(new CustomEvent('launch-app',{detail:{appId:'api_keys'}})));
await page.waitForTimeout(3500);
await page.locator('button:has-text("security")').first().click();
await page.waitForTimeout(1200);
const seen = await page.locator('text=What encryption here buys you').count();
const honest = await page.locator('text=/Does not protect/').count();
const noRecovery = await page.locator('text=/No recovery/').count();
ok('13. Security tab states protections AND limits', seen>0 && honest>0 && noRecovery>0, `panel=${seen} limits=${honest} recovery=${noRecovery}`);
const gated = await page.locator('button:has-text("Encrypt my keys")').first().isDisabled();
ok('14. cannot encrypt before downloading a backup', gated === true, gated ? 'gated' : 'NOT gated');
await page.screenshot({ path:'vault.png' });

console.log('\n' + '─'.repeat(50));
const passed = results.filter(x=>x.p).length;
console.log(`${passed}/${results.length} passed`);
if (passed !== results.length) console.log('FAILED:', results.filter(x=>!x.p).map(x=>x.n).join(' | '));
await browser.close();
process.exit(passed===results.length?0:1);
