import { KIOSK_CONFIG } from './config.js';
import { KioskBus } from './kiosk-bus.js';
import { createKioskState, reduceKioskState } from './kiosk-core.js';
import { preloadMedia } from './media.js';
import { SETTINGS_KEY, readSettings, escapeText } from './settings-store.js';

let settings = readSettings();

preloadMedia(KIOSK_CONFIG.pathways);

const app = document.querySelector('#app');
const displayControls = document.querySelector('#display-controls');
const paths = new Map(KIOSK_CONFIG.pathways.map((pathway) => [pathway.id, pathway]));
let displayWindow = null;
let displayConnected = false;
let lastDisplaySeenAt = 0;
let displayIssue = '';
let state = createKioskState({
  idleMs: KIOSK_CONFIG.idleSeconds * 1000,
  presentationMs: KIOSK_CONFIG.presentationSeconds * 1000,
});

const bus = new KioskBus(KIOSK_CONFIG.channelName, (message) => {
  if (message.type === 'HELLO_DISPLAY') {
    const wasConnected = displayConnected;
    displayConnected = true;
    lastDisplaySeenAt = Date.now();
    publishState();
    if (!wasConnected) {
      displayIssue = '';
      updateDisplayControls();
    }
  }
  if (message.type === 'REQUEST_STATE') publishState();
  if (message.type === 'RETURN_HOME') transition({ type: 'RETURN_HOME' });
});

function publishState() {
  bus.send('STATE', { state, config: { presentationSeconds: KIOSK_CONFIG.presentationSeconds } });
}

function transition(event, { broadcast = true } = {}) {
  const next = reduceKioskState(state, { ...event, now: event.now ?? Date.now() });
  const changed = next !== state && next.revision !== state.revision;
  state = next;
  if (broadcast && changed) publishState();
  if (changed) render();
}

function selectPathway(id) {
  if (!paths.has(id)) return;
  transition({ type: 'SELECT_PATHWAY', pathwayId: id });
}

function openDisplay() {
  displayWindow = window.open('./display.html', 'itzat-pathways-display', 'popup=yes,width=1280,height=720');
  if (!displayWindow) {
    displayConnected = false;
    displayIssue = 'Allow popups for this page, then try again.';
    updateDisplayControls();
    return;
  }
  displayWindow.focus();
  bus.peer = displayWindow;
  publishState();
  render();
}

function logo() {
  return `<img class="brand-logo" src="${KIOSK_CONFIG.brand.logo}" alt="${KIOSK_CONFIG.brand.name}">`;
}

function updateDisplayControls() {
  displayControls.hidden = displayConnected;
  displayControls.innerHTML = displayConnected ? '' : `
    <button class="button button--quiet" data-action="open-display">Open window 2</button>
    ${displayIssue ? `<p class="window-control__message">${displayIssue}</p>` : ''}`;
}

function pathwayIcon(id) {
  const common = 'viewBox="0 0 120 120" aria-hidden="true" focusable="false"';
  if (id === 'science-tech') return `<svg ${common}><path d="M42 16h36M49 16v27L26 82a17 17 0 0 0 15 25h38a17 17 0 0 0 15-25L71 43V16M39 75h42"/></svg>`;
  if (id === 'computer-science') return `<svg ${common}><rect x="21" y="23" width="78" height="57" rx="8"/><path d="M60 80v17M42 98h36"/></svg>`;
  return `<svg ${common}><path d="m44 52-24 24a13 13 0 0 0 18 18l25-25M44 52l19 17M43 50V35L30 19h21l27 24v13l12 12-14 14-13-13M78 56l-15 13"/></svg>`;
}

function pathwayCard(pathway) {
  return `
    <button class="pathway-choice pathway-choice--${pathway.accent}" data-pathway="${pathway.id}">
      <span class="pathway-choice__icon">${pathwayIcon(pathway.id)}</span>
      <span class="pathway-choice__copy">
        <strong>${pathway.title}</strong>
      </span>
    </button>`;
}

