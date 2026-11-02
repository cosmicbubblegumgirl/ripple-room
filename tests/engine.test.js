import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_POLICY,
  analyse,
  evaluate,
  validatePerson,
  validateWorkspace,
  validateSharedSnapshot,
  parseCSV,
  uid,
} from '../dist/engine.js';
import { createRoom, templates } from '../dist/data.js';
const policy = (overrides) => ({
  ...DEFAULT_POLICY,
  open: 540,
  close: 1080,
  days: ['Mon'],
  lastBus: 1200,
  buffer: 0,
  minSession: 45,
  ...overrides,
});
const person = (overrides) => ({
  id: uid(),
  name: 'Alias',
  group: 'Learners',
  arrive: 960,
  leaveBy: 1200,
  duration: 60,
  travelIn: 0,
  travelOut: 0,
  days: ['Mon'],
  weight: 1,
  priority: 0,
  ...overrides,
});
test('an earlier closing can remove a complete session', () => {
  const p = person({ arrive: 1005 });
  const r = analyse([p], policy({}), policy({ close: 1020 }));
  assert.equal(r.metrics.lost, 1);
  assert.equal(r.rows[0].change, 'lost');
});
test('last bus and outward travel constrain the usable window', () => {
  const r = evaluate(
    [person({ arrive: 1000, transit: true, travelOut: 20 })],
    policy({ lastBus: 1050, buffer: 10 }),
  );
  assert.equal(r[0].finish, 1020);
  assert.equal(r[0].status, 'excluded');
});
test('arrival travel and disruption both reduce the window', () => {
  const r = evaluate(
    [person({ arrive: 900, travelIn: 15 })],
    policy({ lateStart: 10, travelAdjustment: 5 }),
  );
  assert.equal(r[0].start, 930);
});
test('one computer cannot serve two overlapping uninterrupted sessions', () => {
  const people = [
    person({ arrive: 960, leaveBy: 1020, computer: true }),
    person({ arrive: 960, leaveBy: 1020, computer: true }),
  ];
  const r = evaluate(people, policy({ computers: 1 }));
  assert.equal(r.filter((p) => p.status === 'retained').length, 1);
  assert.match(r.find((p) => p.status === 'excluded').reason, /computer/);
});
test('capacity can be reused across non-overlapping sessions', () => {
  const r = evaluate(
    [
      person({ arrive: 900, leaveBy: 960, computer: true }),
      person({ arrive: 960, leaveBy: 1020, computer: true }),
    ],
    policy({ computers: 1, seats: 1 }),
  );
  assert.equal(r.filter((p) => p.status === 'retained').length, 2);
});
test('step-free access affects only residents who require it', () => {
  const r = evaluate(
    [person({ access: true }), person({ access: false })],
    policy({ wheelchair: false }),
  );
  assert.equal(r[0].status, 'excluded');
  assert.equal(r[1].status, 'retained');
});
test('missing availability remains unknown and outside known denominator', () => {
  const r = analyse(
    [person({ arrive: null }), person({ weight: 3 })],
    policy({}),
    policy({}),
  );
  assert.equal(r.metrics.unknown, 1);
  assert.equal(r.metrics.population, 3);
  assert.equal(r.metrics.reach, 100);
});
test('explicit fallback estimates can include missing availability', () => {
  const r = evaluate(
    [person({ arrive: null, duration: null })],
    policy({ includeUnknown: true }),
  );
  assert.equal(r[0].status, 'retained');
  assert.equal(r[0].needed, 45);
});
test('weights affect totals, not resource capacity reservations', () => {
  const r = analyse(
    [person({ weight: 10, computer: true })],
    policy({ computers: 1 }),
    policy({ computers: 1 }),
  );
  assert.equal(r.metrics.served, 10);
  assert.equal(r.metrics.servedProfiles, 1);
});
test('multiple days create visits without multiplying distinct profiles', () => {
  const p = person({ days: ['Mon', 'Tue'], weight: 2 });
  const r = analyse([p], policy({}), policy({ days: ['Mon', 'Tue'] }));
  assert.equal(r.metrics.profiles, 1);
  assert.equal(r.metrics.observations, 2);
  assert.equal(r.metrics.population, 4);
});
test('zero capacity excludes every complete profile', () => {
  const r = evaluate([person()], policy({ seats: 0 }));
  assert.equal(r[0].status, 'excluded');
});
test('staff, internet, power, quiet, children and weekend constraints are active', () => {
  for (const [key, personKey] of [
    ['staff', null],
    ['wifi', 'wifi'],
    ['power', 'computer'],
    ['quiet', 'quiet'],
    ['children', 'child'],
  ]) {
    const r = evaluate(
      [person(personKey ? { [personKey]: true } : {})],
      policy({ [key]: false }),
    );
    assert.equal(r[0].status, 'excluded', key);
  }
  const r = evaluate(
    [person({ days: ['Sat'] })],
    policy({ days: ['Sat'], weekend: false }),
  );
  assert.equal(r[0].status, 'excluded');
});
test('a delayed bus can recover access without extending closing time', () => {
  const p = person({ arrive: 1000, transit: true });
  const r = analyse(
    [p],
    policy({ lastBus: 1020 }),
    policy({ lastBus: 1020, extraBus: 60 }),
  );
  assert.equal(r.metrics.gained, 1);
});
test('group totals reconcile with represented observations', () => {
  const room = createRoom();
  const r = analyse(room.people, room.baseline, room.policy);
  assert.equal(
    r.groups.reduce((s, g) => s + g.total, 0),
    r.metrics.population,
  );
  assert.equal(
    r.groups.reduce((s, g) => s + g.served, 0),
    r.metrics.served,
  );
  assert.equal(r.metrics.served + r.metrics.excluded, r.metrics.population);
});
test('all templates generate finite metrics', () => {
  for (const t of templates) {
    const w = createRoom(t.id);
    for (const n of Object.values(
      analyse(w.people, w.baseline, w.policy).metrics,
    ))
      assert.ok(Number.isFinite(n), t.id);
  }
});
test('CSV parser handles quotes, commas and embedded newlines', () => {
  const rows = parseCSV('name,note\r\n"A, B","Two ""quotes""\nand a line"\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'A, B');
  assert.equal(rows[0].note, 'Two "quotes"\nand a line');
});
test('invalid time and duration imports fail before mutation', () => {
  assert.throws(() => validatePerson(person({ arrive: 2000 })), /Times/);
  assert.throws(() => validatePerson(person({ duration: 0 })), /duration/);
  assert.throws(() => parseCSV('wrong,header\nx,y'), /name column/);
});
test('a missing value is not treated as midnight', () => {
  const p = validatePerson(person({ arrive: null }));
  assert.equal(p.arrive, null);
  assert.equal(evaluate([p], policy({}))[0].status, 'unknown');
});
test('complete backup roundtrip preserves outcomes', () => {
  const w = createRoom();
  const before = analyse(w.people, w.baseline, w.policy).metrics;
  const after = validateWorkspace(JSON.parse(JSON.stringify(w)));
  assert.deepEqual(
    analyse(after.people, after.baseline, after.policy).metrics,
    before,
  );
});
test('slot allocations never exceed actual capacity across a fixture', () => {
  const w = createRoom();
  const r = evaluate(w.people, { ...w.policy, seats: 4, computers: 2 });
  for (let t = 0; t < 1440; t += 15) {
    const active = r.filter(
      (p) => p.allocated && p.allocated.start <= t && p.allocated.end > t,
    );
    assert.ok(active.length <= 4);
    assert.ok(active.filter((p) => p.computer).length <= 2);
  }
});
test('invalid imported resource and cost assumptions fail validation', () => {
  const w = createRoom();
  assert.throws(
    () => validateWorkspace({ ...w, policy: { ...w.policy, costPerHour: -1 } }),
    /costPerHour/,
  );
  assert.throws(() => validatePerson(person({ weight: 0 })), /representation/);
  assert.throws(
    () => validatePerson(person({ travelIn: 'not a number' })),
    /representation/,
  );
});
test('imported IDs and snapshot metrics are sanitised and recalculated', () => {
  const w = createRoom();
  const r = validateWorkspace({
    ...w,
    evidence: [{ id: '" onmouseover="alert(1)', title: 'test' }],
    scenarios: [
      {
        id: 'bad',
        title: 'test',
        people: w.people,
        policy: w.policy,
        baseline: w.baseline,
        metrics: { reach: 999 },
      },
    ],
  });
  assert.match(r.evidence[0].id, /^[a-f0-9-]{36}$/);
  assert.notEqual(r.scenarios[0].metrics.reach, 999);
});
test('estimating availability does not falsely increase data completeness', () => {
  const r = analyse(
    [person({ arrive: null })],
    policy({}),
    policy({ includeUnknown: true }),
  );
  assert.equal(r.metrics.completeness, 0);
  assert.equal(r.metrics.estimated, 1);
  assert.equal(r.metrics.unknown, 0);
});
test('current and proposed cost assumptions are independent', () => {
  const r = analyse(
    [person()],
    policy({ costPerHour: 50 }),
    policy({ costPerHour: 100 }),
  );
  assert.equal(r.metrics.operatingCost, r.metrics.baselineCost * 2);
});

test('aggregate snapshots reject HTML-bearing numeric fields', () => {
  const w = createRoom(),
    r = analyse(w.people, w.baseline, w.policy);
  const snapshot = {
    v: 1,
    title: 'Shared example',
    date: new Date().toISOString(),
    demo: true,
    metrics: r.metrics,
    groups: r.groups,
    open: w.policy.open,
    close: w.policy.close,
    baselineClose: w.baseline.close,
  };
  assert.equal(validateSharedSnapshot(snapshot).groups.length, r.groups.length);
  assert.throws(
    () =>
      validateSharedSnapshot({
        ...snapshot,
        groups: [{ ...r.groups[0], rate: '0"><img src=x onerror=alert(1)>' }],
      }),
    /aggregate value/,
  );
  assert.throws(
    () =>
      validateSharedSnapshot({
        ...snapshot,
        groups: [{ ...r.groups[0], name: '<script>' }],
      }),
    /aggregate group/,
  );
});
