import { analyse, clamp, clock } from './engine.js';

const copy = (x) => JSON.parse(JSON.stringify(x));
const changed = (policy, patch) =>
  Object.entries(patch).some(
    ([k, v]) => JSON.stringify(policy[k]) !== JSON.stringify(v),
  );
function evaluateChoices(room, specifications) {
  return specifications
    .filter((s) => changed(room.policy, s.patch))
    .map((s) => {
      const policy = { ...room.policy, ...s.patch };
      const result = analyse(room.people, room.baseline, policy);
      const delta = analyse(room.people, room.policy, policy);
      return { ...s, policy, result, delta };
    });
}
export function multiverse(room) {
  const p = room.policy;
  return evaluateChoices(room, [
    {
      id: 'later',
      title: 'Give the day half an hour.',
      detail: 'Only the proposed closing time changes.',
      patch: { close: clamp(p.close + 30, p.open + 15, 1440) },
    },
    {
      id: 'bus',
      title: 'Let the last bus wait.',
      detail:
        'The last departure is 30 minutes later; travel and buffer stay the same.',
      patch: { lastBus: Math.min(1440, p.lastBus + 30) },
    },
    {
      id: 'computers',
      title: 'Make room at a screen.',
      detail: 'Two more computer places; the seat limit still applies.',
      patch: { computers: Math.min(200, p.computers + 2) },
    },
    {
      id: 'earlier',
      title: 'Open a little earlier.',
      detail: 'Doors open 30 minutes earlier; closing stays the same.',
      patch: { open: Math.max(0, p.open - 30) },
    },
    {
      id: 'seats',
      title: 'Pull up two chairs.',
      detail: 'Two additional seats; computer places stay the same.',
      patch: { seats: Math.min(200, p.seats + 2) },
    },
    {
      id: 'baseline',
      title: 'Keep the current situation.',
      detail:
        'Use the baseline settings on the same selected days and representation basis.',
      patch: {
        ...copy(room.baseline),
        days: [...p.days],
        weighting: p.weighting,
        includeUnknown: p.includeUnknown,
      },
    },
  ]);
}
export function tinyChanges(room) {
  const p = room.policy;
  return evaluateChoices(room, [
    {
      id: 'close15',
      title: '15 more minutes open',
      detail: `Closing ${clock(p.close)} → ${clock(Math.min(1440, p.close + 15))}`,
      patch: { close: Math.min(1440, p.close + 15) },
    },
    {
      id: 'bus15',
      title: 'A bus 15 minutes later',
      detail: 'Change the last departure only.',
      patch: { lastBus: Math.min(1440, p.lastBus + 15) },
    },
    {
      id: 'screen1',
      title: 'One more computer place',
      detail: 'The existing seat limit is unchanged.',
      patch: { computers: Math.min(200, p.computers + 1) },
    },
    {
      id: 'seat1',
      title: 'One more seat',
      detail: 'Computer places are unchanged.',
      patch: { seats: Math.min(200, p.seats + 1) },
    },
    {
      id: 'open15',
      title: 'Open 15 minutes earlier',
      detail: 'The proposed closing time is unchanged.',
      patch: { open: Math.max(0, p.open - 15) },
    },
    ...[
      ['power', 'Restore power'],
      ['wifi', 'Restore internet access'],
      ['staff', 'Restore staff coverage'],
      ['wheelchair', 'Restore step-free access'],
      ['children', 'Welcome accompanying children'],
      ['quiet', 'Restore quiet space'],
    ]
      .filter(([key]) => !p[key])
      .map(([key, title]) => ({
        id: key,
        title,
        detail: 'Change this one access condition only.',
        patch: { [key]: true },
      })),
  ]).sort(
    (a, b) =>
      b.delta.metrics.served -
        b.delta.metrics.baselineServed -
        (a.delta.metrics.served - a.delta.metrics.baselineServed) ||
      b.delta.metrics.gained - a.delta.metrics.gained,
  );
}
export function stressCases(room) {
  const p = room.policy;
  return evaluateChoices(room, [
    {
      id: 'arrival15',
      title: 'Everyone arrives 15 minutes later',
      detail: 'Add 15 minutes to the supplied arrival disruption.',
      patch: { lateStart: Math.min(180, p.lateStart + 15) },
    },
    {
      id: 'bus30',
      title: 'The last bus leaves 30 minutes earlier',
      detail: 'Change the departure time; do not change travel time.',
      patch: { lastBus: Math.max(0, p.lastBus - 30) },
    },
    {
      id: 'close30',
      title: 'The building closes 30 minutes earlier',
      detail: 'Keep the opening time and all other conditions.',
      patch: { close: Math.max(p.open + 15, p.close - 30) },
    },
    {
      id: 'halfScreens',
      title: 'Half the computers are unavailable',
      detail: 'Round the remaining computer count down.',
      patch: { computers: Math.floor(p.computers / 2) },
    },
    {
      id: 'halfSeats',
      title: 'Half the seats are unavailable',
      detail: 'Round the remaining seat count down.',
      patch: { seats: Math.floor(p.seats / 2) },
    },
    {
      id: 'powerOut',
      title: 'The power goes out',
      detail: 'Computer-dependent sessions require power.',
      patch: { power: false },
    },
    {
      id: 'staffOut',
      title: 'Staff coverage falls through',
      detail: 'The model requires staff for every allocated session.',
      patch: { staff: false },
    },
    {
      id: 'travel15',
      title: 'Every journey takes 15 extra minutes each way',
      detail: 'Add to existing travel adjustment; preserve the safety buffer.',
      patch: { travelAdjustment: Math.min(120, p.travelAdjustment + 15) },
    },
  ]).sort((a, b) => b.delta.metrics.lost - a.delta.metrics.lost);
}
export function replayFrames(room) {
  return [...room.scenarios]
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((s) => ({
      id: s.id,
      title: s.title,
      date: s.createdAt,
      people: s.people,
      baseline: s.baseline,
      policy: s.policy,
      live: false,
    }))
    .concat([
      {
        id: 'live',
        title: 'The proposal on your desk',
        date: room.updatedAt,
        people: room.people,
        baseline: room.baseline,
        policy: room.policy,
        live: true,
      },
    ]);
}
export function frameResult(frame) {
  return analyse(frame.people, frame.baseline, frame.policy);
}
export function storyFor(row) {
  const describe = (r) => {
    if (r.status === 'unknown')
      return 'Availability is missing, so the outcome stays unknown.';
    const prefix = r.complete
      ? ''
      : 'Using the explicitly enabled fallback availability estimates: ';
    return (
      prefix +
      (r.allocated
        ? `A complete ${r.needed}-minute session fits from ${clock(r.allocated.start)} to ${clock(r.allocated.end)}.`
        : `No complete session fits. ${r.reason}.`)
    );
  };
  return {
    before: describe(row.before),
    after: describe(row),
    lostMinutes:
      row.before.allocated && !row.allocated
        ? row.before.allocated.end - row.before.allocated.start
        : 0,
    margin: row.complete ? row.available - row.needed : null,
  };
}
export function closingEdges(room) {
  const p = room.policy;
  return [-60, -45, -30, -15, 0, 15, 30, 45, 60]
    .map((offset) => clamp(p.close + offset, p.open + 15, 1440))
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((close) => ({
      close,
      result: analyse(room.people, room.baseline, { ...p, close }),
    }));
}
