import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY, analyse } from '../dist/engine.js';
import { findCompromises } from '../dist/living-engine.js';
import { createLivingLab } from '../dist/living.js';
import { createRoom, templates } from '../dist/data.js';

const fixture = () => ({
  id: 'test', title: 'Timetable', scenarios: [],
  people: [{ id: 'one', name: 'Resident', group: 'Learners',
    arrive: 975, leaveBy: 1200, duration: 60, travelIn: 0, travelOut: 0,
    transit: true, weight: 1, days: ['Mon'] }],
  baseline: { ...DEFAULT_POLICY, close: 1080, lastBus: 1080, buffer: 0, weighting: false },
  policy: { ...DEFAULT_POLICY, close: 1020, lastBus: 1020, buffer: 0, weighting: false },
});

test('compromise needs both room and bus extensions when each alone fails', () => {
  const room = fixture();
  const before = structuredClone(room);
  const found = findCompromises(room, { targetReach: 100, closeMinutes: 30, busMinutes: 30 });
  assert.equal(found.tested, 9);
  assert.deepEqual(found.candidates[0].patch, { close: 1035, lastBus: 1035 });
  assert.equal(found.candidates[0].minutesChanged, 30);
  assert.equal(found.candidates[0].result.metrics.reach, 100);
  assert.deepEqual(room, before);
  assert.equal(findCompromises(room, { closeMinutes: 0 }).matching, 0);
  assert.equal(findCompromises(room, { busMinutes: 0 }).matching, 0);
});

test('unchanged proposal is first when it already meets the target', () => {
  const room = fixture(); room.policy.close = 1080; room.policy.lastBus = 1080;
  const found = findCompromises(room, { targetReach: 100 });
  assert.deepEqual(found.candidates[0].patch, {});
  assert.equal(found.candidates[0].minutesChanged, 0);
  assert.equal(found.candidates.length, 1, 'unnecessary shifts should not be suggested');
});

test('preservation protects individual resident-days despite a net gain', () => {
  const room = fixture();
  room.policy = { ...room.policy, close: 1020, lastBus: 1200, seats: 1, computers: 1 };
  room.people = [
    { ...room.people[0], id: 'first', arrive: 975, leaveBy: 1200, duration: 60, weight: 3 },
    { ...room.people[0], id: 'second', arrive: 990, leaveBy: 1230, duration: 30, weight: 1 },
  ];
  room.policy.minSession = 15; room.policy.weighting = true;
  const unprotected = findCompromises(room, { targetReach: 70, closeMinutes: 15, busMinutes: 0, protect: false });
  assert.equal(unprotected.candidates[0].lostFromProposal, 1);
  assert.equal(unprotected.candidates[0].result.metrics.served, 3);
  const protectedSearch = findCompromises(room, { targetReach: 70, closeMinutes: 15, busMinutes: 0 });
  assert.equal(protectedSearch.matching, 0);
  assert.equal(protectedSearch.closest.result.metrics.served, 1);
});

test('unknown or absent observations cannot satisfy a target even at zero percent', () => {
  const room = fixture(); room.people[0].arrive = null;
  assert.equal(findCompromises(room, { targetReach: 0 }).matching, 0);
  room.people = [];
  assert.equal(findCompromises(room, { targetReach: 0 }).matching, 0);
});

test('search respects midnight, deduplicates bounds and keeps all other assumptions', () => {
  const room = fixture(); room.policy.close = 1440; room.policy.lastBus = 1425;
  const found = findCompromises(room, { closeMinutes: 9999, busMinutes: 9999, targetReach: -50 });
  assert.equal(found.tested, 2);
  assert.equal(found.limits.closeMinutes, 90);
  assert.equal(found.limits.targetReach, 0);
  for (const c of found.candidates) {
    assert.ok(c.policy.close <= 1440 && c.policy.lastBus <= 1440);
    for (const key of Object.keys(room.policy)) {
      if (!['close', 'lastBus'].includes(key)) assert.deepEqual(c.policy[key], room.policy[key]);
    }
  }
});

test('every sample room returns reproducible bounded results with individual protections', () => {
  for (const template of templates) {
    const room = createRoom(template.id), before = JSON.stringify(room);
    const found = findCompromises(room);
    assert.ok(found.tested <= 49);
    for (const c of found.candidates) {
      assert.equal(c.lostFromProposal, 0);
      assert.ok(c.result.metrics.reach >= found.limits.targetReach);
      assert.deepEqual(c.result.metrics, analyse(room.people, room.baseline, c.policy).metrics);
    }
    assert.equal(JSON.stringify(room), before);
  }
});

test('compromise controls render and trying a result applies only its stated timetable patch', () => {
  const room = fixture(); let applied;
  const lab = createLivingLab({ getRoom: () => room, onApply: (patch) => { applied = patch; } });
  lab.open('compromise');
  const html = lab.render();
  assert.match(html, /data-living-change="protect"/);
  assert.match(html, /Try this compromise/);
  assert.match(html, /25 distinct combinations/);
  const id = html.match(/data-id="(compromise-[^"]+)"/)[1];
  lab.click({ closest: () => ({ dataset: { living: 'apply', id } }) });
  assert.deepEqual(applied, { close: 1035, lastBus: 1035 });
});
