const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const root = process.env.KIOSK_ROOT || 'http://127.0.0.1:8110/';
const ids = ['science-tech', 'computer-science', 'engineering-manufacturing'];

async function waitForFilm(page, id) {
  await page.waitForFunction(() => {
    const v = document.querySelector('video');
    const retry = document.querySelector('.play-overlay:not([hidden])');
    return v && ((!v.paused && v.currentTime > .1) || retry);
  }, null, { timeout: 20000 });
  const play = page.locator('.play-overlay:visible');
  if (await play.count()) await play.click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > .1);
  const playback = await page.locator('video').evaluate(v => ({ muted: v.muted, loop: v.loop, src: v.currentSrc }));
  assert.equal(playback.muted, false);
  assert.equal(playback.loop, false);
  assert(playback.src.includes(({ 'science-tech': 'healthscience', 'computer-science': 'cs', 'engineering-manufacturing': 'engineering' })[id] + '_final.mp4'));
}

async function verifyCycle(viewer) {
  for (const id of ids) {
    await viewer.locator('.intermission').waitFor();
    await waitForFilm(viewer, id);
    await viewer.evaluate(() => {
      window.departing = document.querySelector('video');
      window.departing.dispatchEvent(new Event('ended'));
    });
    await viewer.locator('.intermission').waitFor();
    assert(await viewer.evaluate(() => window.departing.paused && !window.departing.getAttribute('src')));
  }
  assert((await viewer.locator('.intermission h1').textContent()).includes('Health & Sustainable'));
}

async function run(browser, single) {
  const context = await browser.newContext({ viewport: single ? { width: 1920, height: 1080 } : { width: 1280, height: 720 } });
  try {
    await context.addInitScript(() => {
      try { localStorage.setItem('itzat-kiosk-settings-v1', JSON.stringify({ autoplayInterludeSeconds: 5 })); }
      catch { /* The initial about:blank document has no storage origin. */ }
    });
    const errors = [];
    context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
    const page = await context.newPage();
    await page.goto(new URL(single ? 'kiosk_1screen/' : 'kiosk/', root).href);
    let viewer = page;
    if (single) await page.getByRole('link', { name: 'autoplay', exact: true }).click();
    else {
      const popup = page.waitForEvent('popup');
      await page.getByRole('link', { name: 'autoplay', exact: true }).click();
      viewer = await popup;
    }
    await viewer.locator('.intermission').waitFor();
    await viewer.screenshot({ path: process.env.TEMP + `/kiosk-autoplay-${single ? '1080' : '720'}.png`, animations: 'disabled' });
    assert(await viewer.locator('.intermission__feature').evaluate(el => el.getBoundingClientRect().bottom < innerHeight));
    await verifyCycle(viewer);
    await viewer.locator('.intermission').click({ position: { x: 20, y: 20 } });
    await page.locator('.pathway-choice').first().waitFor();
    assert.equal(await viewer.locator('video').count(), 0);

    // An exit tap during a film also stops audio and cannot start another action.
    await page.getByRole('link', { name: 'autoplay', exact: true }).click();
    await viewer.locator('.intermission').waitFor();
    await viewer.waitForFunction(() => document.querySelector('video'));
    const play = viewer.locator('.play-overlay:visible');
    if (await play.count()) await play.click();
    if (single) await viewer.locator('video').click({ position: { x: 30, y: 30 } });
    else await page.locator('body').click({ position: { x: 8, y: 8 } });
    await page.locator('.pathway-choice').first().waitFor();
    await viewer.waitForFunction(() => !document.querySelector('video') && !document.querySelector('.intermission'));
    await viewer.waitForTimeout(5500);
    assert.equal(await viewer.locator('.intermission, .film, .presentation-stage').count(), 0);

    // Existing tap-to-select and back behavior still works after leaving autoplay.
    await page.locator('[data-pathway="computer-science"]').click();
    await waitForFilm(viewer, 'computer-science');
    if (single) await page.getByRole('button', { name: '← Back' }).click();
    else await page.getByRole('button', { name: 'Back to pathways', exact: true }).click();
    await page.locator('.pathway-choice').first().waitFor();
    if (!single) {
      await page.getByRole('link', { name: 'autoplay', exact: true }).click();
      await viewer.locator('.intermission').waitFor();
      await viewer.reload();
      await viewer.locator('.intermission').waitFor();
      await viewer.keyboard.press('Escape');
      await page.locator('.pathway-choice').first().waitFor();
    }
    await viewer.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('link', { name: 'autoplay', exact: true }).click();
    await viewer.locator('.intermission').waitFor();
    assert.equal(await viewer.locator('.intermission__image img').evaluate(el => getComputedStyle(el).animationName), 'none');
    await viewer.keyboard.press('Escape');
    await page.locator('.pathway-choice').first().waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS ${single ? 'single-screen' : 'two-screen'}: all three films, wraparound, sound, intermissions, exit taps, and manual selection.`);
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=document-user-activation-required'] });
  try { await Promise.all([run(browser, true), run(browser, false)]); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
