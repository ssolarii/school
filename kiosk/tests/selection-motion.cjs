const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion });
      // Exercise the existing hosted app with the local stylesheet before publishing.
      if (!process.env.KIOSK_LIVE_TEST) await page.route('**/styles.css', route => route.fulfill({
        path: path.resolve(__dirname, '../styles.css'), contentType: 'text/css',
      }));
      await page.goto('https://ssolarii.github.io/school/kiosk/');
      await page.waitForLoadState('networkidle');
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      for (const id of ['science-tech', 'computer-science', 'engineering-manufacturing']) {
        const motion = await page.evaluate(id => {
          document.querySelector(`[data-pathway="${id}"]`).click();
          const animations = document.querySelector('.selected-pathway').getAnimations({ subtree: true });
          return animations.map(animation => {
            animation.pause();
            animation.currentTime = 0;
            const start = getComputedStyle(animation.effect.target).opacity;
            animation.currentTime = 140;
            const middle = getComputedStyle(animation.effect.target).opacity;
            animation.finish();
            return { duration: animation.effect.getTiming().duration, start: +start, middle: +middle };
          });
        }, id);
        assert.equal(motion.length, reducedMotion === 'reduce' ? 0 : 2);
        for (const animation of motion) {
          assert.equal(animation.duration, 280);
          assert.ok(animation.middle > animation.start && animation.middle < 1);
        }
        await page.getByRole('button', { name: 'Back to pathways', exact: true }).click();
        await page.locator('.pathway-grid').waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
      }
      console.log(`PASS ${reducedMotion}: three selections, finished animation, immediate return, 720p layout`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
