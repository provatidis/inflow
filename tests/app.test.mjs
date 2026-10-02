import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as timer from '../dist/timer.mjs';

// Exercise the shipped app against its real HTML IDs and event handlers.
// This DOM harness does not replace visual or device testing.
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../dist/app.mjs', import.meta.url), 'utf8').replace(/^import[\s\S]*?from '\.\/timer\.mjs';/, '');

function app(saved = {}, { sound = false, saving = true } = {}) {
  let now = 10000;
  let tick;
  const storage = new Map(Object.entries(saved));
  const tones = [];
  const doc = { hidden: false, activeElement: null, listeners: {} };
  class Element {
    constructor(tag, attrs = {}) {
      this.tag = tag;
      this.attrs = attrs;
      this.children = [];
      this.listeners = {};
      this.hidden = 'hidden' in attrs;
      this.checked = 'checked' in attrs;
      this.open = 'open' in attrs;
      this.value = attrs.value || '';
      this.dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5), value]));
      this.style = {};
      this.textContent = '';
    }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); }
    focus() { doc.activeElement = this; }
    select() {}
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      const match = node => selector.startsWith('.') ? (node.attrs.class || '').split(' ').includes(selector.slice(1))
        : selector.startsWith('[') ? selector.slice(1, -1) in node.attrs : node.tag === selector;
      return this.children.flatMap(node => [...(match(node) ? [node] : []), ...node.querySelectorAll(selector)]);
    }
    async emit(type, props = {}) {
      const event = { target: this, preventDefault() {}, ...props };
      for (const handler of this.listeners[type] || []) await handler(event);
      await Promise.resolve();
    }
  }
  const root = new Element('root');
  const stack = [root];
  const ids = new Map();
  const voids = new Set(['meta', 'link', 'input', 'br']);
  for (const match of html.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/<\/?([\w-]+)\b([^>]*)>/g)) {
    const [tagText, tag, attributes] = match;
    if (tagText.startsWith('</')) { stack.pop(); continue; }
    const attrs = Object.fromEntries([...attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? '']));
    const node = new Element(tag, attrs);
    stack.at(-1).children.push(node);
    if (attrs.id) { assert.equal(ids.has(attrs.id), false, 'HTML IDs must be unique'); ids.set(attrs.id, node); }
    if (tag === 'body') doc.body = node;
    if (tag === 'html') doc.documentElement = node;
    if (!voids.has(tag) && !tagText.endsWith('/>')) stack.push(node);
  }
  doc.getElementById = id => ids.get(id) || null;
  doc.querySelectorAll = selector => root.querySelectorAll(selector);
  doc.addEventListener = (type, handler) => { doc.listeners[type] = handler; };
  class Audio {
    state = 'suspended';
    destination = {};
    get currentTime() { return now / 1000; }
    async resume() { this.state = 'running'; }
    createOscillator() {
      const tone = { frequency: { value: 0 }, connect() {}, disconnect() {}, start(at) { tone.at = at; tones.push(tone); }, stop() {} };
      return tone;
    }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const bindings = { ...timer };
  for (const name of ['elapsed', 'remaining', 'overtime', 'advance', 'begin', 'pause', 'resume']) bindings[name] = (state, at = now) => timer[name](state, at);
  bindings.restore = (state, legacy, at = now) => timer.restore(state, legacy, at);
  const context = vm.createContext({
    ...bindings, document: doc, window: sound ? { AudioContext: Audio } : {},
    Date: { now: () => now },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { if (!saving) throw Error('Storage unavailable'); storage.set(key, value); } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setInterval: handler => { tick = handler; },
  });
  vm.runInContext(source, context, { filename: 'dist/app.mjs' });
  return {
    get: id => { assert.ok(ids.has(id), 'Missing HTML element: ' + id); return ids.get(id); },
    state: () => JSON.parse(storage.get('in-flow-v3')),
    storage: () => Object.fromEntries(storage), doc, tones,
    tick: milliseconds => { now += milliseconds; tick(); },
  };
}

