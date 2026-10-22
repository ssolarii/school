import { KIOSK_CONFIG } from '../kiosk/config.js';
import { SETTINGS_KEY, readSettings } from '../kiosk/settings-store.js';
import { pathwayIcon as icon } from '../kiosk/pathway-icon.js';
import { AutoplayCycle } from '../kiosk/autoplay.js';
import { interludeView } from '../kiosk/autoplay-view.js';

const app = document.querySelector('#app');
const mediaBase = new URL('../kiosk/', import.meta.url);
const asset = path => new URL(path, mediaBase).href;
let active = null;
let deadline = 0;
let lastPathway = null;
let settings = readSettings();
let autoplayActive = false;
const autoplay = new AutoplayCycle(KIOSK_CONFIG.pathways, (phase, pathway) => {
  clearVideo();
  if (phase === 'video') select(pathway.id, true);
  else {
    app.className = '';
    app.innerHTML = interludeView(pathway, KIOSK_CONFIG, settings.autoplayInterludeSeconds);
  }
});

function startAutoplay() {
  autoplayActive = true;
  autoplay.configure({ ...settings, autoplayEnabled: true });
  autoplay.start();
}

function clearVideo() {
  deadline = 0;
  if (active) {
    active.pause();
    active.removeAttribute('src');
    active.load();
    active = null;
  }
}

function home() {
  clearVideo();
  app.className = 'app-shell is-home';
  app.innerHTML = `<header class="control-header"><img class="brand-logo" src="${asset(KIOSK_CONFIG.brand.logo)}" alt="Itz’at STEAM Academy"></header>
    <div class="home-content"><section class="control-intro"><h1>Choose a pathway</h1></section>
    <section class="pathway-grid" aria-label="Pathways">${KIOSK_CONFIG.pathways.map(p => `<button class="pathway-choice pathway-choice--${p.accent}" data-pathway="${p.id}"><span class="pathway-choice__icon">${icon(p.id)}</span><span class="pathway-choice__copy"><strong>${p.title}</strong></span></button>`).join('')}</section></div>
    <button class="fullscreen" type="button" ${document.fullscreenElement ? 'hidden' : ''}>Full screen</button>
    <a class="autoplay-link" href="#autoplay" data-action="start-autoplay">autoplay</a>`;
  app.querySelector('.fullscreen').addEventListener('click', async event => {
    try { await document.documentElement.requestFullscreen(); }
    catch { event.target.textContent = 'Use browser full screen'; }
  });
  if (lastPathway) app.querySelector(`[data-pathway="${lastPathway}"]`)?.focus({ preventScroll: true });
}

function showProblem(video, text) {
  if (active !== video) return;
  const retry = app.querySelector('.play-overlay');
  retry.textContent = text;
  retry.hidden = false;
}

async function play(video) {
  if (active !== video) return;
  try {
    await video.play();
    if (active === video) app.querySelector('.play-overlay').hidden = true;
  } catch (error) {
    if (error.name !== 'AbortError') showProblem(video, video.error ? 'Video could not load. Tap to retry' : 'Tap to play');
  }
}

function select(id, automatic = false) {
  const pathway = KIOSK_CONFIG.pathways.find(p => p.id === id);
  if (!pathway || active) return;
  lastPathway = id;
  app.className = '';
  app.innerHTML = `<section class="film" aria-label="${pathway.title}"><video playsinline preload="auto" poster="${asset(pathway.image)}" aria-label="${pathway.title} film"></video>${automatic ? '' : '<button class="film-back" type="button">← Back</button>'}<button class="play-overlay" type="button" hidden>Tap to play</button></section>`;
  const video = active = app.querySelector('video');
  video.muted = Boolean(pathway.sample);
  video.loop = Boolean(pathway.sample);
  video.src = asset(pathway.video);
  video.addEventListener('playing', () => {
    if (automatic) autoplay.markPlaying();
    else if (!deadline) deadline = Date.now() + KIOSK_CONFIG.presentationSeconds * 1000;
  });
  video.addEventListener('ended', () => { if (active === video) automatic ? autoplay.advance() : home(); });
  video.addEventListener('error', () => {
    showProblem(video, 'Video could not load. Tap to retry');
    if (automatic && active === video) autoplay.fail();
  });
  app.querySelector('.film-back')?.addEventListener('click', home);
  app.querySelector('.play-overlay').addEventListener('click', () => {
    if (video.error) video.load();
    play(video);
  });
  // Keep playback in the selection gesture so Chrome can allow audible video.
  play(video);
  app.querySelector('.film-back')?.focus({ preventScroll: true });
}

app.addEventListener('click', event => {
  if (event.target.closest('[data-action="start-autoplay"]')) {
    event.preventDefault();
    startAutoplay();
    return;
  }
  const choice = event.target.closest('[data-pathway]');
  if (choice) select(choice.dataset.pathway);
});
function exitAutoplay() {
  autoplayActive = false;
  autoplay.pause();
  home();
}
document.addEventListener('click', event => {
  if (!autoplayActive || event.target.closest('.play-overlay')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  exitAutoplay();
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (autoplayActive) exitAutoplay();
    else if (active) home();
  }
});
document.addEventListener('fullscreenchange', () => {
  const button = app.querySelector('.fullscreen');
  if (button) button.hidden = Boolean(document.fullscreenElement);
});
setInterval(() => {
  autoplay.tick();
  if (deadline && Date.now() >= deadline) home();
}, 500);
document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('autoplay-hidden', document.hidden);
  autoplay.setVisible(!document.hidden);
  if (!document.hidden && deadline && Date.now() >= deadline) home();
});
window.addEventListener('storage', event => {
  if (event.key !== SETTINGS_KEY) return;
  settings = readSettings();
  autoplay.configure({ ...settings, autoplayEnabled: autoplayActive });
});
home();
