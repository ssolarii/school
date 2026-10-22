import { KIOSK_CONFIG } from './config.js';
import { KioskBus } from './kiosk-bus.js';
import { createKioskState } from './kiosk-core.js';
import { preloadMedia } from './media.js';
import { SETTINGS_KEY, readSettings, escapeText, mediaUrl } from './settings-store.js';
import { AutoplayCycle } from './autoplay.js';
import { interludeView } from './autoplay-view.js';

let settings = readSettings();

preloadMedia(KIOSK_CONFIG.pathways, { videos: true });

const app = document.querySelector('#display-app');
const paths = new Map(KIOSK_CONFIG.pathways.map((pathway) => [pathway.id, pathway]));
let state = createKioskState({
  idleMs: KIOSK_CONFIG.idleSeconds * 1000,
  presentationMs: KIOSK_CONFIG.presentationSeconds * 1000,
});
let videoNeedsGesture = false;
const playbackAttempts = new WeakSet();
let autoplayActive = false;
const autoplay = new AutoplayCycle(KIOSK_CONFIG.pathways, () => {
  render();
  bus.send('AUTOPLAY_STATUS', { pathwayId: autoplay.pathway.id });
});

function syncAutoplay() {
  autoplay.configure({ ...settings, autoplayEnabled: autoplayActive });
  if (state.view === 'presenting') autoplay.pause();
  else if (autoplayActive && autoplay.phase === 'stopped') { autoplay.start(); return; }
  render();
}

function setAutoplay(enabled) {
  autoplayActive = enabled;
  if (enabled) state = { ...state, view: 'home', pathwayId: null, presentationEndsAt: null };
  syncAutoplay();
  bus.send(enabled ? 'AUTOPLAY_START' : 'AUTOPLAY_STOP');
}

const bus = new KioskBus(KIOSK_CONFIG.channelName, (message) => {
  if (message.type === 'DISCOVER_DISPLAY') bus.send('HELLO_DISPLAY');
  if (message.type !== 'STATE') return;
  const changed = state.view !== message.payload.state.view || state.pathwayId !== message.payload.state.pathwayId || state.presentationEndsAt !== message.payload.state.presentationEndsAt;
  const modeChanged = typeof message.payload.autoplay === 'boolean' && autoplayActive !== message.payload.autoplay;
  if (typeof message.payload.autoplay === 'boolean') autoplayActive = message.payload.autoplay;
  state = message.payload.state;
  if (changed || modeChanged) syncAutoplay();
});

function logo() { return `<img class="display-logo" src="${KIOSK_CONFIG.brand.logo}" alt="${KIOSK_CONFIG.brand.name}">`; }

async function requestFullscreen() {
  try { await document.documentElement.requestFullscreen(); } catch {
    // Permission failures must not replace the video element or restart playback.
    if (!app.querySelector('.display-message')) {
      const note = document.createElement('p');
      note.className = 'display-message';
      note.textContent = 'Fullscreen needs to be allowed by this browser.';
      app.append(note);
    }
  }
}

function showPlaybackControl(video, retry = false) {
  if (!video.isConnected) return;
  videoNeedsGesture = true;
  app.querySelector('.play-overlay')?.remove();
  const button = document.createElement('button');
  button.className = 'play-overlay';
  button.dataset.action = retry ? 'retry-video' : 'play-video';
  button.textContent = retry ? 'Video could not load. Tap to retry' : video.dataset.sound === 'true' ? 'Tap to play with sound' : 'Tap to play video';
  video.parentElement.append(button);
  if (retry && autoplayActive && autoplay.phase === 'video') autoplay.fail();
}

async function playVideo(video) {
  if (!video?.isConnected || playbackAttempts.has(video)) return;
  // Set properties explicitly before play(), including after browser interruptions.
  video.muted = video.dataset.sound !== 'true';
  video.defaultMuted = video.muted;
  video.playsInline = true;
  playbackAttempts.add(video);
  try {
    await video.play();
    if (video.isConnected) {
      videoNeedsGesture = false;
      app.querySelector('.play-overlay')?.remove();
    }
  } catch (error) {
    if (error.name !== 'AbortError') showPlaybackControl(video, error.name !== 'NotAllowedError');
  } finally { playbackAttempts.delete(video); }
}

function attractView(message = '') {
  if (settings.idleVideoEnabled && mediaUrl(settings.idleVideo)) {
    return `<section class="idle-video-stage"><video id="presentation-video" src="${escapeText(mediaUrl(settings.idleVideo))}" autoplay muted loop playsinline aria-label="Idle presentation"></video><button class="display-button fullscreen-toggle" data-action="fullscreen">Fullscreen</button><a class="autoplay-link" href="#autoplay" data-action="start-autoplay">autoplay</a>${message ? `<p class="display-message">${escapeText(message)}</p>` : ''}</section>`;
  }
  return `
    <section class="attract-stage">
      <div class="attract-top">${logo()}<button class="display-button" data-action="fullscreen">Fullscreen</button></div>
      <div class="attract-center"><p>${escapeText(settings.idleSubtitle)}</p><h1>${escapeText(settings.idleHeading)}</h1></div>
      <div class="attract-rail">${KIOSK_CONFIG.pathways.map((pathway) => `<span>${pathway.title}</span>`).join('')}</div>
      <a class="autoplay-link" href="#autoplay" data-action="start-autoplay">autoplay</a>
      ${message ? `<p class="display-message" role="status">${message}</p>` : ''}
    </section>`;
}

