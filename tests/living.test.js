import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY, analyse } from '../dist/engine.js';
import { createRoom } from '../dist/data.js';
import {
  multiverse,
  tinyChanges,
  stressCases,
  replayFrames,
  frameResult,
  storyFor,
  closingEdges,
} from '../dist/living-engine.js';
import { createLivingLab } from '../dist/living.js';
const p = (extra = {}) => ({
  ...DEFAULT_POLICY,
  open: 540,
  close: 1080,
  lastBus: 1200,
  buffer: 0,
  days: ['Mon'],
  weighting: false,
  ...extra,
});
const person = (extra = {}) => ({
  id: 'r1',
  name: 'Resident',
  group: 'Learners',
  arrive: 975,
  leaveBy: 1200,
  duration: 60,
  travelIn: 0,
  travelOut: 0,
  weight: 1,
  priority: 0,
  days: ['Mon'],
  ...extra,
});
const fixture = () => ({
  id: 'room',
  title: 'Model fixture',
  people: [person()],
  baseline: p(),
  policy: p({ close: 1020 }),
  scenarios: [],
  updatedAt: '2026-11-02T12:00:00Z',
});
test('stress losses are relative to the proposal and do not recount existing losses', () => {
  const room = fixture();
  assert.equal(
    analyse(room.people, room.baseline, room.policy).metrics.lost,
    1,
  );
  const power = stressCases(room).find((c) => c.id === 'powerOut');
  assert.equal(power.delta.metrics.lost, 0);
  assert.equal(power.result.metrics.lost, 1);
});
test('tiny trials change exactly one variable and cannot silently rewrite the baseline', () => {
  const room = fixture(),
    before = structuredClone(room);
  for (const c of tinyChanges(room)) {
    assert.equal(Object.keys(c.patch).length, 1);
    assert.ok(c.policy.open < c.policy.close);
  }
  assert.deepEqual(room, before);
});
test('a single extra computer cannot recover access blocked by seat capacity', () => {
  const room = fixture();
  room.people = [
    person({ id: 'one', arrive: 900, leaveBy: 960 }),
    person({ id: 'two', arrive: 900, leaveBy: 960 }),
  ];
  room.policy = p({ seats: 1, computers: 1 });
  room.baseline = p({ seats: 2, computers: 2 });
  room.people.forEach((v) => (v.computer = true));
  const trial = tinyChanges(room).find((c) => c.id === 'screen1');
  assert.equal(trial.delta.metrics.gained, 0);
  assert.equal(trial.result.metrics.served, 1);
});
test('the baseline branch preserves the selected days and representation basis', () => {
  const room = fixture();
  room.baseline.days = ['Tue'];
  room.baseline.weighting = true;
  const branch = multiverse(room).find((c) => c.id === 'baseline');
  assert.deepEqual(branch.policy.days, ['Mon']);
  assert.equal(branch.policy.weighting, false);
  assert.equal(branch.result.metrics.served, 1);
});
test('replay uses the captured cohort and assumptions after the live proposal changes', () => {
  const room = fixture();
  room.scenarios = [
    {
      id: 'saved',
      title: 'Captured',
      createdAt: '2026-11-01',
      people: structuredClone(room.people),
      baseline: structuredClone(room.baseline),
      policy: structuredClone(room.policy),
    },
  ];
  room.people = [];
  room.policy.close = 1200;
  const frames = replayFrames(room);
  assert.equal(frameResult(frames[0]).metrics.lost, 1);
  assert.equal(frameResult(frames[1]).metrics.observations, 0);
  assert.equal(room.scenarios[0].policy.close, 1020);
});
test('unknown availability stays unknown in individual stories', () => {
  const room = fixture();
  room.people[0].arrive = null;
  const row = analyse(room.people, room.baseline, room.policy).rows[0],
    story = storyFor(row);
  assert.equal(story.margin, null);
  assert.match(story.before, /unknown/);
  assert.match(story.after, /unknown/);
  assert.equal(story.lostMinutes, 0);
});
test('closing-time studies stay within a day and keep opening before closing', () => {
  const room = fixture();
  room.policy = p({ open: 1410, close: 1440 });
  const edges = closingEdges(room);
  assert.ok(edges.length > 0);
  for (const e of edges) {
    assert.ok(e.close <= 1440 && e.close > 1410);
    assert.ok(Number.isFinite(e.result.metrics.reach));
  }
  assert.equal(new Set(edges.map((e) => e.close)).size, edges.length);
});
test('living lab escapes user supplied aliases and never invents outcome probabilities', () => {
  const room = fixture();
  room.people[0].name = '<img src=x onerror=alert(1)>';
  const lab = createLivingLab({ getRoom: () => room });
  const html = lab.render();
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('survival rate'));
});
test('every illustrated room produces finite experimental outcomes without mutation', () => {
  for (const id of [
    'library',
    'transport',
    'digital',
    'community',
    'weekend',
    'inclusive',
    'power',
  ]) {
    const room = createRoom(id),
      before = JSON.stringify(room);
    for (const trial of [
      ...multiverse(room),
      ...tinyChanges(room),
      ...stressCases(room),
    ]) {
      assert.ok(Number.isFinite(trial.result.metrics.served));
      assert.ok(trial.policy.open < trial.policy.close);
    }
    assert.equal(JSON.stringify(room), before);
  }
});
test('enabled fallback estimates are labelled explicitly in both versions of a story', () => {
  const room = fixture();
  room.people[0].arrive = null;
  room.policy.includeUnknown = true;
  const row = analyse(room.people, room.baseline, room.policy).rows[0],
    story = storyFor(row);
  assert.match(story.before, /fallback availability estimates/);
  assert.match(story.after, /fallback availability estimates/);
  assert.equal(story.margin, null);
});
