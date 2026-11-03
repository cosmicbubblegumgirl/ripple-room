export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const GROUPS = [
  'Learners',
  'Job seekers',
  'Caregivers',
  'Shift workers',
  'Older residents',
  'Other residents',
];
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const clock = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
export const minutes = (s) => {
  if (typeof s === 'number') return s;
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + m;
};
export const uid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return (
    h.slice(0, 8) +
    '-' +
    h.slice(8, 12) +
    '-' +
    h.slice(12, 16) +
    '-' +
    h.slice(16, 20) +
    '-' +
    h.slice(20)
  );
};
export const DEFAULT_POLICY = {
  open: 540,
  close: 1020,
  seats: 18,
  computers: 8,
  minSession: 45,
  buffer: 10,
  lastBus: 1080,
  extraBus: 0,
  lateStart: 0,
  travelAdjustment: 0,
  sessionAdjustment: 0,
  seatReserve: 0,
  priority: 'deadline',
  wheelchair: true,
  wifi: true,
  power: true,
  quiet: true,
  staff: true,
  children: true,
  weekend: true,
  includeUnknown: false,
  weighting: true,
  step: 15,
  days: ['Mon'],
  costPerHour: 85,
  travelCost: 28,
  staffCount: 2,
  staffHours: 8,
  carbonPerTrip: 1.8,
};
const given = (x) =>
  x !== null && x !== undefined && Number.isFinite(Number(x));
