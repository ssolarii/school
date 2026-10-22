import { SETTINGS_KEY, defaults, readSettings, mediaUrl } from '../settings-store.js';
const form = document.querySelector('form');
const status = document.querySelector('#save-status');
function populate(settings) {
  for (const key of Object.keys(defaults)) {
    const field = form.elements.namedItem(key);
    if (field.type === 'checkbox') field.checked = settings[key];
    else field.value = settings[key];
  }
}
function save(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    status.textContent = 'Saved. Open kiosk windows update automatically.';
  } catch { status.textContent = 'Settings could not be saved. Allow browser storage and try again.'; }
}
form.addEventListener('submit', event => {
  event.preventDefault();
  const settings = {};
  for (const key of Object.keys(defaults)) {
    const field = form.elements.namedItem(key);
    settings[key] = field.type === 'checkbox' ? field.checked : field.type === 'number' ? Number(field.value) : field.value.trim();
  }
  if (settings.idleVideoEnabled && (!settings.idleVideo || !mediaUrl(settings.idleVideo))) {
    status.textContent = 'Enter a relative video path or a direct HTTP/HTTPS video URL.';
    return;
  }
  save(settings);
});
document.querySelector('#reset').addEventListener('click', () => { populate(defaults); save({ ...defaults }); });
populate(readSettings());
