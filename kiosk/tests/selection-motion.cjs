const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion });
      await page.goto(process.env.KIOSK_URL || 'http://127.0.0.1:8109/');
      await page.waitForLoadState('networkidle');
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      for (const id of ['science-tech', 'computer-science', 'engineering-manufacturing']) {
        const motion = await page.evaluate(id => {
          const original = document.querySelector(`[data-pathway="${id}"] svg`).getBoundingClientRect();
          document.querySelector(`[data-pathway="${id}"].pathway-choice`).click();
          const icon = document.querySelector('.selected-pathway__icon svg');
          const animations = document.querySelector('.selected-pathway').getAnimations({ subtree: true });
          animations.forEach(animation => { animation.pause(); animation.currentTime = 0; });
          const start = icon.getBoundingClientRect();
          animations.forEach(animation => { animation.currentTime = 100; });
          const middle = icon.getBoundingClientRect();
          return { count: animations.length, startX: start.x, originalX: original.x, startY: start.y, originalY: original.y, moving: Math.abs(middle.x - start.x) + Math.abs(middle.y - start.y) > 1 };
        }, id);
        if (reducedMotion === 'reduce') assert.equal(motion.count, 0);
        else {
          assert.ok(Math.abs(motion.startX - motion.originalX) < 1 && Math.abs(motion.startY - motion.originalY) < 1, 'Icon begins at the tapped pathway');
          assert.ok(motion.moving, 'Icon moves toward its selected position');
        }
        // Return remains usable even while the entrance is paused midway.
        await page.getByRole('button', { name: 'Back to pathways', exact: true }).click();
        await page.locator('.pathway-grid').waitFor();
        await page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
      }
      if (process.env.KIOSK_SCREENSHOT_DIR) {
        await page.locator('[data-pathway="science-tech"].pathway-choice').click();
        await page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
        await page.screenshot({ path: `${process.env.KIOSK_SCREENSHOT_DIR}/kiosk-final-720p.png` });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: `${process.env.KIOSK_SCREENSHOT_DIR}/kiosk-final-mobile.png` });
      }
      console.log(`PASS ${reducedMotion}: icon continuity, immediate return during motion, three pathways, 720p layout`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
