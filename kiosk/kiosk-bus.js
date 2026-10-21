const STORAGE_PREFIX = 'itzat-kiosk-state:';

export class KioskBus {
  constructor(channelName, onMessage) {
    this.channelName = channelName;
    this.onMessage = onMessage;
    this.storageKey = `${STORAGE_PREFIX}${channelName}`;
    this.seen = new Set();
    this.channel = null;
    try {
      if ('BroadcastChannel' in window) this.channel = new BroadcastChannel(channelName);
    } catch { /* Continue with storage and opener messaging if this channel is blocked. */ }
    this.channel?.addEventListener('message', (event) => this.receive(event.data));
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        try { this.receive(JSON.parse(event.newValue)); } catch { /* Ignore an invalid stored message. */ }
      }
    });
    window.addEventListener('message', (event) => {
      if (event.origin === window.location.origin && event.data?.source === 'itzat-pathways-kiosk') {
        if (event.source && event.source !== window) this.peer = event.source;
        this.receive(event.data.message);
      }
    });
  }

  send(type, payload = {}) {
    const message = { source: 'itzat-pathways-kiosk', type, payload, sentAt: Date.now(), nonce: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}` };
    try { this.channel?.postMessage(message); } catch { /* A failed channel must not prevent the other transports. */ }
    try { localStorage.setItem(this.storageKey, JSON.stringify(message)); } catch { /* File mode or privacy settings can block storage. */ }
    if (type === 'STATE') {
      try { localStorage.setItem(`${this.storageKey}:snapshot`, JSON.stringify(payload.state)); } catch { /* Storage is optional. */ }
    }
    const peer = this.peer || window.opener;
    try {
      if (peer && !peer.closed) peer.postMessage({ source: 'itzat-pathways-kiosk', message }, window.location.origin);
    } catch { /* The peer may have closed or navigated away. Other transports still work. */ }
    return message;
  }

  receive(message) {
    if (!message || message.source !== 'itzat-pathways-kiosk') return;
    if (message.nonce && this.seen.has(message.nonce)) return;
    this.seen.add(message.nonce);
    if (this.seen.size > 200) this.seen.delete(this.seen.values().next().value);
    this.onMessage(message);
  }

  readSavedState() {
    try {
      return JSON.parse(localStorage.getItem(`${this.storageKey}:snapshot`));
    } catch { return null; }
  }

  close() { this.channel?.close(); }
}