let ui = app({ 'in-flow-v3': JSON.stringify({ ...timer.freshState(), minutes: 1 }) });
ui.get('intention').value = 'Write chapter two';
await ui.get('intention').emit('input');
await ui.get('session-form').emit('submit');
assert.equal(ui.get('session').hidden, false);
assert.equal(ui.get('session-title').textContent, 'Write chapter two');
await ui.get('hide-time').emit('click');
assert.equal(ui.get('timer-face').hidden, true);
assert.equal(ui.get('quiet-face').hidden, false);
const focusBeforeMarker = ui.doc.activeElement;
ui.tick(60000);
assert.equal(ui.state().markerReached, true);
assert.equal(ui.get('session').hidden, false);
assert.equal(ui.get('complete').hidden, true);
assert.equal(ui.doc.activeElement, focusBeforeMarker, 'A gentle marker must not move keyboard focus');
ui.tick(2000);
assert.equal(ui.get('clock').textContent, '+00:02');
await ui.get('finish').emit('click');
assert.equal(ui.get('finish-question').hidden, false);
ui.get('next-step').value = 'Introduce the second character';
await ui.get('next-step').emit('input');
assert.equal(ui.get('confirm-finish').textContent, 'Save & finish');
await ui.get('confirm-finish').emit('click');
assert.equal(ui.get('setup').hidden, false);
assert.equal(ui.get('return-note').hidden, false);
assert.equal(ui.get('return-step').textContent, 'Introduce the second character');
ui = app(ui.storage());
assert.equal(ui.get('return-step').textContent, 'Introduce the second character');
assert.equal(ui.get('first-step').value, 'Introduce the second character');
ui.get('intention').value = 'A different task';
await ui.get('intention').emit('input');
assert.equal(ui.get('return-note').hidden, true);
assert.equal(ui.get('first-step').value, '', 'A saved starting point must not follow an unrelated task');
ui.get('intention').value = 'Write chapter two';
await ui.get('intention').emit('input');
assert.equal(ui.get('first-step').value, 'Introduce the second character');
assert.equal(ui.get('return-note').hidden, false);
await ui.get('session-form').emit('submit');
assert.equal(ui.get('session-start').textContent, 'Introduce the second character');
await ui.get('finish').emit('click');
await ui.get('keep-session').emit('click');
assert.equal(ui.get('finish-question').hidden, true);
assert.equal(ui.state().phase, 'running');

ui = app();
await ui.get('custom-toggle').emit('click');
ui.get('custom-minutes').value = '1.5';
await ui.get('session-form').emit('submit');
assert.equal(ui.state().phase, 'setup');
assert.equal(ui.get('custom-minutes').getAttribute('aria-invalid'), 'true');
await ui.get('open-toggle').emit('click');
assert.equal(ui.get('custom-field').hidden, true);
assert.equal(ui.get('timed-settings').hidden, true);
await ui.get('session-form').emit('submit');
ui.tick(7200000);
assert.equal(ui.get('clock').textContent, '2:00:00');
assert.equal(ui.get('clock-label').textContent, 'Elapsed');
assert.equal(ui.get('timer-face').querySelector('.ring').style.display, 'none');
assert.equal(ui.state().phase, 'running');
assert.equal(ui.get('enable-chime').hidden, true);
await ui.get('pause').emit('click');
ui.tick(100000);
assert.equal(ui.get('clock').textContent, '2:00:00');
ui = app(ui.storage());
assert.equal(ui.get('pause').textContent, 'Resume');

ui = app({ 'in-flow-v3': JSON.stringify({ ...timer.freshState(), minutes: 1, softEnd: false }) });
await ui.get('session-form').emit('submit');
ui.tick(60000);
assert.equal(ui.get('complete').hidden, false);
ui.get('complete-next-step').value = 'Read section three';
await ui.get('complete-next-step').emit('input');
await ui.get('continue').emit('click');
assert.equal(ui.get('session').hidden, false);
assert.equal(ui.get('session-start').textContent, 'Read section three');
assert.equal(ui.get('clock').textContent, '01:00');

ui = app({ 'in-flow-v3': JSON.stringify({ ...timer.freshState(), minutes: 1, chime: true }) }, { sound: true });
await ui.get('session-form').emit('submit');
assert.equal(ui.tones.length, 2, 'One bell consists of two tones');
ui.tick(61000);
await ui.doc.listeners.visibilitychange();
assert.equal(ui.tones.length, 2, 'Returning after the marker must not schedule another bell');
await ui.get('pause').emit('click');
await ui.get('pause').emit('click');
assert.equal(ui.tones.length, 2, 'Resuming beyond the marker must not schedule another bell');

ui = app({}, { saving: false });
assert.match(ui.get('storage-note').textContent, /Saving is unavailable/);
await ui.get('open-toggle').emit('click');
await ui.get('session-form').emit('submit');
assert.equal(ui.get('session').hidden, false, 'The timer must work when storage is blocked');
console.log('Passed: app controls, quiet overtime, focus preservation, next-time notes across reload, open sessions, validation, firm endings, single chime, and blocked storage.');
