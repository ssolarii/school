// Development-only browser integration test. All credentials below are dummy fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const crypto = require('../vault-crypto.js');
const root = path.resolve(__dirname, '..');
const prefix = '/school/deepdive/';
const dummyKey = 'sk-or-v1-' + 'd'.repeat(64);
const dummyPassword = 'Browser test fixture, not the staff password';

async function run() {
  // The real published vault must validate, but this test never decrypts it.
  crypto.validateVault(JSON.parse(fs.readFileSync(path.join(root, 'ai-key.vault.json'), 'utf8')));
  const fixture = await crypto.encryptKey(dummyKey, dummyPassword);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const file = path.resolve(root, decodeURIComponent(pathname.slice(prefix.length)) || 'index.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, body) => {
      if (error) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.route('**/ai-key.vault.json', route => route.fulfill({ json: fixture }));
    const calls = [];
    let responseMode = 'valid';
    await context.route('https://openrouter.ai/api/v1/chat/completions', async route => {
      const request = route.request();
      const body = request.postDataJSON();
      assert.equal(request.headers().authorization, 'Bearer ' + dummyKey);
      assert.equal(body.reasoning.enabled, false);
      assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0, request: 0, image: 0 });
      assert.deepEqual(body.plugins, [{ id: 'web', enabled: false }]);
      calls.push(body);
      if (responseMode === 'fail-primary' && body.model.startsWith('nvidia/')) {
        await route.fulfill({ status: 503, json: { error: 'Fixture provider unavailable' } }); return;
      }
      const verdict = responseMode === 'uncertain-rejection'
        ? { valid: false, depth: 0, confidence: 'medium', explanation: 'This answer needs a guide.' }
        : { valid: true, depth: 600, confidence: 'high', explanation: 'Erlang is a programming language.' };
      await route.fulfill({ json: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(verdict) } }] } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}${prefix}`;
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.DeepDiveVault.hasVault());
    await page.getByRole('button', { name: 'Table settings', exact: true }).click();
    await page.getByLabel('AI review', { exact: true }).selectOption('openrouter');
    await page.getByLabel('Staff password', { exact: true }).fill('Wrong fixture passphrase');
    await page.getByRole('button', { name: 'Unlock free AI', exact: true }).click();
    await page.locator('#ai-vault-status').filter({ hasText: 'password is incorrect' }).waitFor();
    assert.equal(await page.locator('#ai-vault-password').inputValue(), '');
    await page.getByLabel('Staff password', { exact: true }).fill(dummyPassword);
    await page.getByRole('button', { name: 'Unlock free AI', exact: true }).click();
    await page.getByRole('button', { name: 'Lock free AI', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.DeepDiveAI.getSettings().format), 'openrouter');
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    assert(!stored.includes(dummyKey)); assert(!stored.includes(dummyPassword));
    assert.equal(await page.locator('#ai-vault-password').inputValue(), '');
    await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await page.locator('#ai-settings-status').filter({ hasText: 'Connection works' }).waitFor();
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(calls[0].messages[1].content).visitor_answer, 'Erlang');
    await page.screenshot({ path: path.resolve(root, '../../deep-dive-staff-access.png') });
    await page.getByRole('button', { name: 'Lock free AI', exact: true }).click();
    assert.equal(await page.evaluate(() => window.DeepDiveVault.getKey()), null);
    const locked = await page.evaluate(async () => {
      try { await window.DeepDiveAI.review(window.DEEP_DIVE_QUESTIONS.find(q => q.id === 'language'), 'Erlang'); }
      catch (error) { return error.message; }
    });
    assert.match(locked, /locked/); assert.equal(calls.length, 1);
    await page.getByLabel('Staff password', { exact: true }).fill(dummyPassword);
    await page.getByLabel('Staff password', { exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Lock free AI', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close table settings', exact: true }).click();
    responseMode = 'fail-primary'; calls.length = 0;
    const backup = await page.evaluate(() => window.DeepDiveAI.review(window.DEEP_DIVE_QUESTIONS.find(q => q.id === 'language'), 'Erlang'));
    assert.equal(backup.valid, true); assert.equal(calls.length, 2);
    assert.equal(calls[1].model, 'cohere/north-mini-code:free');
    responseMode = 'uncertain-rejection'; calls.length = 0;
    const uncertain = await page.evaluate(() => window.DeepDiveAI.review(window.DEEP_DIVE_QUESTIONS.find(q => q.id === 'language'), 'Erlang'));
    assert.equal(uncertain.needsReview, true); assert.equal(calls.length, 1);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.DeepDiveVault.hasVault());
    assert.equal(await page.evaluate(() => window.DeepDiveVault.isUnlocked()), false);
    await page.getByRole('button', { name: 'Table settings', exact: true }).click();
    assert.equal(await page.locator('#ai-format').inputValue(), 'openrouter');
    assert(await page.getByLabel('Staff password', { exact: true }).isVisible());
    assert.equal(await page.locator('#ai-vault-password').inputValue(), '');
    assert.deepEqual(errors, []);
    console.log('PASS: nested Pages path, wrong-password retry, unlock, real-probe contract, free backup, uncertain rejection, lock, reload, no secrets in storage, no page errors (1280x720).');

    const empty = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await empty.route('**/ai-key.vault.json', route => route.fulfill({ status: 404 }));
    const mobile = await empty.newPage();
    await mobile.goto(base, { waitUntil: 'networkidle' });
    await mobile.getByRole('button', { name: 'Table settings', exact: true }).click();
    await mobile.getByLabel('AI review', { exact: true }).selectOption('openrouter');
    await mobile.locator('#ai-vault-status').filter({ hasText: 'not been configured' }).waitFor();
    assert.equal(await mobile.getByRole('button', { name: 'Unlock free AI', exact: true }).isEnabled(), false);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log('PASS: missing-vault message and disabled unlock, narrow-screen layout (390x844).');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
