import test from 'node:test';
import assert from 'node:assert/strict';
import { readSettings, defaults } from '../settings-store.js';

test('invalid stored field types cannot crash the TV renderer', () => {
  globalThis.localStorage = { getItem: () => JSON.stringify({
    topText: null, bottomTitle: 42, bottomText: {}, idleVideoEnabled: 'false', banners: 'invalid', kioskHeading: 'Welcome',
  }) };
  const settings = readSettings();
  assert.equal(settings.topText, '');
  assert.equal(settings.bottomTitle, '{pathway}');
  assert.equal(settings.bottomText, 'Sample footage');
  assert.equal(settings.banners, 'both');
  assert.equal(settings.idleVideoEnabled, false);
  assert.equal(settings.kioskHeading, 'Welcome');
  delete globalThis.localStorage;
});

test('blocked storage uses working default settings', () => {
  globalThis.localStorage = { getItem() { throw new Error('Blocked'); } };
  assert.deepEqual(readSettings(), defaults);
  delete globalThis.localStorage;
});
