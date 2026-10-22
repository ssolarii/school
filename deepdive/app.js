(() => {
  'use strict';
  const QUESTIONS = window.DEEP_DIVE_QUESTIONS;
  const STORAGE = {seen:'deep-dive-seen-v1', additions:'deep-dive-additions-v1', sound:'deep-dive-sound-v1'};
  const BANDS = [100,300,600,1000];
  const $ = (selector) => document.querySelector(selector);
  const screen = $('#screen');
  const guideDialog = $('#guide-dialog');
  const guideContent = $('#guide-content');
  const subPosition = $('#sub-position');
  const ocean = $('.ocean-side');
  const depthValue = $('#depth-value');
  const statusText = $('#status-text');
  const app = $('#app');
  let additions = loadJSON(STORAGE.additions, {});
  let soundOn = loadJSON(STORAGE.sound, true);
  let audioContext;
  let guidePausedTimer = false;
  let rewardTimeout;
  let state = {phase:'intro', questions:[], index:0, depth:0, results:[], timed:true, remaining:25, timer:null, busy:false, pendingAnswer:''};

  function loadJSON(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } }
  function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function normalize(value) { return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9+ ]/g,' ').replace(/\b(a|an|the)\b/g,' ').replace(/\s+/g,' ').trim(); }
  function shuffled(items) { return [...items].sort(() => Math.random() - .5); }
  function weightedPick(pool, seen) { const unseen = pool.filter(q => !seen.includes(q.id)); return shuffled(unseen.length ? unseen : pool)[0]; }
  function selectQuestions() {
    const seen = loadJSON(STORAGE.seen, []);
    const selected = [];
    for (const group of ['computing','science','belize']) {
      const pick = weightedPick(QUESTIONS.filter(q => q.group === group), seen);
      selected.push(pick);
    }
    while (selected.length < 6) {
      const pool = QUESTIONS.filter(q => !selected.includes(q));
      const pick = weightedPick(pool, seen);
      selected.push(pick);
    }
    const run = shuffled(selected);
    saveJSON(STORAGE.seen, run.map(q => q.id));
    return run;
  }
  function currentQuestion() { return state.questions[state.index]; }
  function icon(direction='right') { return `<svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">${direction === 'down' ? '<path d="M12 4v16m-6-6 6 6 6-6"/>' : '<path d="M4 12h16m-6-6 6 6-6 6"/>'}</svg>`; }
  function announce(message) { $('#game-announcement').textContent = message; }
  function playTone(frequency, duration=.1, delay=0, volume=.035) {
    if (!soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const start = audioContext.currentTime + delay;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency,start);
      gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(volume,start+.012); gain.gain.exponentialRampToValueAtTime(.001,start+duration);
      oscillator.connect(gain).connect(audioContext.destination); oscillator.start(start); oscillator.stop(start+duration+.02);
    } catch {}
  }
  function playAward(depth) {
    if (depth === 1000) { [440,554,740].forEach((tone,i) => playTone(tone,.22,i*.095,.045)); }
    else { playTone(depth >= 600 ? 440 : 330,.12,0,.025); }
  }
  function updateSoundButton() {
    const button = $('#sound-button');
    button.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Turn on sound');
    button.title = soundOn ? 'Mute sound' : 'Turn on sound';
    button.classList.toggle('muted', !soundOn);
  }
  function updateDepth() {
    depthValue.textContent = state.depth.toLocaleString();
    subPosition.style.transform = `translateY(${Math.min(100,Math.max(0,state.depth/6000*100))}%)`;
    app.dataset.phase = state.phase;
    const board = document.querySelector('.leaderboard-masthead');
    if (board) {
      board.disabled = state.phase === 'question' || state.phase === 'unknown';
      board.title = board.disabled ? 'Finish this question to view the leaderboard' : 'Leaderboard';
    }
    const progress = Math.min(1, state.depth / 6000);
    app.style.setProperty('--dive-progress', progress.toFixed(3));
    const stage = state.depth >= 3600 ? 'Abyss' : state.depth >= 1800 ? 'Twilight' : state.depth >= 600 ? 'Reef' : 'Surface';
    app.dataset.depthStage = stage.toLowerCase();
    statusText.textContent = state.phase === 'result' ? 'Dive complete' : state.phase === 'intro' ? 'Surface' : `${stage} · Question ${state.index+1} of 6`;
    ocean.style.setProperty('--descent', (state.depth / 6000).toFixed(3));
  }
  function stopTimer() { if (state.timer) clearInterval(state.timer); state.timer = null; }
  function startTimer() {
    stopTimer();
    if (!state.timed) return;
    const started = Date.now(); const initial = state.remaining;
    state.timer = setInterval(() => {
      if (state.phase !== 'question' || state.busy) return;
      state.remaining = Math.max(0,initial - (Date.now()-started)/1000);
      const label = $('#timer-number'); const clock = $('#question-clock');
      if (label) label.textContent = Math.ceil(state.remaining);
      if (clock) clock.style.setProperty('--remaining',state.remaining/25);
      if (state.remaining <= 0) { stopTimer(); award(null,0,'Time is up. The next answer is waiting.',false); }
    },100);
  }
  function intro() {
    state.phase = 'intro'; state.depth = 0; state.index = 0; state.results = []; state.busy = false;
    stopTimer(); updateDepth();
    screen.innerHTML = `<div class="intro-screen">
      <div class="intro-main"><h1>How deep can<br>your answers go?</h1><p>Give a valid answer. The less expected it is, the further you descend.</p>
      <button class="primary-button start-button" id="start-button" type="button">Start the dive ${icon('down')}</button>
      <label class="untimed-choice"><input id="untimed-option" type="checkbox"> Play without a timer</label></div>
      <div class="intro-bottom"><span>Six questions</span><span>About three minutes</span></div>
    </div>`;
    document.dispatchEvent(new CustomEvent('deep-dive:intro'));
    $('#start-button').addEventListener('click', () => { state.timed = !$('#untimed-option').checked; state.questions = selectQuestions(); state.index=0; state.depth=0; state.results=[]; playTone(280,.09); app.classList.add('dive-enter'); setTimeout(() => app.classList.remove('dive-enter'),700); showQuestion(); });
  }
  function showQuestion(remaining=25) {
    state.phase = 'question'; state.busy = false; state.remaining = remaining; state.pendingAnswer = '';
    updateDepth();
    const question = currentQuestion();
    const dots = state.questions.map((_,i) => `<span class="progress-dot ${i<state.index?'complete':''} ${i===state.index?'current':''}"></span>`).join('');
    screen.innerHTML = `<div class="question-screen">
      <div class="question-meta"><div class="progress-wrap"><span>Question <strong>${state.index+1}</strong> of 6</span><div class="progress-dots" aria-hidden="true">${dots}</div></div>
      ${state.timed ? `<div class="timer" id="question-clock" style="--remaining:${remaining/25}" role="timer" aria-live="off" aria-label="Seconds remaining"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="clock-track" cx="50" cy="50" r="44"/><circle class="clock-progress" cx="50" cy="50" r="44"/></svg><span id="timer-number">${Math.ceil(remaining)}</span><span>seconds</span></div>` : `<div class="timer untimed-label">No timer</div>`}</div>
      <div class="question-main ${question.prompt.length>64?'long-question':''}"><h1>${escapeHTML(question.prompt)}</h1>
      <form id="answer-form" autocomplete="off"><label for="answer-input">Your answer</label><div class="answer-row"><input id="answer-input" name="answer" maxlength="64" spellcheck="false" required aria-describedby="answer-hint inline-error" placeholder="Type one answer"><button class="primary-button answer-button" id="answer-button" type="submit" aria-label="Submit answer"><span class="answer-label">Dive</span>${icon('down')}</button></div><span class="answer-hint" id="answer-hint">Press Enter to dive</span></form>
      <div id="inline-error" class="inline-error" role="status"></div></div>
    </div>`;
    $('#answer-form').addEventListener('submit', event => { event.preventDefault(); submitAnswer(); });
    $('#answer-input').focus(); announce(`Question ${state.index+1} of 6. ${question.prompt}`); startTimer();
  }
  function findCurated(question, raw) {
    const key = normalize(raw);
    const custom = (additions[question.id] || []).find(item => normalize(item.answer) === key);
    if (custom) return {valid:true,depth:custom.depth,explanation:question.fact,source:'guide'};
    for (const group of question.answers) {
      const depth = group[group.length-1];
      if (group.slice(0,-1).some(answer => normalize(answer) === key)) return {valid:true,depth,explanation:question.fact,source:'chart'};
    }
    return null;
  }
  async function submitAnswer() {
    if (state.busy) return;
    const raw = $('#answer-input').value.trim();
    if (!normalize(raw)) { $('#inline-error').textContent = 'Enter an answer first.'; return; }
    state.pendingAnswer = raw;
    playTone(260,.07,0,.018);
    state.busy = true; stopTimer();
    $('#answer-input').readOnly = true;
    $('#guide-button').disabled = true;
    $('#inline-error').classList.add('judging-status');
    $('#inline-error').textContent = 'Checking answer… Timer paused.';
    $('#answer-button').disabled = true; $('#answer-button').setAttribute('aria-busy','true'); $('#answer-button .answer-label').textContent = 'Checking';
    const curated = findCurated(currentQuestion(),raw);
    if (curated) { award(raw,curated.depth,curated.explanation,true); return; }
    {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(),35000);
      try {
        const judgment = await window.DeepDiveAI.review(currentQuestion(),raw,{signal:controller.signal});
        if (judgment.needsReview === true) { unknownAnswer(); return; }
        if (judgment.valid === true && BANDS.includes(Number(judgment.depth))) {
          award(raw,Number(judgment.depth),typeof judgment.explanation === 'string' && judgment.explanation.length < 180 ? judgment.explanation : currentQuestion().fact,true); return;
        }
        if (judgment.valid === false) { rejectAnswer(typeof judgment.explanation === 'string' && judgment.explanation.length < 180 ? judgment.explanation : 'That does not fit this question. Try another answer.'); return; }
      } catch { /* Guide review remains available when the network is not. */ }
      finally { clearTimeout(timeout); }
    }
    unknownAnswer();
  }
  function rejectAnswer(message) {
    playTone(185,.14,0,.02);
    state.busy=false; state.remaining=Math.max(8,state.remaining);
    $('#guide-button').disabled=false;
    $('#answer-input').readOnly=false;
    $('#inline-error').classList.remove('judging-status');
    $('#inline-error').innerHTML=`${escapeHTML(message)} <button id="request-guide" class="inline-guide-button" type="button">Ask a guide</button>`;
    $('#request-guide').addEventListener('click',() => { stopTimer(); unknownAnswer(); });
    $('#answer-button').disabled=false; $('#answer-button').removeAttribute('aria-busy'); $('#answer-button .answer-label').textContent='Dive';
    $('#answer-input').focus(); startTimer();
  }
  function unknownAnswer() {
    state.phase = 'unknown'; state.busy=false;
    $('#guide-button').disabled=false;
    screen.innerHTML = `<div class="feedback-screen uncharted-screen"><h1>An uncharted answer.</h1><blockquote class="pending-answer">${escapeHTML(state.pendingAnswer)}</blockquote><p>A booth guide can check this answer, or you can try another.</p><div class="action-group"><button class="primary-button" id="ask-guide" type="button">Ask a guide ${icon()}</button><button class="secondary-button" id="try-again" type="button">Try another</button></div><div class="feedback-note">Timer paused</div></div>`;
    playTone(230,.13,0,.018);
    announce('This answer needs a booth guide to check it. Timer paused.');
    $('#ask-guide').addEventListener('click',openGuide);
    $('#try-again').addEventListener('click',() => { const answer=state.pendingAnswer; showQuestion(Math.max(8,state.remaining)); $('#answer-input').value=answer; $('#answer-input').select(); });
    $('#ask-guide').focus();
  }
  function award(answer,depth,explanation,valid) {
    stopTimer(); state.phase='feedback'; state.busy=false;
    $('#guide-button').disabled=false;
    state.depth += depth;
    state.results.push({question:currentQuestion().prompt,answer:answer || 'No answer',depth});
    const exceptional = depth === 1000;
    if (depth) playAward(depth);
    else playTone(180,.18,0,.025);
    updateDepth();
    if (exceptional) { ocean.classList.remove('rare-flash'); void ocean.offsetWidth; ocean.classList.add('rare-flash'); setTimeout(() => ocean.classList.remove('rare-flash'),1300); }
    if (depth >= 600) {
      const vignette=$('#reward-vignette');
      clearTimeout(rewardTimeout);
      vignette.className='reward-vignette';
      void vignette.offsetWidth;
      vignette.classList.add(exceptional?'exceptional-reward':'great-reward');
      rewardTimeout=setTimeout(()=>vignette.className='reward-vignette',1600);
    }
    const label = depth === 1000 ? 'Remarkable find' : depth === 600 ? 'A deep answer' : depth === 300 ? 'Nice thinking' : depth === 100 ? 'Dive underway' : 'Keep diving';
    const next = state.index === 5 ? 'See your dive' : 'Next question';
    screen.innerHTML = `<div class="feedback-screen ${exceptional?'exceptional':''}"><div class="award-line"><div class="award-number"><span class="award-plus">${depth?'+':''}</span>${depth.toLocaleString()}<small>m</small></div><span class="award-status">${label}</span></div><h1>${answer ? escapeHTML(answer) : 'Time is up'}</h1><p>${escapeHTML(explanation)}</p><button class="primary-button" id="next-button" type="button">${next} ${icon()}</button></div>`;
    if (!depth && answer) playTone(200,.16,0,.022);
    announce(`${label}. ${answer || 'No answer'}. ${depth} metres added. Total depth ${state.depth} metres.`);
    $('#next-button').addEventListener('click',() => { state.index++; state.index >= 6 ? showResult() : showQuestion(); });
    $('#next-button').focus();
  }
  function showResult() {
    stopTimer(); state.phase='result'; updateDepth();
    const title = state.depth >= 3500 ? 'You reached the deep.' : state.depth >= 1800 ? 'A good descent.' : 'Every answer moved you.';
    const rows = state.results.map((r,i) => `<li title="${escapeHTML(r.question)}"><span class="result-num" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="result-answer"><span class="visually-hidden">${escapeHTML(r.question)} </span>${escapeHTML(r.answer)}</span><strong>${r.depth?'+':''}${r.depth.toLocaleString()} m</strong></li>`).join('');
    screen.innerHTML = `<div class="result-screen"><h1>${title}</h1><div class="result-total"><span>${state.depth.toLocaleString()}</span><small>metres deep</small></div><ol class="result-list">${rows}</ol><div class="result-actions"><button class="primary-button" id="play-again" type="button">Dive again ${icon('down')}</button><span>New questions on the next dive</span></div></div>`;
    document.dispatchEvent(new CustomEvent('deep-dive:complete', {detail:{depth:state.depth,timed:state.timed,answers:state.results.map(result => ({...result}))}}));
    playTone(state.depth >= 1800 ? 523 : 392,.2,0,.03);
    announce(`Dive complete. ${state.depth} metres deep.`);
    $('#play-again').addEventListener('click',intro); $('#play-again').focus();
  }
  function openGuide() {
    guidePausedTimer = state.phase === 'question' && state.timer !== null;
    if (guidePausedTimer) stopTimer();
    const pending = state.phase === 'unknown' ? `<div class="guide-review"><div class="guide-subtitle">Review this answer</div><p><strong>${escapeHTML(state.pendingAnswer)}</strong><br>${escapeHTML(currentQuestion().prompt)}</p><div class="guide-band-buttons">${BANDS.map(depth => `<button type="button" data-depth="${depth}">${depth.toLocaleString()} m</button>`).join('')}</div><button type="button" class="secondary-button reject-button" id="guide-reject">Doesn’t fit</button></div>` : '<p class="guide-idle">No answer is waiting for review.</p>';
    guideContent.innerHTML = pending;
    guideDialog.showModal();
    guideContent.querySelectorAll('[data-depth]').forEach(button => button.addEventListener('click',() => {
      const depth = Number(button.dataset.depth); const question = currentQuestion();
      additions[question.id] ||= [];
      additions[question.id].push({answer:state.pendingAnswer,depth}); saveJSON(STORAGE.additions,additions);
      guideDialog.close(); award(state.pendingAnswer,depth,question.fact,true);
    }));
    const reject = $('#guide-reject'); if (reject) reject.addEventListener('click',() => { const remaining=Math.max(8,state.remaining); guideDialog.close(); showQuestion(remaining); $('#inline-error').textContent='That answer does not fit. Try another.'; });
  }
  $('#guide-button').addEventListener('click',openGuide);
  guideDialog.addEventListener('close',() => { if (guidePausedTimer && state.phase === 'question' && !state.busy) startTimer(); guidePausedTimer=false; });
  $('#sound-button').addEventListener('click',() => { soundOn=!soundOn; saveJSON(STORAGE.sound,soundOn); updateSoundButton(); if (soundOn) playTone(440,.08); });
  const fullscreenButton = $('#fullscreen-button');
  const exitFullscreen = document.createElement('button');
  exitFullscreen.type = 'button'; exitFullscreen.className = 'fullscreen-exit'; exitFullscreen.textContent = 'Exit full screen'; exitFullscreen.hidden = true;
  app.append(exitFullscreen);
  function syncFullscreenControls() {
    const active = Boolean(document.fullscreenElement || app.classList.contains('theatre-mode'));
    fullscreenButton.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
    fullscreenButton.title = active ? 'Exit full screen' : 'Enter full screen';
    exitFullscreen.hidden = !active;
  }
  function leaveTheatreMode() {
    app.classList.remove('theatre-mode');
    document.body.classList.remove('theatre-active');
    syncFullscreenControls();
  }
  function enterTheatreMode() {
    app.classList.add('theatre-mode');
    document.body.classList.add('theatre-active');
    syncFullscreenControls();
    announce('Theatre view is on. Press Escape or use Exit full screen to leave.');
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (app.classList.contains('theatre-mode')) leaveTheatreMode();
      else if (app.requestFullscreen) await app.requestFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else enterTheatreMode();
    } catch { enterTheatreMode(); }
  }
  fullscreenButton.addEventListener('click',toggleFullscreen);
  exitFullscreen.addEventListener('click',() => document.fullscreenElement ? document.exitFullscreen?.() : leaveTheatreMode());
  document.addEventListener('fullscreenchange',() => {
    syncFullscreenControls();
  });

  const interactiveTarget = target => target instanceof Element && target.closest('input,textarea,select,button,a,[contenteditable="true"],summary,[role="textbox"],[role="button"]');
  const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || dialogOpen()) return;
    if (event.key === 'Escape' && app.classList.contains('theatre-mode')) { event.preventDefault(); leaveTheatreMode(); return; }
    if (state.phase === 'question') {
      if (state.busy) return;
      const input = $('#answer-input');
      if (event.key === 'Enter') {
        if (interactiveTarget(event.target) && event.target !== input) return;
        event.preventDefault();
        if (!state.busy) { if (!input.value.trim()) input.focus(); else submitAnswer(); }
        return;
      }
      if (event.key.length !== 1 || interactiveTarget(event.target)) return;
      if (getSelection()?.toString()) return;
      event.preventDefault();
      input.focus();
      input.setRangeText(event.key, input.selectionStart, input.selectionEnd, 'end');
      input.dispatchEvent(new Event('input', {bubbles:true}));
      return;
    }
    if (event.key !== 'Enter' || interactiveTarget(event.target)) return;
    if (state.phase === 'intro') { event.preventDefault(); $('#start-button')?.click(); }
    else if (state.phase === 'feedback') { event.preventDefault(); $('#next-button')?.click(); }
    else if (state.phase === 'result') { event.preventDefault(); $('#play-again')?.click(); }
  });
  document.addEventListener('click', event => {
    if (state.phase === 'question' && !dialogOpen() && !interactiveTarget(event.target) && event.target !== $('#answer-input')) $('#answer-input').focus();
  });
  window.addEventListener('focus', () => { if (state.phase === 'question' && !dialogOpen()) $('#answer-input').focus(); });
  $('#clear-chart').addEventListener('click',() => { if (confirm('Clear every guide-added answer on this laptop?')) { additions={}; saveJSON(STORAGE.additions,additions); $('#clear-chart').textContent='Guide answers cleared'; setTimeout(() => $('#clear-chart').textContent='Clear guide-added answers',1500); } });
  updateSoundButton(); intro();
})();
