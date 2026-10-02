import {
  PRESETS, validMinutes, elapsed, remaining, overtime, deadline,
  formatTime, durationText, advance, begin, pause, resume, finish, restore,
} from './timer.mjs';

const $ = id => document.getElementById(id);
const KEY = 'in-flow-v3';
function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
let state = restore(read(KEY) ?? read('in-flow-v2'), read('next-thirty-v1'));
let customMode = !PRESETS.includes(state.minutes);
let lastPhase = null;
let audioContext = null;
let scheduled = [];
let previewNodes = [];
let finishRequested = false;

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { $('storage-note').textContent = 'Saving is unavailable in this browser session.'; }
}

const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let themeChoice;
try { themeChoice = localStorage.getItem('next-thirty-theme'); } catch {}
if (!['light', 'dark'].includes(themeChoice)) themeChoice = null;
function renderTheme() {
  const theme = themeChoice || (systemTheme.matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  const label = theme === 'dark' ? 'Light mode' : 'Dark mode';
  $('theme-toggle').querySelector('span').textContent = label;
  $('theme-toggle').setAttribute('aria-label', `Switch to ${label.toLowerCase()}`);
}
$('theme-toggle').addEventListener('click', () => {
  themeChoice = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('next-thirty-theme', themeChoice); } catch {}
  renderTheme();
});
systemTheme.addEventListener('change', () => { if (!themeChoice) renderTheme(); });
renderTheme();

function renderReturnNote() {
  const matches = Boolean(state.bookmark && state.bookmark.intention === state.intention.trim() && state.bookmark.step.trim() === state.firstStep.trim());
  $('return-note').hidden = !matches;
  $('return-step').textContent = matches ? state.firstStep : '';
  return matches;
}
function renderDuration() {
  const timed = state.mode === 'timed';
  document.querySelectorAll('[data-minutes]').forEach(button => {
    button.setAttribute('aria-pressed', String(timed && !customMode && Number(button.dataset.minutes) === state.minutes));
  });
  $('custom-toggle').setAttribute('aria-pressed', String(timed && customMode));
  $('custom-toggle').setAttribute('aria-expanded', String(timed && customMode));
  $('custom-field').hidden = !timed || !customMode;
  $('open-toggle').setAttribute('aria-pressed', String(!timed));
  $('timed-settings').hidden = !timed;
}
function durationError() {
  const valid = state.mode === 'open' || !customMode || validMinutes($('custom-minutes').value);
  $('duration-error').textContent = valid ? '' : 'Choose a whole number from 1 to 1,440 minutes.';
  $('custom-minutes').setAttribute('aria-invalid', String(!valid));
  return valid;
}
function renderEnding() {
  $('soft-ending').checked = state.softEnd;
  $('ending-note').textContent = state.softEnd
    ? "Your time is a gentle marker. Finish when you're ready."
    : 'Your session will close when time is up.';
}
function syncForm() {
  $('intention').value = state.intention;
  $('first-step').value = state.firstStep;
  $('starting-help').open = Boolean(state.firstStep) && !renderReturnNote();
  $('custom-minutes').value = state.minutes;
  $('chime').checked = state.chime;
  renderDuration();
  renderEnding();
  renderSoundNote();
  renderFinishButtons();
}
function renderSoundNote() {
  $('sound-note').hidden = !state.chime;
  $('sound-note').textContent = 'Keep this tab open. Device sleep may delay the chime.';
}

function stopNodes(nodes) {
  nodes.forEach(({ osc, gain }) => {
    try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch {}
  });
  nodes.length = 0;
}
function cancelChime() { stopNodes(scheduled); }
async function readyAudio() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    audioContext ??= new Audio();
    await audioContext.resume();
    return audioContext.state === 'running';
  } catch { return false; }
}
function bell(at) {
  return [528, 792].map((frequency, i) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(i === 0 ? .10 : .035, at + .04);
    gain.gain.exponentialRampToValueAtTime(.0001, at + 2.6);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(at);
    osc.stop(at + 2.7);
    return { osc, gain };
  });
}
function scheduleChime() {
  cancelChime();
  const at = deadline(state);
  if (state.chime && at !== null && audioContext?.state === 'running') {
    scheduled = bell(audioContext.currentTime + Math.max(0, (at - Date.now()) / 1000));
  }
  renderAudioControl();
}
function renderAudioControl() {
  const needed = state.chime && deadline(state) !== null && !(scheduled.length && audioContext?.state === 'running');
  $('enable-chime').hidden = !needed;
}
$('preview-chime').addEventListener('click', async () => {
  if (await readyAudio()) {
    stopNodes(previewNodes);
    previewNodes = bell(audioContext.currentTime + .02);
  } else {
    $('sound-note').hidden = false;
    $('sound-note').textContent = 'Sound is unavailable in this browser. The timer will still work.';
  }
});
$('chime').addEventListener('change', () => {
  state.chime = $('chime').checked;
  save();
  renderSoundNote();
});
$('soft-ending').addEventListener('change', () => {
  state.softEnd = $('soft-ending').checked;
  save();
  renderEnding();
});

