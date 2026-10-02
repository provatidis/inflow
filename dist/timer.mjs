export const PRESETS = [15, 25, 45, 60, 120];

export const freshState = () => ({
  version: 3,
  intention: '',
  firstStep: '',
  nextStep: '',
  bookmark: null,
  mode: 'timed',
  minutes: 25,
  softEnd: true,
  chime: false,
  hideTime: false,
  phase: 'setup',
  total: 1500,
  elapsedMs: 0,
  startedAt: null,
  markerReached: false,
});

export function validMinutes(value) {
  const n = Number(value);
  return String(value).trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 1440;
}

export function elapsed(state, now = Date.now()) {
  const runningMs = state.phase === 'running' ? Math.max(0, now - state.startedAt) : 0;
  return (state.elapsedMs + runningMs) / 1000;
}

export function remaining(state, now = Date.now()) {
  return state.mode === 'timed' ? Math.max(0, Math.ceil(state.total - elapsed(state, now))) : 0;
}

export function overtime(state, now = Date.now()) {
  return Math.max(0, Math.floor(elapsed(state, now) - state.total));
}

export function deadline(state) {
  if (state.phase !== 'running' || state.mode !== 'timed' || state.markerReached) return null;
  return state.startedAt + state.total * 1000 - state.elapsedMs;
}

export function formatTime(seconds) {
  const n = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(n / 3600);
  const minutes = Math.floor(n % 3600 / 60);
  const secs = String(n % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${String(minutes).padStart(2, '0')}:${secs}`;
}

export function durationText(minutes) {
  return minutes % 60 === 0 ? `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}` : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export function advance(state, now = Date.now()) {
  if (state.phase !== 'running' || state.mode !== 'timed' || state.markerReached || remaining(state, now) > 0) return state;
  return state.softEnd
    ? { ...state, markerReached: true }
    : { ...state, phase: 'complete', elapsedMs: state.total * 1000, startedAt: null, markerReached: true };
}

export function begin(state, now = Date.now()) {
  return { ...state, phase: 'running', total: state.minutes * 60, elapsedMs: 0, startedAt: now, markerReached: false, nextStep: '' };
}

export function pause(state, now = Date.now()) {
  state = advance(state, now);
  return state.phase === 'running'
    ? { ...state, phase: 'paused', elapsedMs: Math.round(elapsed(state, now) * 1000), startedAt: null }
    : state;
}

export function resume(state, now = Date.now()) {
  return state.phase === 'paused' ? { ...state, phase: 'running', startedAt: now } : state;
}

export function finish(state, nextStep = state.nextStep) {
  const step = String(nextStep || '').trim().slice(0, 160);
  return {
    ...state,
    phase: 'setup',
    firstStep: step,
    nextStep: '',
    bookmark: step ? { intention: state.intention.trim(), step } : null,
    total: state.minutes * 60,
    elapsedMs: 0,
    startedAt: null,
    markerReached: false,
  };
}

const phases = ['setup', 'running', 'paused', 'complete'];
const validMs = n => Number.isSafeInteger(n) && n >= 0;

export function restore(saved, legacy, now = Date.now()) {
  const base = freshState();
  const common = saved && validMinutes(saved.minutes) && typeof saved.intention === 'string' && typeof saved.firstStep === 'string' && phases.includes(saved.phase);
  if (common && saved.version === 3 && ['timed', 'open'].includes(saved.mode) && validMs(saved.elapsedMs) && (saved.phase !== 'running' || validMs(saved.startedAt))) {
    const bookmark = saved.bookmark && typeof saved.bookmark.intention === 'string' && typeof saved.bookmark.step === 'string' && saved.bookmark.step.trim()
      ? { intention: saved.bookmark.intention.slice(0, 160), step: saved.bookmark.step.trim().slice(0, 160) }
      : null;
    return advance({
      ...base,
      intention: saved.intention.slice(0, 160), firstStep: saved.firstStep.slice(0, 160),
      nextStep: typeof saved.nextStep === 'string' ? saved.nextStep.slice(0, 160) : '', bookmark,
      minutes: Number(saved.minutes), total: Number(saved.minutes) * 60, mode: saved.mode,
      softEnd: saved.softEnd !== false, chime: saved.chime === true, hideTime: saved.hideTime === true,
      phase: saved.phase, elapsedMs: saved.phase === 'setup' ? 0 : saved.elapsedMs,
      startedAt: saved.phase === 'running' ? saved.startedAt : null, markerReached: saved.markerReached === true,
    }, now);
  }

  // Keep a session already in progress on its original timing behavior.
  if (common && saved.version === 2 && Number.isFinite(saved.total) && saved.total >= 60 && saved.total <= 86400 && Number.isFinite(saved.remaining) && saved.remaining >= 0 && saved.remaining <= saved.total && (saved.phase !== 'running' || validMs(saved.endAt))) {
    const left = saved.phase === 'running' ? Math.max(0, Math.min(saved.total, (saved.endAt - now) / 1000)) : saved.remaining;
    return advance({
      ...base,
      intention: saved.intention.slice(0, 160), firstStep: saved.firstStep.slice(0, 160),
      minutes: Number(saved.minutes), total: saved.total, softEnd: saved.phase === 'setup',
      chime: saved.chime === true, hideTime: saved.hideTime === true, phase: saved.phase,
      elapsedMs: saved.phase === 'setup' ? 0 : Math.round((saved.total - left) * 1000),
      startedAt: saved.phase === 'running' ? now : null, markerReached: saved.phase === 'complete',
    }, now);
  }

  if (legacy && typeof legacy.goal === 'string') {
    const step = Array.isArray(legacy.steps) ? legacy.steps.find((s, i) => typeof s === 'string' && s.trim() && !legacy.checks?.[i]) : '';
    const old = { version: 2, intention: legacy.goal, firstStep: step || '', minutes: 30, total: 1800, remaining: legacy.remaining, phase: 'setup' };
    if (Number.isFinite(legacy.remaining) && legacy.remaining >= 0 && legacy.remaining <= 1800) {
      if (validMs(legacy.end)) { old.phase = 'running'; old.endAt = legacy.end; }
      else if (legacy.remaining === 0) old.phase = 'complete';
      else if (legacy.remaining < 1800) old.phase = 'paused';
      return restore(old, null, now);
    }
    return { ...base, intention: legacy.goal.slice(0, 160), firstStep: (step || '').slice(0, 160) };
  }
  return base;
}