function homeView() {
  return `
    <header class="control-header">
      ${logo()}
    </header>
    <div class="home-content">
    <section class="control-intro" aria-labelledby="choose-heading">
      <h1 id="choose-heading">${escapeText(settings.kioskHeading)}</h1>
    </section>
    <section class="pathway-grid" aria-label="Pathways">
      ${KIOSK_CONFIG.pathways.map(pathwayCard).join('')}
    </section>
    </div>`;
}

function presentingView(pathway) {
  return `
    <section class="selected-pathway" data-pathway="${pathway.id}" aria-labelledby="presenting-heading">
      <span class="selected-pathway__icon">${pathwayIcon(pathway.id)}</span>
      <div class="selected-pathway__copy">
        <h1 id="presenting-heading">${pathway.title}</h1>
        <p>${escapeText(settings.selectedText)}</p>
        <small class="return-hint">${escapeText(settings.returnText)}</small>
      </div>
      <button class="selected-pathway__back" data-action="return-home" aria-label="Back to pathways"></button>
    </section>`;
}

function render() {
  const pathway = paths.get(state.pathwayId);
  const presenting = state.view === 'presenting' && pathway;
  const previousSelection = app.querySelector('.selected-pathway');
  const movingPathway = presenting ? pathway.id : previousSelection?.dataset.pathway;
  const sourceIcon = previousSelection?.querySelector('svg') ||
    app.querySelector(`[data-pathway="${movingPathway}"] .pathway-choice__icon svg`);
  const origin = sourceIcon?.getBoundingClientRect();
  const originColor = sourceIcon ? getComputedStyle(sourceIcon).color : '';
  const changedView = Boolean(previousSelection) !== Boolean(presenting);
  app.classList.toggle('is-home', !presenting);
  app.classList.toggle('is-presenting', Boolean(presenting));
  document.body.classList.toggle('is-presenting', Boolean(presenting));
  if (presenting) document.body.dataset.pathway = pathway.id;
  app.innerHTML = presenting ? presentingView(pathway) : homeView();
  updateDisplayControls();
  if (changedView && origin && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const targetIcon = presenting ? app.querySelector('.selected-pathway__icon svg') :
      app.querySelector(`[data-pathway="${movingPathway}"] .pathway-choice__icon svg`);
    if (!targetIcon?.animate) return;
    const destination = targetIcon.getBoundingClientRect();
    // Carry the chosen icon between the two layouts; the rest of the UI stays usable.
    targetIcon.animate([
      { transform: `translate(${origin.x - destination.x}px, ${origin.y - destination.y}px) scale(${origin.width / destination.width})`, color: originColor },
      { transform: 'none', color: getComputedStyle(targetIcon).color },
    ], { duration: presenting ? 460 : 300, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    if (presenting) app.querySelector('.selected-pathway__copy').animate([
      { opacity: .2, clipPath: 'inset(0 0 100% 0)' },
      { opacity: 1, clipPath: 'inset(0 0 0 0)' },
    ], { duration: 340, delay: 70, fill: 'backwards', easing: 'cubic-bezier(.16, 1, .3, 1)' });
  }
}

app.addEventListener('click', (event) => {
  const card = event.target.closest('[data-pathway].pathway-choice');
  if (card) selectPathway(card.dataset.pathway);
  const action = event.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'return-home') transition({ type: 'RETURN_HOME' });
  if (action.dataset.action === 'restart') selectPathway(action.dataset.pathway);
});

displayControls.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="open-display"]')) openDisplay();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') transition({ type: 'RETURN_HOME' });
  if (event.key.toLowerCase() === 'r' && state.view === 'presenting') selectPathway(state.pathwayId);
});

['pointerdown', 'keydown'].forEach((type) => window.addEventListener(type, () => transition({ type: 'MARK_ACTIVITY' }, { broadcast: false }), { passive: true }));
window.setInterval(() => {
  transition({ type: 'TICK' });
  if (displayConnected && (displayWindow?.closed || Date.now() - lastDisplaySeenAt > 10_000)) {
    displayConnected = false;
    updateDisplayControls();
  }
}, 1000);

render();
window.addEventListener('storage', event => {
  if (event.key === SETTINGS_KEY) { settings = readSettings(); render(); }
});
publishState();
bus.send('DISCOVER_DISPLAY');