function presentationView(pathway) {
  const media = pathway.video
    ? `<video id="presentation-video" src="${pathway.video}" poster="${pathway.image}" preload="auto" autoplay ${pathway.sample ? 'muted loop' : 'data-sound="true"'} playsinline aria-label="${pathway.title} presentation"></video>`
    : `<div class="no-video"><img src="${pathway.image}" alt=""><div><p>Presentation ready for</p><h1>${pathway.title}</h1><p>Add its approved video in config.js.</p></div></div>`;
  return `
    <section class="presentation-stage">
      ${media}
      <button class="display-button fullscreen-toggle" data-action="fullscreen">Fullscreen</button>
    </section>`;
}

function render(message = '') {
  const previousVideo = app.querySelector('video');
  if (previousVideo) {
    previousVideo.pause();
    previousVideo.removeAttribute('src');
    previousVideo.load();
  }
  videoNeedsGesture = false;
  const automatic = autoplayActive && state.view !== 'presenting' && autoplay.phase !== 'stopped';
  const pathway = automatic ? autoplay.pathway : paths.get(state.pathwayId);
  app.innerHTML = automatic && autoplay.phase === 'interlude'
    ? interludeView(pathway, KIOSK_CONFIG, settings.autoplayInterludeSeconds)
    : ((automatic || state.view === 'presenting') && pathway ? presentationView(pathway) : attractView(message));
  updateFullscreenButton();
  const video = document.querySelector('#presentation-video');
  if (video) {
    video.addEventListener('error', () => showPlaybackControl(video, true));
    if (automatic) {
      video.addEventListener('playing', () => autoplay.markPlaying());
      video.addEventListener('ended', () => { if (video.isConnected) autoplay.advance(); }, { once: true });
    } else if (state.view === 'presenting' && pathway && !pathway.sample) {
      video.addEventListener('ended', () => {
        if (!video.isConnected) return;
        state = { ...state, view: 'home', pathwayId: null, presentationEndsAt: null };
        syncAutoplay();
        bus.send('RETURN_HOME');
      }, { once: true });
    }
    playVideo(video);
  }
}

app.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'start-autoplay') { event.preventDefault(); setAutoplay(true); }
  if (action === 'fullscreen') await requestFullscreen();
  if (action === 'play-video' || action === 'retry-video') {
    const video = document.querySelector('#presentation-video');
    if (action === 'retry-video') video?.load();
    await playVideo(video);
  }
});

document.addEventListener('click', event => {
  if (!autoplayActive || event.target.closest('.play-overlay, [data-action="fullscreen"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setAutoplay(false);
}, true);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && autoplayActive) setAutoplay(false); });

const saved = bus.readSavedState();
if (saved && (saved.view === 'home' || saved.presentationEndsAt > Date.now())) state = saved;
bus.send('HELLO_DISPLAY');
bus.send('REQUEST_STATE');
render();
window.setInterval(() => {
  if (state.view === 'presenting' && Date.now() >= state.presentationEndsAt) {
    state = { ...state, view: 'home', pathwayId: null, presentationEndsAt: null };
    syncAutoplay();
    bus.send('RETURN_HOME');
  }
  autoplay.tick();
  const video = app.querySelector('video');
  if (video?.paused && !video.error && !videoNeedsGesture) playVideo(video);
}, 1000);
function resumeVideo() {
  if (document.visibilityState === 'visible') playVideo(app.querySelector('video'));
}
document.addEventListener('visibilitychange', resumeVideo);
document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('autoplay-hidden', document.hidden);
  autoplay.setVisible(!document.hidden);
});
window.addEventListener('pageshow', resumeVideo);
window.addEventListener('focus', resumeVideo);
window.setInterval(() => bus.send('HELLO_DISPLAY'), 3000);

function updateFullscreenButton() {
  const hide = Boolean(document.fullscreenElement) || Math.abs(window.innerWidth / window.innerHeight - 16 / 9) < 0.025;
  app.querySelectorAll('[data-action="fullscreen"]').forEach(button => { button.hidden = hide; });
}
window.addEventListener('resize', updateFullscreenButton);
document.addEventListener('fullscreenchange', updateFullscreenButton);
window.addEventListener('storage', event => {
  if (event.key === SETTINGS_KEY) {
    settings = readSettings();
    autoplay.configure({ ...settings, autoplayEnabled: autoplayActive });
    if (autoplay.phase !== 'video') render();
  }
});
