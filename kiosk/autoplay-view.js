import { escapeText } from './settings-store.js';
import { pathwayIcon } from './pathway-icon.js';

const base = new URL('./', import.meta.url);
export function interludeView(pathway, config, seconds) {
  const src = path => escapeText(new URL(path, base).href);
  return `<section class="intermission intermission--${pathway.accent}" style="--intermission-duration:${Number(seconds)}s" aria-label="Next film: ${escapeText(pathway.title)}">
    <div class="intermission__image"><img src="${src(pathway.image)}" alt=""></div>
    <img class="intermission__brand" src="${src(config.brand.logo)}" alt="${escapeText(config.brand.name)}">
    <div class="intermission__feature"><span class="intermission__icon">${pathwayIcon(pathway.id)}</span><h1>${escapeText(pathway.title)}</h1></div>
    <div class="intermission__rail">${config.pathways.map(p => `<div class="intermission__path ${p.id === pathway.id ? 'is-next' : ''}"><span>${escapeText(p.title)}</span>${p.id === pathway.id ? '<i class="intermission__progress" aria-hidden="true"></i>' : ''}</div>`).join('')}</div>
    <p class="intermission__exit">Tap to return</p>
  </section>`;
}