function announce(message) { $('announcement').textContent = message; }
function renderFinishButtons() {
  const hasNote = Boolean(state.nextStep.trim());
  $('confirm-finish').textContent = hasNote ? 'Save & finish' : 'Finish session';
  $('complete-finish').textContent = hasNote ? 'Save & finish' : 'Finish';
}
function render(focus = false) {
  const before = state;
  const now = Date.now();
  state = advance(state, now);
  if (state !== before) {
    save();
    announce(state.phase === 'complete' ? 'Your time is complete.' : "Your chosen time has passed. Finish whenever you're ready.");
  }
  const setup = state.phase === 'setup';
  const complete = state.phase === 'complete';
  const paused = state.phase === 'paused';
  $('setup').hidden = !setup;
  $('session').hidden = setup || complete;
  $('complete').hidden = !complete;
  document.body.dataset.phase = state.phase;
  document.title = 'in flow';
  if (setup || complete) finishRequested = false;
  $('finish-question').hidden = !finishRequested;
  $('session-actions').hidden = finishRequested;
  $('keep-session').textContent = paused ? 'Keep paused' : 'Keep going';

  if (!setup && !complete) {
    const open = state.mode === 'open';
    const beyond = !open && state.markerReached;
    $('session-title').textContent = state.intention.trim() || 'Time for yourself.';
    $('session-start').textContent = state.firstStep.trim();
    $('session-start').hidden = !state.firstStep.trim();
    $('session-label').textContent = paused ? 'Paused' : 'Your time';
    $('clock').textContent = open ? formatTime(Math.floor(elapsed(state, now)))
      : beyond ? '+' + formatTime(overtime(state, now)) : formatTime(remaining(state, now));
    $('clock-label').textContent = open ? 'Elapsed' : beyond ? 'Beyond your chosen time' : 'Remaining';
    $('clock').setAttribute('aria-label', open ? 'Time spent' : beyond ? 'Time beyond your chosen duration' : 'Time remaining');
    $('progress').style.strokeDashoffset = 289.027 * (1 - remaining(state, now) / state.total);
    $('timer-face').querySelector('.ring').style.display = open ? 'none' : '';
    $('timer-face').hidden = state.hideTime;
    $('quiet-face').hidden = !state.hideTime;
    $('quiet-label').textContent = paused ? 'Take your time.' : beyond ? "Finish whenever you're ready." : 'Your time is held.';
    $('hide-time').textContent = state.hideTime ? 'Show time' : 'Hide time';
    $('hide-time').setAttribute('aria-pressed', String(state.hideTime));
    $('pause').textContent = paused ? 'Resume' : 'Pause';
    renderAudioControl();
  }
  if (complete) {
    $('complete-intention').textContent = state.intention.trim() || 'Take a moment before moving on.';
    $('continue-note').textContent = `Another ${durationText(state.minutes)}, with the same focus.`;
    if (lastPhase !== 'complete') $('complete-next-step').value = state.nextStep;
  }
  if (state.phase !== lastPhase) {
    if (focus || lastPhase !== null) {
      if (setup) $('setup-title').focus();
      else if (complete) $('complete-title').focus();
      else if (lastPhase === 'setup' || lastPhase === 'complete') $('session-title').focus();
    }
    lastPhase = state.phase;
  }
}

