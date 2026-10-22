import { KIOSK_CONFIG } from '../kiosk/config.js';

const app = document.querySelector('#app');
const mediaBase = new URL('../kiosk/', import.meta.url);
const asset = path => new URL(path, mediaBase).href;
let active = null;
let deadline = 0;
let lastPathway = null;

function icon(id) {
  const common = 'viewBox="0 0 120 120" aria-hidden="true" focusable="false"';
  if (id === 'science-tech') return `<svg ${common}><path d="M42 16h36M49 16v27L26 82a17 17 0 0 0 15 25h38a17 17 0 0 0 15-25L71 43V16M39 75h42"/></svg>`;
  if (id === 'computer-science') return `<svg ${common}><rect x="21" y="23" width="78" height="57" rx="8"/><path d="M60 80v17M42 98h36"/></svg>`;
  return `<svg ${common}><path d="m44 52-24 24a13 13 0 0 0 18 18l25-25M44 52l19 17M43 50V35L30 19h21l27 24v13l12 12-14 14-13-13M78 56l-15 13"/></svg>`;
}

function home() {
  deadline = 0;
  if (active) {
    active.pause();
    active.removeAttribute('src');
    active.load();
    active = null;
  }
  app.className = 'app-shell is-home';
  app.innerHTML = `<header class="control-header"><img class="brand-logo" src="${asset(KIOSK_CONFIG.brand.logo)}" alt="Itz’at STEAM Academy"></header>
    <div class="home-content"><section class="control-intro"><h1>Choose a pathway</h1></section>
    <section class="pathway-grid" aria-label="Pathways">${KIOSK_CONFIG.pathways.map(p => `<button class="pathway-choice pathway-choice--${p.accent}" data-pathway="${p.id}"><span class="pathway-choice__icon">${icon(p.id)}</span><span class="pathway-choice__copy"><strong>${p.title}</strong></span></button>`).join('')}</section></div>
    <button class="fullscreen" type="button" ${document.fullscreenElement ? 'hidden' : ''}>Full screen</button>`;
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

function select(id) {
  const pathway = KIOSK_CONFIG.pathways.find(p => p.id === id);
  if (!pathway || active) return;
  lastPathway = id;
  app.className = '';
  app.innerHTML = `<section class="film" aria-label="${pathway.title}"><video playsinline preload="auto" poster="${asset(pathway.image)}" aria-label="${pathway.title} film"></video><button class="film-back" type="button">← Back</button><button class="play-overlay" type="button" hidden>Tap to play</button></section>`;
  const video = active = app.querySelector('video');
  video.muted = Boolean(pathway.sample);
  video.loop = Boolean(pathway.sample);
  video.src = asset(pathway.video);
  video.addEventListener('playing', () => {
    if (!deadline) deadline = Date.now() + KIOSK_CONFIG.presentationSeconds * 1000;
  });
  video.addEventListener('ended', () => { if (active === video) home(); });
  video.addEventListener('error', () => showProblem(video, 'Video could not load. Tap to retry'));
  app.querySelector('.film-back').addEventListener('click', home);
  app.querySelector('.play-overlay').addEventListener('click', () => {
    if (video.error) video.load();
    play(video);
  });
  // Keep playback in the selection gesture so Chrome can allow audible video.
  play(video);
  app.querySelector('.film-back').focus({ preventScroll: true });
}

app.addEventListener('click', event => {
  const choice = event.target.closest('[data-pathway]');
  if (choice) select(choice.dataset.pathway);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && active) home(); });
document.addEventListener('fullscreenchange', () => {
  const button = app.querySelector('.fullscreen');
  if (button) button.hidden = Boolean(document.fullscreenElement);
});
setInterval(() => { if (deadline && Date.now() >= deadline) home(); }, 500);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && deadline && Date.now() >= deadline) home();
});
home();
