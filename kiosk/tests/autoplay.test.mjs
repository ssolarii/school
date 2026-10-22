import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoplayCycle } from '../autoplay.js';

const pathways = [{ id: 'health' }, { id: 'cs' }, { id: 'engineering' }];
function setup() {
  const events = [];
  const cycle = new AutoplayCycle(pathways, (phase, pathway) => events.push([phase, pathway.id]));
  cycle.configure({ autoplayEnabled: true, autoplayInterludeSeconds: 12 });
  return { cycle, events };
}

test('autoplay alternates intermissions and all three films, then wraps', () => {
  const { cycle, events } = setup();
  cycle.start(0);
  cycle.tick(11_999);
  assert.equal(events.length, 1);
  cycle.tick(12_000);
  cycle.advance(20_000);
  cycle.tick(32_000);
  cycle.advance(40_000);
  cycle.tick(52_000);
  cycle.advance(60_000);
  assert.deepEqual(events, [
    ['interlude', 'health'], ['video', 'health'],
    ['interlude', 'cs'], ['video', 'cs'],
    ['interlude', 'engineering'], ['video', 'engineering'], ['interlude', 'health'],
  ]);
});

test('manual interruption pauses the cycle; disabling cancels pending transitions', () => {
  const { cycle, events } = setup();
  cycle.start(0);
  cycle.pause();
  cycle.tick(50_000);
  assert.equal(events.length, 1);
  cycle.start(60_000);
  assert.equal(cycle.phase, 'interlude');
  cycle.configure({ autoplayEnabled: false, autoplayInterludeSeconds: 12 });
  cycle.tick(100_000);
  assert.equal(cycle.phase, 'stopped');
  assert.equal(events.length, 2);
});

test('hidden screens pause intermission timing and stalled/failed films recover', () => {
  const { cycle } = setup();
  cycle.start(0);
  cycle.setVisible(false, 4_000);
  cycle.tick(60_000);
  assert.equal(cycle.phase, 'interlude');
  cycle.setVisible(true, 60_000);
  cycle.tick(67_999);
  assert.equal(cycle.phase, 'interlude');
  cycle.tick(68_000);
  assert.equal(cycle.phase, 'video');
  cycle.markPlaying(70_000);
  cycle.tick(159_999);
  assert.equal(cycle.phase, 'video');
  cycle.tick(160_000);
  assert.equal(cycle.pathway.id, 'cs');
  cycle.tick(172_000);
  cycle.fail(173_000);
  cycle.tick(181_000);
  assert.equal(cycle.pathway.id, 'engineering');
});

test('a successful retry gets enough time to play its complete film', () => {
  const { cycle } = setup();
  cycle.start(0);
  cycle.tick(12_000);
  cycle.markPlaying(13_000);
  cycle.fail(15_000);
  cycle.markPlaying(17_000);
  cycle.tick(23_000);
  assert.equal(cycle.phase, 'video');
  cycle.tick(107_000);
  assert.equal(cycle.pathway.id, 'cs');
});
