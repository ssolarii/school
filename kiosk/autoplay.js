// The same sequence drives the TV and the single-screen kiosk.
export class AutoplayCycle {
  constructor(pathways, onChange) {
    this.pathways = pathways;
    this.onChange = onChange;
    this.index = 0;
    this.phase = 'stopped';
    this.enabled = false;
    this.interludeMs = 12_000;
    this.hiddenAt = null;
  }

  get pathway() { return this.pathways[this.index]; }

  configure({ autoplayEnabled, autoplayInterludeSeconds }) {
    this.enabled = Boolean(autoplayEnabled);
    const seconds = Number(autoplayInterludeSeconds);
    this.interludeMs = (Number.isFinite(seconds) ? Math.min(60, Math.max(5, seconds)) : 12) * 1000;
    if (!this.enabled) this.pause();
  }

  start(now = Date.now()) {
    if (this.enabled && this.phase === 'stopped' && this.pathways.length) this.show('interlude', now);
  }

  pause() {
    this.phase = 'stopped';
    this.hiddenAt = null;
    this.until = 0;
  }

  show(phase, now) {
    this.phase = phase;
    this.started = false;
    this.until = now + (phase === 'interlude' ? this.interludeMs : 120_000);
    this.onChange(phase, this.pathway);
  }

  advance(now = Date.now()) {
    if (!this.enabled || this.phase === 'stopped') return;
    this.index = (this.index + 1) % this.pathways.length;
    this.show('interlude', now);
  }

  markPlaying(now = Date.now()) {
    if (this.phase === 'video' && !this.started) {
      this.started = true;
      this.until = now + 90_000;
    }
  }

  fail(now = Date.now()) {
    // Give a retry a short opportunity, then continue past an unavailable film.
    if (this.phase === 'video') {
      this.started = false;
      this.until = now + 8_000;
    }
  }

  setVisible(visible, now = Date.now()) {
    if (visible && this.hiddenAt !== null) {
      this.until += now - this.hiddenAt;
      this.hiddenAt = null;
    } else if (!visible && this.hiddenAt === null) this.hiddenAt = now;
  }

  tick(now = Date.now()) {
    if (!this.enabled || this.phase === 'stopped' || this.hiddenAt !== null || now < this.until) return;
    if (this.phase === 'interlude') this.show('video', now);
    else this.advance(now);
  }
}