$('intention').addEventListener('input', event => {
  state.intention = event.target.value;
  if (state.bookmark && state.firstStep === state.bookmark.step && state.intention.trim() !== state.bookmark.intention) {
    state.firstStep = '';
    $('first-step').value = '';
  } else if (state.bookmark && !state.firstStep && state.intention.trim() === state.bookmark.intention) {
    state.firstStep = state.bookmark.step;
    $('first-step').value = state.firstStep;
  }
  save();
  renderReturnNote();
});
$('first-step').addEventListener('input', event => {
  state.firstStep = event.target.value;
  if (state.bookmark && state.bookmark.intention === state.intention.trim()) {
    state.bookmark = state.firstStep.trim() ? { ...state.bookmark, step: state.firstStep } : null;
  }
  save();
  renderReturnNote();
});
$('edit-start').addEventListener('click', () => {
  $('starting-help').open = true;
  $('first-step').focus();
});
function chooseMode(mode) {
  state.mode = mode;
  $('duration-error').textContent = '';
  $('custom-minutes').setAttribute('aria-invalid', 'false');
  save();
  renderDuration();
}
document.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => {
  state.minutes = Number(button.dataset.minutes);
  state.total = state.minutes * 60;
  customMode = false;
  chooseMode('timed');
}));
$('open-toggle').addEventListener('click', () => chooseMode('open'));
$('custom-toggle').addEventListener('click', () => {
  customMode = true;
  $('custom-minutes').value = state.minutes;
  chooseMode('timed');
  $('custom-minutes').focus();
  $('custom-minutes').select();
});
$('custom-minutes').addEventListener('input', () => {
  if (validMinutes($('custom-minutes').value)) {
    state.minutes = Number($('custom-minutes').value);
    state.total = state.minutes * 60;
    save();
    $('duration-error').textContent = '';
    $('custom-minutes').setAttribute('aria-invalid', 'false');
  }
});
$('custom-minutes').addEventListener('blur', durationError);

async function startSession() {
  finishRequested = false;
  $('session-message').hidden = true;
  cancelChime();
  stopNodes(previewNodes);
  state = begin(state);
  save();
  renderFinishButtons();
  render(true);
  if (state.chime && state.mode === 'timed') {
    await readyAudio();
    scheduleChime();
  }
}
$('session-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!durationError()) { $('custom-minutes').focus(); return; }
  state.intention = $('intention').value;
  state.firstStep = $('first-step').value;
  return startSession();
});
$('pause').addEventListener('click', async () => {
  if (state.phase === 'running') {
    state = pause(state);
    if (state.phase === 'paused') cancelChime();
    save();
    render();
  } else if (state.phase === 'paused') {
    state = resume(state);
    save();
    render();
    if (state.chime && deadline(state) !== null) {
      await readyAudio();
      scheduleChime();
    }
  }
});
$('hide-time').addEventListener('click', () => {
  state.hideTime = !state.hideTime;
  save();
  render();
});
function finishSession() {
  cancelChime();
  stopNodes(previewNodes);
  state = finish(state);
  save();
  syncForm();
  render(true);
}
$('finish').addEventListener('click', () => {
  render();
  if (state.phase === 'complete') return;
  finishRequested = true;
  $('next-step').value = state.nextStep;
  renderFinishButtons();
  render();
  $('keep-session').focus();
});
function keepSession() {
  finishRequested = false;
  render();
  if (state.phase === 'running' || state.phase === 'paused') $('finish').focus();
}
$('keep-session').addEventListener('click', keepSession);
$('finish-question').addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); keepSession(); }
});
for (const id of ['next-step', 'complete-next-step']) {
  $(id).addEventListener('input', event => {
    state.nextStep = event.target.value;
    save();
    renderFinishButtons();
  });
  $(id).addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); finishSession(); }
  });
}
$('confirm-finish').addEventListener('click', finishSession);
$('complete-finish').addEventListener('click', finishSession);
$('continue').addEventListener('click', () => {
  state = finish(state);
  return startSession();
});
$('enable-chime').addEventListener('click', async () => {
  if (await readyAudio()) {
    $('session-message').hidden = true;
    scheduleChime();
  } else {
    $('session-message').textContent = 'Sound is unavailable in this browser. The timer will still work.';
    $('session-message').hidden = false;
  }
});
document.addEventListener('visibilitychange', () => {
  render();
  if (!document.hidden && state.phase === 'running' && audioContext?.state === 'running' && deadline(state) !== null) scheduleChime();
});
syncForm();
render();
save();
setInterval(() => render(), 500);
