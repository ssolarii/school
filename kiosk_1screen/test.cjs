const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.KIOSK_URL || 'http://127.0.0.1:8110/kiosk_1screen/');
  await page.locator('.pathway-choice').first().waitFor();
  assert.equal(await page.locator('.pathway-choice').count(), 3);
  assert(await page.evaluate(() => document.documentElement.scrollHeight === innerHeight));
  await page.screenshot({ path: process.env.TEMP + '/kiosk-1screen-1080.png', animations: 'disabled' });
  for (const id of ['science-tech', 'computer-science', 'engineering-manufacturing']) {
   await page.locator(`[data-pathway="${id}"]`).click();
   await page.waitForFunction(() => { const v = document.querySelector('video'); return v && !v.paused && v.currentTime > .2; }, { timeout: 30000 });
   assert.equal(await page.locator('video').evaluate(v => v.muted), false);
   assert.equal(await page.locator('video').evaluate(v => v.loop), false);
   assert.equal(page.context().pages().length, 1);
   if (id === 'engineering-manufacturing') {
    await page.locator('video').evaluate(v => v.dispatchEvent(new Event('ended')));
   } else await page.getByRole('button', { name: '← Back' }).click();
   await page.locator('.pathway-choice').first().waitFor();
   assert.equal(await page.locator('video').count(), 0);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-pathway="science-tech"]').click();
  assert.equal(await page.locator('.film').evaluate(e => getComputedStyle(e).animationDuration), '1e-05s');
  await page.keyboard.press('Escape');
  await page.locator('.pathway-choice').first().waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: 1080p layout, all films, audio, same-window playback, back/end return, Escape, reduced motion.');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
