const { chromium } = require('playwright');
const assert = require('node:assert/strict');

// Run against a local server or the published GitHub Pages URL.
const base = process.env.KIOSK_URL || 'http://127.0.0.1:8098/';
async function allowSoundIfNeeded(tv) {
  await tv.waitForFunction(() => {
    const video = document.querySelector('video');
    return video && ((!video.paused && video.currentTime > .1) || document.querySelector('[data-action="play-video"]'));
  }, null, { timeout: 30000 });
  const play = tv.locator('[data-action="play-video"]');
  if (await play.count()) await play.click();
}
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
        await allowSoundIfNeeded(tv);
        await tv.waitForFunction(() => {
          const v = document.querySelector('video');
          return v && v.readyState >= 3 && !v.paused && v.currentTime > .5 && v.videoWidth > 0;
        }, null, { timeout: 15000 });
        const before = await tv.locator('video').evaluate(v => v.currentTime);
        await tv.waitForTimeout(1200);
        const after = await tv.locator('video').evaluate(v => v.currentTime);
        assert.ok(after > before, `${mode}: video time must advance`);
        const playback = await tv.locator('video').evaluate(v => ({ muted: v.muted, loop: v.loop, src: v.currentSrc, duration: v.duration }));
        assert.equal(playback.muted, id === 'computer-science');
        assert.equal(playback.loop, id === 'computer-science');
        if (id !== 'computer-science') assert.ok(playback.duration > 50 && playback.src.includes('_final.mp4'));
        assert.equal(await tv.locator('.presentation-top, .presentation-caption, .presentation-shade').count(), 0);
        if (process.env.KIOSK_TEST_PAUSE === '1') {
          await tv.locator('video').evaluate(v => v.pause());
          await tv.waitForFunction(() => !document.querySelector('video')?.paused, null, { timeout: 7000 });
        }
        assert.equal(await tv.getByRole('button', { name: /return to pathways/i }).count(), 0);
        assert.equal(await tv.getByRole('button', { name: 'Fullscreen', exact: true }).isVisible(), false);
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
        await tv.evaluate(() => { window.departingVideo = document.querySelector('video'); });
        await page.getByRole('button', { name: 'Back to pathways', exact: true }).click();
        await tv.waitForFunction(() => !document.querySelector('video'));
        assert.ok(await tv.evaluate(() => window.departingVideo.paused));
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
        await tv.getByRole('button', { name: 'Tap to play with sound', exact: true }).waitFor();
        await tv.evaluate(() => { HTMLMediaElement.prototype.play = window.originalPlay; });
        await tv.getByRole('button', { name: 'Tap to play with sound', exact: true }).click();
        await tv.waitForFunction(() => document.querySelector('video')?.currentTime > .5);
        // Observe the real ended event; allow network buffering of the original 1080p film.
        await tv.locator('video').evaluate(v => {
          window.filmEnded = false;
          v.addEventListener('ended', () => { window.filmEnded = true; }, { once: true });
          v.playbackRate = 4;
        });
        try { await tv.waitForFunction(() => window.filmEnded, null, { timeout: 70000 }); }
        catch (error) {
          console.error('Film end diagnostic:', await tv.evaluate(() => {
            const v = document.querySelector('video');
            return v ? { time: v.currentTime, duration: v.duration, paused: v.paused, ended: v.ended, readyState: v.readyState, buffered: v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0 } : { videoRemoved: true, filmEnded: window.filmEnded };
          }));
          throw error;
        }
        await page.locator('.pathway-grid').waitFor();
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
        // Old saved banner preferences must never overlay the finished films.
        await page.evaluate(() => localStorage.setItem('itzat-kiosk-settings-v1', JSON.stringify({ banners: 'both', bottomText: 'Old banner' })));
        assert.equal(await tv.locator('.presentation-top, .presentation-caption, .presentation-shade').count(), 0);
        // Live settings still update the idle video and touchscreen text.
        const settingsPage = await context.newPage();
        await settingsPage.goto(new URL('settings/', base).href);
        await settingsPage.locator('[name="kioskHeading"]').fill('Choose your next pathway');
        await settingsPage.locator('form').evaluate(form => form.requestSubmit());
        await settingsPage.waitForFunction(() => document.querySelector('#save-status').textContent.startsWith('Saved.'));
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
        console.log('PASS sound permission, completed-film return, failed-file retry, fullscreen denial, legacy banner removal, live settings, idle film, timed return');
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
