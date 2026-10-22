export const SETTINGS_KEY = 'itzat-kiosk-settings-v1';
export const defaults = {
  idleVideoEnabled: false, idleVideo: './media/science-tech-sample.mp4',
  idleHeading: 'Choose a pathway on the touchscreen.',
  idleSubtitle: 'Discover what you can make, test, and build.',
  kioskHeading: 'Choose a pathway', selectedText: 'Look at the big screen!', returnText: 'Tap to return',
};
export function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const settings = { ...defaults };
    for (const [key, fallback] of Object.entries(defaults)) {
      if (typeof stored?.[key] === typeof fallback) settings[key] = stored[key];
    }
    return settings;
  }
  catch { return { ...defaults }; }
}
export function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function mediaUrl(value) {
  try {
    const url = new URL(value, new URL('./', import.meta.url));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
