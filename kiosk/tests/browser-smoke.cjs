const { chromium } = require('playwright');
const assert = require('node:assert/strict');

// Run against a local server or the published GitHub Pages URL.
const base = process.env.KIOSK_URL || 'http://127.0.0.1:8098/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--autoplay-policy=document-user-activation-required'] });
  try {
    for (const mode of (process.env.KIOSK_TEST_MODE ? [process.env.KIOSK_TEST_MODE] : ['normal', 'postMessage-only', 'channel-send-fails'])) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      context.setDefaultTimeout(15000);
      context.setDefaultNavigationTimeout(20000);
      if (mode !== 'normal') await context.addInitScript(mode => {
        if (mode === 'postMessage-only') delete window.BroadcastChannel;
        else BroadcastChannel.prototype.postMessage = () => { throw new DOMException('Channel unavailable', 'InvalidStateError'); };
        Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } });
      }, mode);
      const errors = [];
      context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
      const page = await context.newPage();
      await page.goto(base);
      console.log(`${mode}: controller loaded`);
      await page.waitForLoadState('networkidle');
      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('button', { name: 'Open window 2', exact: true }).click();
      const tv = await popupPromise;
      await tv.waitForLoadState('networkidle');
      console.log(`${mode}: display loaded`);
      await page.waitForFunction(() => document.querySelector('#display-controls').hidden);
      for (const id of ['science-tech', 'computer-science', 'engineering-manufacturing']) {
        await page.locator(`[data-pathway="${id}"]`).click();
        console.log(`${mode}: selected ${id}`);
        await tv.waitForFunction(() => {
          const v = document.querySelector('video');
          return v && v.readyState >= 3 && !v.paused && v.currentTime > .5 && v.videoWidth > 0;
        }, null, { timeout: 15000 });
        const before = await tv.locator('video').evaluate(v => v.currentTime);
        await tv.waitForTimeout(1200);
        const after = await tv.locator('video').evaluate(v => v.currentTime);
        assert.ok(after > before, `${mode}: video time must advance`);
        if (process.env.KIOSK_TEST_PAUSE === '1') {
          await tv.locator('video').evaluate(v => v.pause());
          await tv.waitForFunction(() => !document.querySelector('video')?.paused, null, { timeout: 7000 });
        }
        assert.equal(await tv.getByRole('button', { name: /return to pathways/i }).count(), 0);
        assert.equal(await tv.getByRole('button', { name: 'Fullscreen', exact: true }).isVisible(), false);
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
        await page.getByRole('button', { name: 'Back to pathways', exact: true }).click();
        await tv.waitForFunction(() => !document.querySelector('video'));
      }
      await page.locator('[data-pathway="computer-science"]').click();
      await tv.reload();
      await tv.waitForFunction(() => document.querySelector('video')?.currentTime > .5);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#display-controls').hidden);
      await tv.waitForFunction(() => !document.querySelector('video'));
      if (mode === 'normal') {
        // An autoplay permission rejection must offer a working, gesture-driven recovery.
        await tv.evaluate(() => {
          window.originalPlay = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function () {
            this.pause();
            return Promise.reject(new DOMException('Permission needed', 'NotAllowedError'));
          };
        });
        await page.locator('[data-pathway="science-tech"]').click();
        await tv.getByRole('button', { name: 'Tap to play video', exact: true }).waitFor();
        await tv.evaluate(() => { HTMLMediaElement.prototype.play = window.originalPlay; });
        await tv.getByRole('button', { name: 'Tap to play video', exact: true }).click();
        await tv.waitForFunction(() => document.querySelector('video')?.currentTime > .5);
        await page.getByRole('button', { name: 'Back to pathways', exact: true }).click();
        await tv.waitForFunction(() => !document.querySelector('video'));
        // A failed file load is not an autoplay error; retry must fetch the file again.
        await tv.route('**/computer-science-sample.mp4', route => route.abort());
        await page.locator('[data-pathway="computer-science"]').click();
        await tv.getByRole('button', { name: 'Video could not load. Tap to retry', exact: true }).waitFor();
        await tv.unroute('**/computer-science-sample.mp4');
        await tv.getByRole('button', { name: 'Video could not load. Tap to retry', exact: true }).click();
        await tv.waitForFunction(() => document.querySelector('video')?.currentTime > .5);
        // Denied fullscreen must leave the existing film playing, not rebuild it.
        await tv.setViewportSize({ width: 1024, height: 768 });
        await tv.evaluate(() => {
          window.existingVideo = document.querySelector('video');
          document.documentElement.requestFullscreen = () => Promise.reject(new Error('Denied'));
        });
        await tv.getByRole('button', { name: 'Fullscreen', exact: true }).click();
        assert.ok(await tv.evaluate(() => document.querySelector('video') === window.existingVideo && !window.existingVideo.paused));
        await tv.setViewportSize({ width: 1280, height: 720 });
        if (process.env.KIOSK_SCREENSHOT_DIR) {
          await page.screenshot({ path: `${process.env.KIOSK_SCREENSHOT_DIR}/kiosk-selected.png` });
          await tv.screenshot({ path: `${process.env.KIOSK_SCREENSHOT_DIR}/tv-playing.png` });
        }
        // Live settings update both windows, including banner hiding and idle video.
        const settingsPage = await context.newPage();
        await settingsPage.goto(new URL('settings/', base).href);
        await settingsPage.locator('[name="banners"]').selectOption('none');
        await settingsPage.locator('form').evaluate(form => form.requestSubmit());
        await tv.waitForFunction(() => !document.querySelector('.presentation-top') && !document.querySelector('.presentation-caption'));
        await settingsPage.locator('[name="idleVideoEnabled"]').check();
        await settingsPage.locator('form').evaluate(form => form.requestSubmit());
        await page.getByRole('button', { name: 'Back to pathways', exact: true }).click();
        await tv.waitForFunction(() => !!document.querySelector('.idle-video-stage video')?.currentTime);
        await settingsPage.locator('#reset').click();
        await tv.waitForFunction(() => !document.querySelector('video'));
        await settingsPage.close();
        // Advance the controller's clock rather than shortening the real 90-second configuration.
        await page.clock.install();
        await page.locator('[data-pathway="science-tech"]').click();
        await tv.waitForFunction(() => !!document.querySelector('video'));
        await page.clock.fastForward(91000);
        await tv.waitForFunction(() => !document.querySelector('video'));
        await page.clock.resume();
        console.log('PASS autoplay recovery, failed-file retry, fullscreen denial, live settings, idle film, timed return');
      }
      await tv.close();
      await page.waitForFunction(() => !document.querySelector('#display-controls').hidden, null, { timeout: 15000 });
      assert.deepEqual(errors, []);
      if (mode === 'normal') {
        await page.evaluate(() => { window.open = () => null; });
        await page.getByRole('button', { name: 'Open window 2', exact: true }).click();
        assert.ok(await page.getByText('Allow popups for this page, then try again.', { exact: true }).isVisible());
      }
      console.log(`PASS ${mode}: all videos advance, pairing, TV reload, controller reload, return, disconnect, 720p`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
