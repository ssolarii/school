import test from 'node:test';
import assert from 'node:assert/strict';
import { KioskBus } from '../kiosk-bus.js';

test('a failed BroadcastChannel send still delivers state through postMessage', () => {
  const delivered = [];
  globalThis.window = { BroadcastChannel: true, addEventListener() {}, location: { origin: 'https://example.com' } };
  globalThis.BroadcastChannel = class { addEventListener() {} postMessage() { throw new Error('Channel closed'); } };
  globalThis.localStorage = { setItem() { throw new Error('Storage blocked'); } };
  const bus = new KioskBus('test', () => {});
  bus.peer = { closed: false, postMessage(message) { delivered.push(message.message); } };
  bus.send('STATE', { state: { view: 'presenting', pathwayId: 'science-tech' } });
  assert.equal(delivered[0].type, 'STATE');
  assert.equal(delivered[0].payload.state.pathwayId, 'science-tech');
  delete globalThis.window;
  delete globalThis.BroadcastChannel;
  delete globalThis.localStorage;
});