export function evaluate(people, policy) {
  const days = policy.days?.length ? policy.days : ['Mon'];
  const rows = [];
  for (const day of days) {
    const seatSlots = Array(96).fill(0),
      computerSlots = Array(96).fill(0);
    const ordered = people
      .filter((p) => p.days.includes(day))
      .sort((a, b) =>
        policy.priority === 'priority'
          ? (b.priority || 0) - (a.priority || 0) || a.leaveBy - b.leaveBy
          : policy.priority === 'shortest'
            ? (a.duration || 45) - (b.duration || 45)
            : policy.priority === 'earliest'
              ? a.arrive - b.arrive
              : a.leaveBy - b.leaveBy,
      );
    for (const p of ordered) {
      const known = given(p.arrive) && given(p.leaveBy) && given(p.duration);
      let start = Math.max(
        policy.open,
        (p.arrive ?? policy.open) +
          (p.travelIn || 0) +
          policy.travelAdjustment +
          policy.lateStart,
      );
      let finish = Math.min(
        policy.close,
        (p.leaveBy ?? policy.close) -
          (p.travelOut || 0) -
          policy.buffer -
          policy.travelAdjustment,
      );
      if (p.transit)
        finish = Math.min(
          finish,
          policy.lastBus +
            policy.extraBus -
            (p.travelOut || 0) -
            policy.buffer -
            policy.travelAdjustment,
        );
      const needed = Math.max(
        15,
        policy.minSession,
        (p.duration || 45) + policy.sessionAdjustment,
      );
      let reason = '',
        status = 'retained';
      const available = Math.max(0, finish - start);
      if (!known && !policy.includeUnknown) {
        reason = 'Missing availability';
        status = 'unknown';
      } else if (!policy.staff) reason = 'No staff coverage';
      else if ((day === 'Sat' || day === 'Sun') && !policy.weekend)
        reason = 'Weekend access unavailable';
      else if (p.access && !policy.wheelchair)
        reason = 'Step-free access unavailable';
      else if (p.computer && !policy.power) reason = 'Power unavailable';
      else if (p.wifi && !policy.wifi) reason = 'Internet unavailable';
      else if (p.quiet && !policy.quiet) reason = 'Quiet space unavailable';
      else if (p.child && !policy.children)
        reason = 'Children cannot accompany resident';
      else if (available < needed)
        reason =
          p.transit && finish < policy.close
            ? 'Transport window too short'
            : 'Not enough usable time';
      let allocated = null;
      if (!reason && status !== 'unknown') {
        const length = Math.ceil(needed / 15);
        const first = Math.ceil(start / 15);
        const last = Math.floor(finish / 15) - length;
        for (let slot = first; slot <= last; slot++) {
          if (slot < 0 || slot + length > 96) continue;
          let fits = true;
          for (let j = slot; j < slot + length; j++)
            if (
              seatSlots[j] >= Math.max(0, policy.seats - policy.seatReserve) ||
              (p.computer && computerSlots[j] >= policy.computers)
            )
              fits = false;
          if (fits) {
            allocated = { start: slot * 15, end: (slot + length) * 15 };
            for (let j = slot; j < slot + length; j++) {
              seatSlots[j]++;
              if (p.computer) computerSlots[j]++;
            }
            break;
          }
        }
        if (!allocated)
          reason = p.computer
            ? 'No computer slot available'
            : 'No seat available';
      }
      if (reason && status !== 'unknown') status = 'excluded';
      rows.push({
        ...p,
        complete: known,
        day,
        start,
        finish,
        needed,
        available,
        status,
        reason,
        allocated,
        weight: policy.weighting ? Math.max(1, p.weight || 1) : 1,
      });
    }
  }
  return rows;
}
const sum = (a, f) => a.reduce((v, x) => v + f(x), 0);
const mean = (a) => (a.length ? a.reduce((a, b) => a + b, 0) / a.length : 0);
const median = (a) => {
  a = [...a].sort((a, b) => a - b);
  return a.length
    ? (a[Math.floor((a.length - 1) / 2)] + a[Math.ceil((a.length - 1) / 2)]) / 2
    : 0;
};
export function analyse(people, baseline, policy) {
  const before = evaluate(people, {
    ...baseline,
    days: policy.days,
    weighting: policy.weighting,
    includeUnknown: policy.includeUnknown,
  });
  const after = evaluate(people, policy);
  const bmap = new Map(before.map((r) => [r.id + ':' + r.day, r]));
  const rows = after.map((r) => {
    const b = bmap.get(r.id + ':' + r.day);
    return {
      ...r,
      before: b,
      change:
        r.status === 'unknown'
          ? 'unknown'
          : r.status === 'retained' && b?.status !== 'retained'
            ? 'gained'
            : r.status === 'excluded' && b?.status === 'retained'
              ? 'lost'
              : r.status === 'retained'
                ? 'retained'
                : 'excluded',
    };
  });
  const known = rows.filter((r) => r.status !== 'unknown');
  const reached = known.filter((r) => r.status === 'retained');
  const lost = rows.filter((r) => r.change === 'lost');
  const gained = rows.filter((r) => r.change === 'gained');
  const population = sum(known, (r) => r.weight),
    served = sum(reached, (r) => r.weight),
    baselineServed = sum(
      before.filter((r) => r.status === 'retained'),
      (r) => r.weight,
    );
  const groups = GROUPS.map((name) => {
    const all = known.filter((r) => r.group === name);
    const yes = all.filter((r) => r.status === 'retained');
    const base = before.filter(
      (r) => r.group === name && r.status !== 'unknown',
    );
    const baseYes = base.filter((r) => r.status === 'retained');
    return {
      name,
      total: sum(all, (r) => r.weight),
      served: sum(yes, (r) => r.weight),
      rate: sum(all, (r) => r.weight)
        ? (sum(yes, (r) => r.weight) / sum(all, (r) => r.weight)) * 100
        : 0,
      baseline: sum(base, (r) => r.weight)
        ? (sum(baseYes, (r) => r.weight) / sum(base, (r) => r.weight)) * 100
        : 0,
      lost: sum(
        lost.filter((r) => r.group === name),
        (r) => r.weight,
      ),
      gained: sum(
        gained.filter((r) => r.group === name),
        (r) => r.weight,
      ),
    };
  }).filter((g) => g.total);
  const rates = groups.map((g) => g.rate);
  const reasons = Object.entries(
    rows
      .filter((r) => r.status === 'excluded')
      .reduce((a, r) => ((a[r.reason] = (a[r.reason] || 0) + r.weight), a), {}),
  ).sort((a, b) => b[1] - a[1]);
  const duration = policy.close - policy.open,
    baseDuration = baseline.close - baseline.open;
  const n = {
    profiles: people.length,
    observations: rows.length,
    known: rows.filter((r) => r.complete).length,
    unknown: rows.filter((r) => r.status === 'unknown').length,
    estimated: rows.filter((r) => !r.complete && r.status !== 'unknown').length,
    population,
    served,
    baselineServed,
    excluded: population - served,
    lost: sum(lost, (r) => r.weight),
    gained: sum(gained, (r) => r.weight),
    reach: population ? (served / population) * 100 : 0,
    baseReach: population ? (baselineServed / population) * 100 : 0,
    net: served - baselineServed,
    windowMinutes: sum(known, (r) => r.available * r.weight),
    baselineWindowMinutes: sum(
      before.filter((r) => r.status !== 'unknown'),
      (r) => r.available * r.weight,
    ),
    scheduledMinutes: sum(
      reached,
      (r) => (r.allocated.end - r.allocated.start) * r.weight,
    ),
    baselineScheduledMinutes: sum(
      before.filter((r) => r.allocated),
      (r) => (r.allocated.end - r.allocated.start) * r.weight,
    ),
    requestedMinutes: sum(known, (r) => r.needed * r.weight),
    unmetMinutes: sum(
      known.filter((r) => r.status === 'excluded'),
      (r) => r.needed * r.weight,
    ),
    averageWindow: mean(known.map((r) => r.available)),
    medianWindow: median(known.map((r) => r.available)),
    minWindow: known.length ? Math.min(...known.map((r) => r.available)) : 0,
    maxWindow: known.length ? Math.max(...known.map((r) => r.available)) : 0,
    averageSession: mean(
      reached.map((r) => r.allocated.end - r.allocated.start),
    ),
    medianSession: median(
      reached.map((r) => r.allocated.end - r.allocated.start),
    ),
    averageTravel: mean(
      known.map((r) => (r.travelIn || 0) + (r.travelOut || 0)),
    ),
    completeness: rows.length
      ? (rows.filter((r) => r.complete).length / rows.length) * 100
      : 0,
    equityGap: rates.length ? Math.max(...rates) - Math.min(...rates) : 0,
    minGroupReach: rates.length ? Math.min(...rates) : 0,
    maxGroupReach: rates.length ? Math.max(...rates) : 0,
    openingHours: duration / 60,
    baselineOpeningHours: baseDuration / 60,
    hoursChange: (duration - baseDuration) / 60,
    operatingCost: (duration / 60) * policy.costPerHour * policy.days.length,
    baselineCost:
      (baseDuration / 60) * baseline.costPerHour * policy.days.length,
    seatHours: (duration / 60) * policy.seats * policy.days.length,
    computerHours: (duration / 60) * policy.computers * policy.days.length,
    activeGroups: groups.length,
    activeDays: policy.days.length,
    transitProfiles: known.filter((r) => r.transit).length,
    computerProfiles: known.filter((r) => r.computer).length,
    accessProfiles: known.filter((r) => r.access).length,
    careProfiles: known.filter((r) => r.child).length,
    wifiProfiles: known.filter((r) => r.wifi).length,
    quietProfiles: known.filter((r) => r.quiet).length,
    highPriority: known.filter((r) => (r.priority || 0) > 1).length,
    representedResidents: sum(people, (r) =>
      policy.weighting ? r.weight || 1 : 1,
    ),
    blockedProfiles: known.length - reached.length,
    servedProfiles: reached.length,
    lostProfiles: lost.length,
    gainedProfiles: gained.length,
    unchangedProfiles: rows.filter(
      (r) => r.change === 'retained' || r.change === 'excluded',
    ).length,
    earliestArrival: known.length ? Math.min(...known.map((r) => r.start)) : 0,
    latestDeparture: known.length ? Math.max(...known.map((r) => r.finish)) : 0,
  };
  n.baselineStaffHours =
    baseline.staffCount * baseline.staffHours * policy.days.length;
  n.baselineTravelExposure =
    sum(
      before.filter((r) => r.status === 'excluded'),
      (r) => r.weight,
    ) * baseline.travelCost;
  n.baselineCarbonExposure =
    sum(
      before.filter((r) => r.status === 'excluded'),
      (r) => r.weight,
    ) * baseline.carbonPerTrip;
  n.costChange = n.operatingCost - n.baselineCost;
  n.costPerServed = served ? n.operatingCost / served : 0;
  n.hoursLost = (n.baselineScheduledMinutes - n.scheduledMinutes) / 60;
  n.seatUtilisation = n.seatHours
    ? (sum(reached, (r) => (r.allocated.end - r.allocated.start) / 60) /
        n.seatHours) *
      100
    : 0;
  n.computerUtilisation = n.computerHours
    ? (sum(
        reached.filter((r) => r.computer),
        (r) => (r.allocated.end - r.allocated.start) / 60,
      ) /
        n.computerHours) *
      100
    : 0;
  n.reachChange = n.reach - n.baseReach;
  n.exclusionRate = population ? (n.excluded / population) * 100 : 0;
  n.lossRate = baselineServed ? (n.lost / baselineServed) * 100 : 0;
  n.gainRate = population ? (n.gained / population) * 100 : 0;
  n.unmetRate = n.requestedMinutes
    ? (n.unmetMinutes / n.requestedMinutes) * 100
    : 0;
  n.scheduledHours = n.scheduledMinutes / 60;
  n.baselineScheduledHours = n.baselineScheduledMinutes / 60;
  n.windowHours = n.windowMinutes / 60;
  n.baselineWindowHours = n.baselineWindowMinutes / 60;
  n.requestedHours = n.requestedMinutes / 60;
  n.unmetHours = n.unmetMinutes / 60;
  n.costSavings = -n.costChange;
  n.travelExposure = n.excluded * policy.travelCost;
  n.carbonExposure = n.excluded * policy.carbonPerTrip;
  n.totalStaffHours =
    policy.staffCount * policy.staffHours * policy.days.length;
  n.computersPerResident = population ? policy.computers / population : 0;
  n.seatsPerResident = population ? policy.seats / population : 0;
  n.averageWeight = mean(people.map((r) => r.weight || 1));
  n.medianWeight = median(people.map((r) => r.weight || 1));
  n.missingArrival = people.filter((r) => !given(r.arrive)).length;
  n.missingDeadline = people.filter((r) => !given(r.leaveBy)).length;
  n.missingDuration = people.filter((r) => !given(r.duration)).length;
  n.evidenceCoverage = people.length
    ? (people.filter((r) => r.source).length / people.length) * 100
    : 0;
  for (const [key, field] of [
    ['transit', 'transit'],
    ['computer', 'computer'],
    ['access', 'access'],
    ['care', 'child'],
    ['wifi', 'wifi'],
    ['quiet', 'quiet'],
  ]) {
    const subset = known.filter((r) => r[field]);
    const yes = subset.filter((r) => r.status === 'retained');
    n[key + 'Reach'] = subset.length
      ? (sum(yes, (r) => r.weight) / sum(subset, (r) => r.weight)) * 100
      : 0;
    n[key + 'Excluded'] = sum(
      subset.filter((r) => r.status === 'excluded'),
      (r) => r.weight,
    );
    n[key + 'Served'] = sum(yes, (r) => r.weight);
  }
  return { rows, before, groups, reasons, metrics: n };
}
export function alternatives(people, baseline, policy) {
  const choices = [
    ['Keep the current hours', { open: baseline.open, close: baseline.close }],
    ['Close 30 minutes later', { close: Math.min(1380, policy.close + 30) }],
    ['Close one hour later', { close: Math.min(1380, policy.close + 60) }],
    ['Open 30 minutes earlier', { open: Math.max(300, policy.open - 30) }],
    [
      'Add two computer places',
      { computers: Math.min(100, policy.computers + 2) },
    ],
    ['Add five seats', { seats: Math.min(200, policy.seats + 5) }],
    [
      'Allow shorter sessions',
      {
        minSession: Math.max(15, policy.minSession - 15),
        sessionAdjustment: -15,
      },
    ],
    ['Add a later bus', { extraBus: policy.extraBus + 60 }],
    ['Reduce the travel buffer', { buffer: Math.max(0, policy.buffer - 5) }],
    ['Prioritise earliest deadlines', { priority: 'deadline' }],
    ['Protect priority access', { priority: 'priority' }],
    ['Restore step-free access', { wheelchair: true }],
    ['Restore internet access', { wifi: true }],
    ['Restore power', { power: true }],
    ['Allow accompanying children', { children: true }],
    ['Restore quiet space', { quiet: true }],
    ['Restore staff coverage', { staff: true }],
    ['Restore weekend access', { weekend: true }],
  ];
  return choices
    .filter(
      ([, patch]) =>
        ({ ...policy, ...patch }).open < { ...policy, ...patch }.close,
    )
    .map(([title, patch]) => ({
      title,
      patch,
      ...analyse(people, baseline, { ...policy, ...patch }).metrics,
    }));
}
export function validatePerson(p) {
  if (!p || typeof p !== 'object')
    throw Error('Each resident must be an object.');
  const name = String(p.name || '').trim();
  if (!name || name.length > 50)
    throw Error('Use an alias between 1 and 50 characters.');
  const person = {
    id:
      typeof p.id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        p.id,
      )
        ? p.id
        : uid(),
    name,
    group: GROUPS.includes(p.group) ? p.group : GROUPS[5],
    days: Array.isArray(p.days)
      ? [...new Set(p.days.filter((d) => DAYS.includes(d)))]
      : ['Mon'],
    arrive: p.arrive === null ? null : minutes(p.arrive),
    leaveBy: p.leaveBy === null ? null : minutes(p.leaveBy),
    duration: p.duration === null ? null : Number(p.duration),
    travelIn:
      p.travelIn === undefined || p.travelIn === '' ? 0 : Number(p.travelIn),
    travelOut:
      p.travelOut === undefined || p.travelOut === '' ? 0 : Number(p.travelOut),
    weight: p.weight === undefined || p.weight === '' ? 1 : Number(p.weight),
    priority:
      p.priority === undefined || p.priority === '' ? 0 : Number(p.priority),
    note: String(p.note || '').slice(0, 1000),
    source: String(p.source || '').slice(0, 300),
    transit: !!p.transit,
    computer: !!p.computer,
    access: !!p.access,
    child: !!p.child,
    wifi: !!p.wifi,
    quiet: !!p.quiet,
  };
  for (const key of ['arrive', 'leaveBy'])
    if (
      person[key] !== null &&
      (!Number.isFinite(person[key]) || person[key] < 0 || person[key] > 1440)
    )
      throw Error('Times must be between 00:00 and 24:00.');
  if (
    person.arrive !== null &&
    person.leaveBy !== null &&
    person.leaveBy <= person.arrive
  )
    throw Error('The departure deadline must follow availability.');
  if (
    person.duration !== null &&
    (!Number.isFinite(person.duration) ||
      person.duration < 15 ||
      person.duration > 720)
  )
    throw Error('Session duration must be 15–720 minutes.');
  if (
    !Number.isFinite(person.weight) ||
    !Number.isFinite(person.travelIn) ||
    !Number.isFinite(person.travelOut) ||
    !Number.isFinite(person.priority) ||
    person.priority < 0 ||
    person.priority > 2 ||
    person.weight < 1 ||
    person.weight > 1000 ||
    person.travelIn < 0 ||
    person.travelIn > 240 ||
    person.travelOut < 0 ||
    person.travelOut > 240
  )
    throw Error('Check representation and travel values.');
  if (!person.days.length) throw Error('Choose at least one day.');
  return person;
}
export function validatePolicy(p) {
  const result = { ...DEFAULT_POLICY, ...p };
  const bounds = {
    open: [0, 1410],
    close: [15, 1440],
    lastBus: [0, 1440],
    seats: [0, 200],
    computers: [0, 200],
    minSession: [15, 720],
    buffer: [0, 240],
    extraBus: [0, 240],
    lateStart: [0, 240],
    travelAdjustment: [0, 240],
    sessionAdjustment: [-60, 240],
    seatReserve: [0, 200],
    costPerHour: [0, 100000],
    travelCost: [0, 10000],
    staffCount: [0, 100],
    staffHours: [0, 24],
    carbonPerTrip: [0, 100],
  };
  for (const [k, [min, max]] of Object.entries(bounds))
    if (!Number.isFinite(result[k]) || result[k] < min || result[k] > max)
      throw Error('Invalid ' + k + ' value.');
  if (result.open >= result.close)
    throw Error('Closing must be later than opening.');
  if (
    !['deadline', 'priority', 'shortest', 'earliest'].includes(result.priority)
  )
    throw Error('Invalid allocation order.');
  for (const k of [
    'wheelchair',
    'wifi',
    'power',
    'quiet',
    'staff',
    'children',
    'weekend',
    'includeUnknown',
    'weighting',
  ])
    if (typeof result[k] !== 'boolean')
      throw Error('Invalid ' + k + ' switch.');
  if (![5, 15, 30, 60].includes(result.step))
    throw Error('Invalid time increments.');
  result.days = Array.isArray(result.days)
    ? [...new Set(result.days.filter((d) => DAYS.includes(d)))]
    : [];
  if (!result.days.length) throw Error('Choose a day.');
  return Object.fromEntries(
    Object.keys(DEFAULT_POLICY).map((k) => [k, result[k]]),
  );
}
export function validateWorkspace(w) {
  if (!w || !Array.isArray(w.people) || w.people.length > 1000)
    throw Error('A room needs a residents array with at most 1,000 profiles.');
  const goodId = (x) =>
    typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x) ? x : uid();
  const now = new Date().toISOString();
  const date = (x) =>
    typeof x === 'string' && Number.isFinite(Date.parse(x)) ? x : now;
  const baseline = validatePolicy(w.baseline || {}),
    policy = validatePolicy(w.policy || {});
  const people = w.people.map(validatePerson);
  if (new Set(people.map((p) => p.id)).size !== people.length)
    throw Error('Resident identifiers must be unique.');
  const scenarios = (Array.isArray(w.scenarios) ? w.scenarios : [])
    .slice(0, 30)
    .map((s) => {
      if (!Array.isArray(s.people) || s.people.length > 1000)
        throw Error('Invalid snapshot residents.');
      const people = s.people.map(validatePerson),
        policy = validatePolicy(s.policy || {}),
        baseline = validatePolicy(s.baseline || {}),
        r = analyse(people, baseline, policy);
      return {
        id: goodId(s.id),
        title: String(s.title || 'Saved possibility').slice(0, 100),
        createdAt: date(s.createdAt),
        people,
        policy,
        baseline,
        metrics: r.metrics,
        groups: r.groups,
      };
    });
  const evidence = (Array.isArray(w.evidence) ? w.evidence : [])
    .slice(0, 200)
    .map((e) => ({
      id: goodId(e.id),
      title: String(e.title || 'Source').slice(0, 150),
      kind: String(e.kind || 'Assumption').slice(0, 50),
      detail: String(e.detail || '').slice(0, 4000),
      date: String(e.date || '').slice(0, 30),
      url: String(e.url || '').slice(0, 1000),
      confidence: String(e.confidence || 'Unverified').slice(0, 50),
    }));
  const notes = (Array.isArray(w.notes) ? w.notes : [])
    .slice(0, 200)
    .map((n) => ({
      id: goodId(n.id),
      title: String(n.title || 'Discussion').slice(0, 150),
      kind: String(n.kind || 'Discussion').slice(0, 50),
      body: String(n.body || '').slice(0, 5000),
      createdAt: date(n.createdAt),
    }));
  return {
    id: goodId(w.id),
    title: String(w.title || 'Untitled room').slice(0, 120),
    template: String(w.template || 'blank').slice(0, 30),
    location: String(w.location || '').slice(0, 150),
    description: String(w.description || '').slice(0, 1500),
    demo: w.demo === true,
    people,
    policy,
    baseline,
    scenarios,
    evidence,
    notes,
    createdAt: date(w.createdAt),
    updatedAt: date(w.updatedAt),
  };
}
export function validateSharedSnapshot(s) {
  if (
    !s ||
    s.v !== 1 ||
    typeof s.title !== 'string' ||
    s.title.length > 120 ||
    !s.metrics ||
    !Array.isArray(s.groups) ||
    s.groups.length > GROUPS.length
  ) {
    throw Error('Invalid aggregate snapshot.');
  }
  const bounded = (value, max = 1e9) => {
    if (!Number.isFinite(value) || value < 0 || value > max)
      throw Error('Invalid aggregate value.');
    return value;
  };
  const metrics = Object.fromEntries(
    ['reach', 'served', 'population', 'lost', 'gained', 'unknown'].map(
      (key) => [key, bounded(s.metrics[key], key === 'reach' ? 100 : 1e9)],
    ),
  );
  if (metrics.served > metrics.population) throw Error('Invalid served total.');
  const groups = s.groups.map((g) => {
    if (!GROUPS.includes(g.name)) throw Error('Invalid aggregate group.');
    return {
      name: g.name,
      ...Object.fromEntries(
        ['total', 'served', 'rate', 'baseline', 'lost', 'gained'].map((key) => [
          key,
          bounded(g[key], ['rate', 'baseline'].includes(key) ? 100 : 1e9),
        ]),
      ),
    };
  });
  if (!Number.isFinite(Date.parse(s.date)))
    throw Error('Invalid snapshot date.');
  return {
    v: 1,
    title: s.title,
    date: s.date,
    demo: s.demo === true,
    metrics,
    groups,
    open: bounded(s.open, 1440),
    close: bounded(s.close, 1440),
    baselineClose: bounded(s.baselineClose, 1440),
  };
}
export function csvEscape(v) {
  return '"' + String(v ?? '').replaceAll('"', '""') + '"';
}
export function parseCSV(text) {
  if (text.length > 2000000) throw Error('Keep CSV files below 2 MB.');
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw Error('An opening quote has no closing quote.');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((s) => s.trim());
  if (!headers?.includes('name')) throw Error('Include a name column.');
  return rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])),
  );
}
