(function () {
  'use strict';

  const config = window.DEEP_DIVE_FIREBASE || { enabled: false };
  const COLLECTION = 'deepDiveScores';
  const SESSION_KEY = 'deep-dive-leaderboard-auth-v1';
  const ALIAS_RE = /^[A-Za-z0-9 ._-]{1,20}$/;
  const adjectives = ['Blue', 'Bright', 'Calm', 'Coral', 'Curious', 'Deep', 'Golden', 'Quiet', 'Swift', 'Wave'];
  const nouns = ['Fin', 'Kelp', 'Manta', 'Nautilus', 'Otter', 'Reef', 'Skipper', 'Starfish', 'Turtle', 'Whale'];
  let session = null;
  let dialog = null;
  let statusNode = null;
  let listNode = null;
  let saveButton = null;
  let pendingRun = null;
  let busy = false;
  let boardButton = null;
  let saveTrigger = null;
  let pendingSubmission = null;

  function addStylesheet() {
    if (document.querySelector('link[data-deep-dive-leaderboard]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'leaderboard.css';
    link.dataset.deepDiveLeaderboard = 'true';
    document.head.appendChild(link);
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function generatedAlias() {
    const pick = values => values[Math.floor(Math.random() * values.length)];
    return `${pick(adjectives)} ${pick(nouns)}`;
  }

  function isEligible(run) {
    if (!run || run.timed !== true || !Array.isArray(run.answers) || run.answers.length !== 6 ||
      !Number.isInteger(run.depth) || run.depth < 0 || run.depth > 6000) return false;
    const allowedDepths = [0, 100, 300, 600, 1000];
    const validAnswers = run.answers.every(answer => answer && typeof answer === 'object' &&
      typeof answer.question === 'string' && answer.question.length > 0 &&
      typeof answer.answer === 'string' && allowedDepths.includes(answer.depth));
    return validAnswers && run.answers.reduce((sum, answer) => sum + answer.depth, 0) === run.depth;
  }

  async function request(url, body, token, method = 'POST') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('Request timed out. Try again.');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    let data = {};
    try { data = await response.json(); } catch (_) { /* handled below */ }
    if (!response.ok) {
      const code = data.error && data.error.message;
      const error = new Error(code || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function readSession() {
    if (session && session.expiresAt > Date.now() + 30000) return session;
    try {
      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (stored && stored.idToken && stored.localId && stored.expiresAt > Date.now() + 30000) {
        session = stored;
        return session;
      }
    } catch (_) { /* session storage may be unavailable */ }
    return null;
  }

  function storeSession(next) {
    session = next;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch (_) { /* memory session remains usable */ }
  }

  async function authenticate() {
    const cached = readSession();
    if (cached) return cached;
    const data = await request(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`,
      { returnSecureToken: true }
    );
    const next = {
      idToken: data.idToken,
      localId: data.localId,
      expiresAt: Date.now() + (Number(data.expiresIn) || 3600) * 1000
    };
    storeSession(next);
    return next;
  }

  function firestoreRoot() {
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents`;
  }

  async function loadScores(options = {}) {
    const quiet = options.quiet === true;
    if (!config.enabled || !config.apiKey || !config.projectId) {
      if (!quiet) statusNode.textContent = 'Leaderboard is not available yet.';
      listNode.replaceChildren();
      return;
    }
    if (!quiet) statusNode.textContent = 'Loading scores…';
    listNode.replaceChildren();
    try {
      const response = await request(`${firestoreRoot()}:runQuery`, {
        structuredQuery: {
          from: [{ collectionId: COLLECTION }],
          orderBy: [{ field: { fieldPath: 'depth' }, direction: 'DESCENDING' }],
          limit: 10
        }
      });
      const rows = (Array.isArray(response) ? response : []).filter(item => item.document).map(item => {
        const fields = item.document.fields || {};
        return {
          alias: fields.alias && fields.alias.stringValue || 'Diver',
          depth: Number(fields.depth && fields.depth.integerValue) || 0
        };
      });
      rows.forEach((row, index) => {
        const li = document.createElement('li');
        const rank = document.createElement('span');
        const name = document.createElement('span');
        const depth = document.createElement('strong');
        rank.className = 'leaderboard-rank';
        name.className = 'leaderboard-name';
        depth.className = 'leaderboard-depth';
        rank.textContent = String(index + 1).padStart(2, '0');
        name.textContent = row.alias;
        depth.textContent = `${row.depth.toLocaleString()} m`;
        li.append(rank, name, depth);
        listNode.appendChild(li);
      });
      if (!quiet) statusNode.textContent = rows.length ? '' : 'No scores yet. Be the first to save a dive.';
    } catch (error) {
      if (!quiet) {
        statusNode.textContent = `Could not load scores. ${friendlyError(error)}`;
        addRetry();
      }
    }
  }

  function friendlyError(error) {
    const message = String(error && error.message || 'Connection unavailable');
    if (/network|fetch|failed to fetch|timed out/i.test(message)) return 'Check your connection and try again.';
    if (/PERMISSION_DENIED|permission/i.test(message)) return 'Leaderboard access is not available right now.';
    return 'Please try again in a moment.';
  }

  function addRetry(retry = loadScores) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'leaderboard-retry';
    button.textContent = 'Try again';
    button.addEventListener('click', retry, { once: true });
    statusNode.append(' ');
    statusNode.appendChild(button);
  }

  async function saveScore() {
    if (busy || !pendingRun || !isEligible(pendingRun)) return;
    const input = dialog.querySelector('#leaderboard-alias');
    const alias = input.value.trim();
    if (!ALIAS_RE.test(alias)) {
      input.setCustomValidity('Use 1–20 letters, numbers, spaces, periods, underscores, or hyphens.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    if (!pendingSubmission) {
      pendingSubmission = { alias, docId: uuid(), sessionId: uuid(), run: pendingRun };
      input.disabled = true;
    }
    busy = true;
    saveButton.disabled = true;
    dialog.querySelector('.leaderboard-cancel').disabled = true;
    dialog.querySelector('.leaderboard-close').disabled = true;
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Saving…';
    statusNode.textContent = 'Saving score…';
    try {
      const user = await authenticate();
      const submission = pendingSubmission;
      const existing = await readSavedScore(submission, user.localId);
      if (!existing) {
        try {
          await request(`${firestoreRoot()}:commit`, {
            writes: [{
              update: {
                name: `projects/${config.projectId}/databases/(default)/documents/${COLLECTION}/${submission.docId}`,
                fields: {
                  playerId: { stringValue: user.localId },
                  alias: { stringValue: submission.alias },
                  depth: { integerValue: String(submission.run.depth) },
                  sessionId: { stringValue: submission.sessionId }
                }
              },
              currentDocument: { exists: false },
              updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }]
            }]
          }, user.idToken);
        } catch (writeError) {
          // A timed-out commit may still have reached Firestore. Re-read its
          // stable document ID before offering another write.
          if (!(await readSavedScore(submission, user.localId))) throw writeError;
        }
      }
      statusNode.textContent = 'Score saved. Thanks for joining the leaderboard.';
      pendingRun = null;
      pendingSubmission = null;
      if (saveTrigger) {
        saveTrigger.disabled = true;
        saveTrigger.textContent = 'Saved to leaderboard';
      }
      dialog.querySelector('.leaderboard-optin').hidden = true;
      statusNode.textContent = 'Score saved. Thanks for joining the leaderboard.';
      void loadScores({ quiet: true });
    } catch (error) {
      statusNode.textContent = `Score not saved. ${friendlyError(error)}`;
      addRetry(saveScore);
    } finally {
      busy = false;
      saveButton.disabled = false;
      dialog.querySelector('.leaderboard-cancel').disabled = Boolean(pendingSubmission);
      dialog.querySelector('.leaderboard-close').disabled = false;
      saveButton.textContent = originalText;
    }
  }

  async function readSavedScore(submission, playerId) {
    const url = `${firestoreRoot()}/${COLLECTION}/${encodeURIComponent(submission.docId)}`;
    let documentData;
    try {
      documentData = await request(url, null, null, 'GET');
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
    const fields = documentData.fields || {};
    return Boolean(fields.playerId && fields.playerId.stringValue === playerId &&
      fields.alias && fields.alias.stringValue === submission.alias &&
      fields.depth && Number(fields.depth.integerValue) === submission.run.depth &&
      fields.sessionId && fields.sessionId.stringValue === submission.sessionId);
  }

  function makeDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'leaderboard-dialog';
    dialog.setAttribute('aria-labelledby', 'leaderboard-title');
    dialog.innerHTML = `
      <form method="dialog" class="leaderboard-header">
        <div><p class="leaderboard-kicker">Deep Dive</p><h2 id="leaderboard-title">Leaderboard</h2></div>
        <button class="icon-button leaderboard-close" type="submit" aria-label="Close leaderboard"><span aria-hidden="true">×</span></button>
      </form>
      <p class="leaderboard-status" role="status" aria-live="polite"></p>
      <ol class="leaderboard-list"></ol>
      <section class="leaderboard-optin" hidden>
        <h3>Save this dive?</h3>
        <p>Your score is only shared if you choose Save. Use a nickname; no email or real name is needed.</p>
        <label for="leaderboard-alias">Nickname</label>
        <input id="leaderboard-alias" maxlength="20" autocomplete="off" required>
        <div class="leaderboard-actions">
          <button type="button" class="secondary-button leaderboard-cancel">Cancel</button>
          <button type="button" class="primary-button leaderboard-save">Save score</button>
        </div>
      </section>`;
    statusNode = dialog.querySelector('.leaderboard-status');
    listNode = dialog.querySelector('.leaderboard-list');
    saveButton = dialog.querySelector('.leaderboard-save');
    const input = dialog.querySelector('#leaderboard-alias');
    input.value = generatedAlias();
    input.pattern = '[A-Za-z0-9 ._-]{1,20}';
    input.title = '1–20 letters, numbers, spaces, periods, underscores, or hyphens';
    input.addEventListener('input', () => input.setCustomValidity(''));
    saveButton.addEventListener('click', saveScore);
    dialog.querySelector('.leaderboard-cancel').addEventListener('click', () => {
      pendingRun = null;
      pendingSubmission = null;
      const input = dialog.querySelector('#leaderboard-alias');
      input.disabled = false;
      input.value = generatedAlias();
      dialog.querySelector('.leaderboard-optin').hidden = true;
    });
    dialog.addEventListener('cancel', event => {
      if (busy) event.preventDefault();
    });
    dialog.addEventListener('close', () => {
      if (!pendingSubmission) pendingRun = null;
      dialog.querySelector('.leaderboard-optin').hidden = true;
    });
    document.body.appendChild(dialog);
  }

  function open() {
    if (!dialog) makeDialog();
    if (typeof dialog.showModal === 'function' && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('.leaderboard-close').focus();
    }
    loadScores();
  }

  function addMastheadButton() {
    if (!config.enabled || !config.apiKey || !config.projectId) return;
    const actions = document.querySelector('.topbar-right');
    if (!actions || boardButton) return;
    boardButton = document.createElement('button');
    boardButton.type = 'button';
    boardButton.className = 'leaderboard-masthead';
    boardButton.textContent = 'Leaderboard';
    boardButton.setAttribute('aria-label', 'Open leaderboard');
    boardButton.title = 'Leaderboard';
    boardButton.addEventListener('click', open);
    actions.appendChild(boardButton);
  }

  function onComplete(event) {
    const run = event.detail || {};
    addMastheadButton();
    if (!config.enabled || !config.apiKey || !config.projectId) return;
    const result = document.querySelector('.result-screen');
    const actions = result && result.querySelector('.result-actions');
    if (!actions || result.querySelector('.leaderboard-optin-trigger')) return;
    if (!run.timed) {
      const note = document.createElement('span');
      note.className = 'leaderboard-note';
      note.textContent = 'Leaderboard entries are for timed dives.';
      actions.appendChild(note);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button leaderboard-optin-trigger';
    button.textContent = 'Save to leaderboard';
    button.disabled = !config.enabled || !config.apiKey || !config.projectId || !isEligible(run);
    if (!config.enabled) button.title = 'Leaderboard is not enabled yet.';
    button.addEventListener('click', () => {
      if (!isEligible(run) || !config.enabled) return;
      pendingRun = run;
      if (pendingSubmission && pendingSubmission.run !== run) pendingSubmission = null;
      saveTrigger = button;
      if (!dialog) makeDialog();
      const input = dialog.querySelector('#leaderboard-alias');
      if (pendingSubmission) {
        input.value = pendingSubmission.alias;
        input.disabled = true;
      } else {
        input.disabled = false;
      }
      dialog.querySelector('.leaderboard-optin').hidden = false;
      statusNode.textContent = 'Choose a nickname to share this score.';
      open();
      dialog.querySelector('#leaderboard-alias').focus();
    });
    actions.appendChild(button);
  }

  function init() {
    addStylesheet();
    addMastheadButton();
    document.addEventListener('deep-dive:complete', onComplete);
    // The game captures typed letters as answers during a question. Keep events
    // inside this native dialog from reaching that page-level keyboard handler.
    document.addEventListener('keydown', event => {
      if (dialog && dialog.open) event.stopPropagation();
    }, true);
  }

  init();
  window.DeepDiveLeaderboard = Object.freeze({ open });
})();
