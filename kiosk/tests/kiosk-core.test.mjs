import test from 'node:test';
import assert from 'node:assert/strict';

import { createKioskState, reduceKioskState } from '../kiosk-core.js';

test('a pathway selection begins a timed presentation and carries its ID', () => {
  const home = createKioskState({ presentationMs: 90_000 });
  const selected = reduceKioskState(home, { type: 'SELECT_PATHWAY', pathwayId: 'science-tech', now: 1_000 });

  assert.equal(selected.view, 'presenting');
  assert.equal(selected.pathwayId, 'science-tech');
  assert.equal(selected.presentationEndsAt, 91_000);
});

test('a completed presentation returns the kiosk to its attract state', () => {
  const home = createKioskState({ presentationMs: 90_000 });
  const selected = reduceKioskState(home, { type: 'SELECT_PATHWAY', pathwayId: 'science-tech', now: 1_000 });
  const expired = reduceKioskState(selected, { type: 'TICK', now: 91_000 });

  assert.equal(expired.view, 'home');
  assert.equal(expired.pathwayId, null);
  assert.equal(expired.presentationEndsAt, null);
});

test('an idle control screen resets without interrupting an active presentation', () => {
  const home = createKioskState({ idleMs: 120_000, presentationMs: 90_000 });
  const idle = reduceKioskState(home, { type: 'TICK', now: 120_000 });
  const selected = reduceKioskState(home, { type: 'SELECT_PATHWAY', pathwayId: 'science-tech', now: 1_000 });
  const active = reduceKioskState(selected, { type: 'TICK', now: 20_000 });

  assert.equal(idle.view, 'home');
  assert.equal(active.view, 'presenting');
});
