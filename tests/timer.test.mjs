import assert from 'node:assert/strict';
import {
  freshState, validMinutes, elapsed, remaining, overtime, deadline,
  formatTime, durationText, advance, begin, pause, resume, finish, restore,
} from '../dist/timer.mjs';

for (const minutes of [15, 25, 45, 60, 120, 1, 1440]) {
  const session = begin({ ...freshState(), minutes }, 1000);
  assert.equal(remaining(session, 1000), minutes * 60);
  assert.equal(deadline(session), 1000 + minutes * 60000);
}
for (const value of ['', 0, -1, 1.5, 1441, 'abc', Infinity]) assert.equal(validMinutes(value), false);
assert.equal(formatTime(7200), '2:00:00');
assert.equal(formatTime(3600), '1:00:00');
assert.equal(formatTime(3599), '59:59');
assert.equal(durationText(120), '2 hours');

// Pauses retain fractions of a second and do not count time spent away.
let session = begin({ ...freshState(), minutes: 120, intention: 'Read', hideTime: true }, 1000);
session = pause(session, 62350);
assert.equal(elapsed(session), 61.35);
assert.equal(remaining(session, 900000), 7139);
session = resume(session, 900000);
assert.equal(elapsed(session, 901000), 62.35);
assert.equal(remaining(session, 901000), 7138);
session = restore(JSON.parse(JSON.stringify(session)), null, 901000);
assert.equal(elapsed(session, 901000), 62.35);
assert.equal(session.hideTime, true);
assert.equal(deadline(session), 8038650);

// A gentle time marker leaves the session running and does not create a new alarm.
session = advance(session, deadline(session) + 65000);
assert.equal(session.phase, 'running');
assert.equal(session.markerReached, true);
assert.equal(remaining(session), 0);
assert.equal(deadline(session), null);
assert.equal(overtime(session, 8103650), 65);
const restored = restore(JSON.parse(JSON.stringify(session)), null, 8105650);
assert.equal(overtime(restored, 8105650), 67);
assert.equal(deadline(restored), null);
session = pause(restored, 8105650);
assert.equal(session.phase, 'paused');
assert.equal(overtime(session, 99999999), 67);
session = resume(session, 9000000);
assert.equal(overtime(session, 9001000), 68);
assert.equal(deadline(session), null);

// A chosen firm ending still supports meditation and fixed-time sessions.
session = begin({ ...freshState(), minutes: 1, softEnd: false }, 1000);
session = pause(session, 61000);
assert.equal(session.phase, 'complete');
assert.equal(elapsed(session), 60);
assert.equal(deadline(session), null);
assert.equal(advance(session, 1000000), session);

// Open-ended sessions count active time beyond any chosen duration.
session = begin({ ...freshState(), mode: 'open', chime: true }, 1000);
assert.equal(deadline(session), null);
session = advance(session, 7201000);
assert.equal(session.phase, 'running');
assert.equal(session.markerReached, false);
assert.equal(elapsed(session, 7201000), 7200);
session = pause(session, 7201350);
assert.equal(elapsed(session, 9000000), 7200.35);
session = restore(JSON.parse(JSON.stringify(session)), null, 10000000);
assert.equal(session.phase, 'paused');
assert.equal(session.mode, 'open');
session = resume(session, 10000000);
assert.equal(elapsed(session, 10001000), 7201.35);

// A note becomes the next starting point, with its task preserved.
session = { ...session, intention: 'Study chapter 4', nextStep: '  Try exercise 3  ' };
const draft = restore(JSON.parse(JSON.stringify(session)), null, 10001000);
assert.equal(draft.nextStep, '  Try exercise 3  ');
session = finish(draft);
assert.equal(session.phase, 'setup');
assert.equal(session.firstStep, 'Try exercise 3');
assert.deepEqual(session.bookmark, { intention: 'Study chapter 4', step: 'Try exercise 3' });
session = restore(JSON.parse(JSON.stringify(session)), null, 10002000);
assert.equal(session.firstStep, 'Try exercise 3');
session = begin(session, 10002000);
assert.equal(session.nextStep, '');
assert.equal(session.firstStep, 'Try exercise 3');
assert.equal(elapsed(session, 10002000), 0);
session = finish(session);
assert.equal(session.bookmark, null);
assert.equal(session.firstStep, '');

// Existing v2 sessions retain their time and original firm ending.
const v2 = {
  version: 2, intention: 'Meditate', firstStep: 'Settle in', minutes: 120,
  chime: true, hideTime: true, phase: 'running', total: 7200, remaining: 7139,
  endAt: 8039000,
};
session = restore(v2, null, 901000);
assert.equal(session.version, 3);
assert.equal(remaining(session, 901000), 7138);
assert.equal(session.softEnd, false);
assert.equal(session.chime, true);
assert.equal(session.hideTime, true);
assert.equal(deadline(session), v2.endAt);
assert.equal(restore(v2, null, v2.endAt + 1000).phase, 'complete');
session = restore({ ...v2, phase: 'paused', endAt: null }, null, 9000000);
assert.equal(remaining(session), 7139);
assert.equal(elapsed(session), 61);
assert.equal(restore({ ...v2, phase: 'setup' }, null).softEnd, true);

const legacy = { goal: 'Read', steps: ['Open book', 'Read chapter', 'Reflect'], checks: [true, false, false], remaining: 1800, end: 1801000 };
session = restore(null, legacy, 61000);
assert.equal(session.intention, 'Read');
assert.equal(session.firstStep, 'Read chapter');
assert.equal(remaining(session, 61000), 1740);
assert.equal(session.minutes, 30);
assert.equal(restore(null, { ...legacy, end: 1 }, 61000).phase, 'complete');
assert.equal(restore({ garbage: 1 }, null).phase, 'setup');
assert.equal(restore({ ...freshState(), phase: 'running', startedAt: null }, null).phase, 'setup');
assert.equal(restore({ ...freshState(), elapsedMs: -1 }, null).phase, 'setup');
assert.equal(restore({ ...freshState(), bookmark: { step: 7 } }, null).bookmark, null);
console.log('Passed: timed/open sessions, gentle/firm endings, precise pause/resume, reload, alarm deadlines, next-time notes, and v1/v2 migration.');
