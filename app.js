import { createLivingLab } from './living.js';
import {
  DAYS,
  GROUPS,
  DEFAULT_POLICY,
  clock,
  minutes,
  uid,
  clamp,
  analyse,
  alternatives,
  validatePerson,
  validateWorkspace,
  validateSharedSnapshot,
  parseCSV,
  csvEscape,
} from './engine.js';
import { templates, createRoom, defaultPrefs } from './data.js';
import * as db from './db.js';
import * as cloud from './cloud.js';
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const icon = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
const clone = (x) => JSON.parse(JSON.stringify(x));
let room,
  rooms = [],
  prefs = { ...defaultPrefs },
  view = 'living',
  chartMode = 'timeline',
  showAllRows = false,
  personLayout = 'cards',
  history = [],
  future = [],
  selected = new Set(),
  filters = {
    search: '',
    group: 'all',
    status: 'all',
    sort: 'name',
    day: 'all',
  },
  saveTimer,
  toastTimer,
  cloudVersion = {},
  cloudUser = null,
  dragStarted = false;
const livingLab = createLivingLab({
  getRoom: () => room,
  onRender: () => render(),
  onApply: (patch) => {
    mutate(() => Object.assign(room.policy, patch));
    toast('Branch applied to the proposal. Undo can restore it.');
  },
  onInspect: (id, day) => inspectPerson(id, day),
  canUndo: () => history.length > 0,
  onCapture: () => snapshotDialog(),
  onDownload: (receipt) =>
    download(
      'ripple-room-private-model-receipt.json',
      JSON.stringify(receipt, null, 2),
    ),
});
const money = (n) =>
  new Intl.NumberFormat(prefs.locale, {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: prefs.metricPrecision,
  }).format(n);
const num = (n) =>
  new Intl.NumberFormat(prefs.locale, {
    maximumFractionDigits: prefs.metricPrecision,
  }).format(Number.isFinite(n) ? n : 0);
const fmtDate = (s) =>
  new Date(s).toLocaleDateString(prefs.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const metricLabels = {
  profiles: ['Resident profiles', 'profiles'],
  observations: ['Resident-day observations', 'observations'],
  known: ['Complete observations', 'observations'],
  unknown: ['Unknown outcomes', 'observations'],
  population: ['Represented resident visits', 'visits'],
  served: ['Proposed access', 'visits'],
  baselineServed: ['Current access', 'visits'],
  excluded: ['Proposed exclusions', 'visits'],
  lost: ['Access lost', 'visits'],
  gained: ['Access gained', 'visits'],
  reach: ['Proposed reach', '%'],
  baseReach: ['Current reach', '%'],
  net: ['Net access change', 'visits'],
  windowMinutes: ['Available window minutes', 'min'],
  baselineWindowMinutes: ['Current window minutes', 'min'],
  scheduledMinutes: ['Allocated session minutes', 'min'],
  baselineScheduledMinutes: ['Current allocated minutes', 'min'],
  requestedMinutes: ['Requested session minutes', 'min'],
  unmetMinutes: ['Unmet session minutes', 'min'],
  averageWindow: ['Mean available window', 'min'],
  medianWindow: ['Median available window', 'min'],
  minWindow: ['Shortest available window', 'min'],
  maxWindow: ['Longest available window', 'min'],
  averageSession: ['Mean allocated session', 'min'],
  medianSession: ['Median allocated session', 'min'],
  averageTravel: ['Mean round-trip travel', 'min'],
  completeness: ['Availability completeness', '%'],
  equityGap: ['Group reach gap', 'pp'],
  minGroupReach: ['Lowest group reach', '%'],
  maxGroupReach: ['Highest group reach', '%'],
  openingHours: ['Proposed daily opening', 'h'],
  baselineOpeningHours: ['Current daily opening', 'h'],
  hoursChange: ['Daily opening change', 'h'],
  operatingCost: ['Estimated proposed operating cost', 'ZAR'],
  baselineCost: ['Estimated current operating cost', 'ZAR'],
  seatHours: ['Available seat-hours', 'h'],
  computerHours: ['Available computer-hours', 'h'],
  activeGroups: ['Represented groups', 'groups'],
  activeDays: ['Days in this run', 'days'],
  transitProfiles: ['Transit-dependent observations', 'observations'],
  computerProfiles: ['Computer-dependent observations', 'observations'],
  accessProfiles: ['Step-free-dependent observations', 'observations'],
  careProfiles: ['Accompanying-child observations', 'observations'],
  wifiProfiles: ['Internet-dependent observations', 'observations'],
  quietProfiles: ['Quiet-space observations', 'observations'],
  highPriority: ['Priority observations', 'observations'],
  representedResidents: ['Residents represented', 'residents'],
  blockedProfiles: ['Excluded profile visits', 'observations'],
  servedProfiles: ['Served profile visits', 'observations'],
  lostProfiles: ['Lost profile visits', 'observations'],
  gainedProfiles: ['Gained profile visits', 'observations'],
  unchangedProfiles: ['Unchanged profile visits', 'observations'],
  earliestArrival: ['Earliest effective arrival', 'time'],
  latestDeparture: ['Latest effective departure', 'time'],
  costChange: ['Estimated operating cost change', 'ZAR'],
  costPerServed: ['Estimated cost per served visit', 'ZAR'],
  hoursLost: ['Allocated hours lost', 'h'],
  seatUtilisation: ['Modelled seat utilisation', '%'],
  computerUtilisation: ['Modelled computer utilisation', '%'],
  reachChange: ['Reach change', 'pp'],
  exclusionRate: ['Exclusion rate', '%'],
  lossRate: ['Share of current access lost', '%'],
  gainRate: ['Share gaining access', '%'],
  unmetRate: ['Share of session demand unmet', '%'],
  scheduledHours: ['Allocated session hours', 'h'],
  baselineScheduledHours: ['Current allocated hours', 'h'],
  windowHours: ['Available window hours', 'h'],
  baselineWindowHours: ['Current available hours', 'h'],
  requestedHours: ['Requested session hours', 'h'],
  unmetHours: ['Unmet session hours', 'h'],
  costSavings: ['Estimated operating savings', 'ZAR'],
  travelExposure: [
    'Travel-cost exposure if excluded visits still travel',
    'ZAR',
  ],
  carbonExposure: [
    'Trip-emission exposure if excluded visits still travel',
    'kg CO₂e',
  ],
  totalStaffHours: ['Supplied staff-hours', 'h'],
  computersPerResident: ['Computers per represented visit', 'ratio'],
  seatsPerResident: ['Seats per represented visit', 'ratio'],
  averageWeight: ['Mean representation weight', 'residents'],
  medianWeight: ['Median representation weight', 'residents'],
  missingArrival: ['Missing arrival times', 'profiles'],
  missingDeadline: ['Missing departure times', 'profiles'],
  missingDuration: ['Missing session lengths', 'profiles'],
  evidenceCoverage: ['Profiles with a source label', '%'],
};
for (const [key, title] of [
  ['transit', 'Transit-dependent'],
  ['computer', 'Computer-dependent'],
  ['access', 'Step-free-dependent'],
  ['care', 'Accompanying-child'],
  ['wifi', 'Internet-dependent'],
  ['quiet', 'Quiet-space'],
]) {
  metricLabels[key + 'Reach'] = [title + ' reach', '%'];
  metricLabels[key + 'Excluded'] = [title + ' exclusions', 'visits'];
  metricLabels[key + 'Served'] = [title + ' access', 'visits'];
}
Object.assign(metricLabels, {
  estimated: ['Estimated-availability outcomes', 'observations'],
  baselineStaffHours: ['Current supplied staff-hours', 'h'],
  baselineTravelExposure: ['Current travel-cost exposure', 'ZAR'],
  baselineCarbonExposure: ['Current trip-emission exposure', 'kg CO₂e'],
});
const metricValue = (key, value) =>
  metricLabels[key]?.[1] === 'ZAR'
    ? money(value)
    : metricLabels[key]?.[1] === 'time'
      ? clock(value)
      : num(value);
const metricHelp = {
  reach:
    'Weighted served visits divided by weighted complete resident-day observations. Unknown outcomes are excluded from the denominator.',
  equityGap:
    'Highest group reach minus lowest group reach, in percentage points. This describes the supplied sample; it does not establish population fairness.',
  scheduledHours:
    'Sum of allocated 15-minute slots, weighted by representation. Capacity is allocated once per supplied profile, so representation weights are not extra bookings.',
  operatingCost:
    'Opening hours × supplied hourly operating cost × selected days. This is an estimate, not an accounting forecast.',
  travelExposure:
    'Excluded represented visits × supplied return-trip cost. This is potential exposure only; the model does not predict whether someone will actually travel.',
  carbonExposure:
    'Excluded represented visits × supplied kg CO₂e per trip. This is an illustrative exposure calculation, not measured emissions.',
  evidenceCoverage:
    'Share of resident profiles with any source label. A label does not mean that evidence has been verified.',
  completeness:
    'Share of resident-day observations with arrival, departure and session length supplied.',
  hoursLost:
    'Current allocated session hours minus proposed allocated session hours. Negative means a gain.',
};
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4300);
}
function dialog(title, body, eyebrow = 'MAKE ROOM FOR POSSIBILITY') {
  const d = $('#dialog');
  $('#dialogTitle').textContent = title;
  $('#dialogEyebrow').textContent = eyebrow;
  $('#dialogBody').innerHTML = body;
  if (!d.open) d.showModal();
  setTimeout(
    () =>
      $('#dialogBody input:not([type=hidden]), #dialogBody button')?.focus(),
    30,
  );
}
function closeDialog() {
  $('#dialog').close();
}
function reportError(error) {
  toast(error.message || 'Something did not save. Please try again.');
  console.error('Ripple Room:', error.message);
}
function record() {
  history.push(clone(room));
  if (history.length > 60) history.shift();
  future = [];
}
async function persist() {
  try {
    await db.put('rooms', room);
    rooms = rooms.filter((r) => r.id !== room.id);
    rooms.unshift(clone(room));
    await db.put('settings', { id: 'active', value: room.id });
    $('#saveStatus').textContent = 'Saved on this device';
  } catch (e) {
    $('#saveStatus').textContent = 'Not saved — export a backup';
    reportError(e);
  }
}
function saveSoon() {
  room.updatedAt = new Date().toISOString();
  $('#saveStatus').textContent = prefs.autoSave ? 'Saving…' : 'Unsaved changes';
  clearTimeout(saveTimer);
  if (prefs.autoSave) saveTimer = setTimeout(persist, 300);
}
function mutate(fn, rerender = true) {
  record();
  fn();
  saveSoon();
  if (rerender) render();
}
function result() {
  return analyse(room.people, room.baseline, room.policy);
}
function updateHero() {
  if (!room || !$('#heroTime')) return;
  const r = result(),
    m = r.metrics;
  $('#live').textContent =
    `${metricValue('reach', m.reach)} percent of represented visits retain access in the proposed scenario.`;
  $('#heroTime').textContent = clock(room.policy.close);
  $('#heroBaseline').textContent = 'CURRENTLY ' + clock(room.baseline.close);
  $('#heroRoomName').textContent = room.title;
  $('#heroLoss').textContent =
    num(m.lost) +
    (room.policy.weighting ? ' weighted' : '') +
    (m.lost === 1 ? ' visit loses access' : ' visits lose access');
  $('#heroDataType').textContent = room.demo
    ? 'ILLUSTRATIVE PROFILES'
    : 'SUPPLIED CONSTRAINTS / MODELLED OUTCOMES';
  const min = Math.min(room.policy.close, Math.max(room.policy.open + 15, 720));
  const input = $('#heroClosingInput');
  input.min = min;
  input.step = room.policy.step;
  input.value = room.policy.close;
  $('#heroRangeStart').textContent = clock(min);
  const ordered = [
    ...r.rows.filter((p) => p.change === 'lost'),
    ...r.rows.filter((p) => p.change !== 'lost'),
  ];
  const chosen = [...new Map(ordered.map((p) => [p.id, p])).values()].slice(
    0,
    3,
  );
  $('#heroLanes').innerHTML = chosen.length
    ? chosen
        .map(
          (p) =>
            `<div class="hero-lane ${p.status === 'excluded' ? 'lane-lost' : ''}"><span class="lane-mark"><span>${p.status === 'retained' ? '✓' : p.status === 'unknown' ? '?' : '×'}</span></span><div><div class="hero-lane-name">${esc(p.name)}</div><div class="hero-lane-detail">${esc(p.group)} · ${p.day} · ${esc(p.reason || 'A full session fits')}</div></div><div class="hero-lane-time">${p.allocated ? clock(p.allocated.start) + '<br>' + clock(p.allocated.end) : p.status === 'unknown' ? 'UNKNOWN' : 'NO SLOT'}</div></div>`,
        )
        .join('')
    : '<div class="hero-empty">Add a resident’s constraints to follow their ripple.</div>';
}
function updateHeader() {
  updateHero();
  $('#roomTitle').textContent = room.title;
  $('#roomDescription').textContent = room.description;
  $('#sampleBanner').hidden = !room.demo;
  $('#sampleBanner').style.display = room.demo ? 'flex' : 'none';
  $$('[data-view]').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === view),
  );
  $('#accountLabel').textContent = cloudUser
    ? 'Cloud workspace'
    : 'Your workspace';
}
function applyPrefs() {
  const h = document.documentElement,
    b = document.body;
  h.dataset.theme = prefs.theme;
  h.style.setProperty('--font', prefs.fontSize + 'px');
  const accents = {
    coral: ['#d7432c', '#f8dfd4'],
    violet: ['#9c84bc', '#eee5f5'],
    gold: ['#bd913d', '#f4ead3'],
    blue: ['#6399ba', '#e0edf5'],
  };
  const a = accents[prefs.accent] || accents.coral;
  h.style.setProperty('--accent', a[0]);
  h.style.setProperty('--accent-soft', a[1]);
  for (const [cls, key, inverse] of [
    ['no-motion', 'motion', true],
    ['compact', 'density', false],
    ['high-contrast', 'contrast'],
    ['large-targets', 'largeTargets'],
    ['reduce-shadows', 'reduceShadows'],
    ['focus-mode', 'focusMode'],
    ['table-striped', 'tableStriped'],
    ['table-compact', 'tableCompact'],
    ['no-sticky', 'stickyControls', true],
  ])
    b.classList.toggle(
      cls,
      key === 'density'
        ? prefs.density === 'compact'
        : inverse
          ? !prefs[key]
          : !!prefs[key],
    );
  h.style.setProperty('--row-height', prefs.chartHeight + 'px');
  b.classList.toggle('chart-grid-off', !prefs.chartGrid);
  b.classList.toggle('chart-labels-off', !prefs.chartLabels);
  b.classList.toggle('chart-no-animate', !prefs.chartAnimation);
  b.style.zoom = String(prefs.fontSize / 16);
}
function render() {
  if (!room) return;
  updateHeader();
  const views = {
    living: () => livingLab.render(),
    lab: renderLab,
    people: renderPeople,
    alternatives: renderAlternatives,
    scenarios: renderScenarios,
    evidence: renderEvidence,
    insights: renderInsights,
    report: renderReport,
  };
  $('#view').innerHTML = views[view]();
  applyPrefs();
  $('#live').textContent =
    `${metricValue('reach', result().metrics.reach)} percent of represented visits retain access in the proposed scenario.`;
}
function switchView(v) {
  view = v;
  filters.search = '';
  filters.group = 'all';
  filters.status = 'all';
  render();
}
let fieldSequence = 0;
const timeField = (key, label, scope = 'policy') => {
  const suffix = ++fieldSequence;
  return `<div class="field"><label for="${scope}-${key}-${suffix}">${label}</label><input id="${scope}-${key}-${suffix}" type="time" data-${scope}="${key}" value="${clock(room[scope][key])}" step="900"></div>`;
};
const numberField = (
  key,
  label,
  min = 0,
  max = 200,
  scope = 'policy',
  step = 1,
) => {
  const suffix = ++fieldSequence;
  return `<div class="field"><label for="${scope}-${key}-${suffix}">${label}</label><input id="${scope}-${key}-${suffix}" type="number" data-${scope}="${key}" min="${min}" max="${max}" step="${step}" value="${room[scope][key]}"></div>`;
};
const switchField = (key, label, scope = 'policy') => {
  const suffix = ++fieldSequence;
  return `<label class="switch-label" for="${scope}-${key}-${suffix}"><span>${label}</span><input id="${scope}-${key}-${suffix}" data-${scope}="${key}" type="checkbox" ${room[scope][key] ? 'checked' : ''}></label>`;
};
function controls() {
  const p = room.policy,
    b = room.baseline,
    delta = p.close - b.close;
  return `<aside class="control-panel" aria-label="Decision controls"><div class="panel-head"><div><div class="overline">CHANGE ONE THING. FOLLOW THE RIPPLE.</div><h3>Your decision</h3></div>${icon('settings')}</div><div class="control-body"><div class="control-label"><span>${icon('clock')} What if we closed at…</span><button data-action="policy-help" aria-label="About the decision controls">${icon('info')}</button></div><div class="time-box"><div class="time-display"><strong id="closingValue">${clock(p.close)}</strong><span class="delta-tag" id="closingDelta">${delta === 0 ? 'Current time' : Math.abs(delta) + 'm ' + (delta < 0 ? 'earlier' : 'later')}</span></div><input id="closingInput" aria-label="Proposed closing time" type="range" min="${Math.max(p.open + 15, 720)}" max="1440" step="${p.step}" data-policy="close" value="${p.close}"><div class="range-labels"><span>${clock(Math.max(p.open + 15, 720))}</span><span>24:00</span></div><small>Currently closes at ${clock(b.close)}</small></div><div class="control-label">Explore these days</div><div class="days" role="group" aria-label="Days to model">${DAYS.map((d) => `<button class="${p.days.includes(d) ? 'active' : ''}" data-action="day" data-day="${d}" aria-pressed="${p.days.includes(d)}">${d.slice(0, 2)}</button>`).join('')}</div><div class="field-pair">${timeField('open', 'Doors open')}${timeField('lastBus', 'Last bus departs')}</div><div class="field-pair">${numberField('seats', 'Available seats')}${numberField('computers', 'Computer places')}</div><hr class="control-divider">${switchField('weighting', 'Use representation weights')}${switchField('includeUnknown', 'Estimate missing availability')}<details><summary>Time & transport</summary><div class="field-pair">${timeField('open', 'Opening time')}${timeField('lastBus', 'Last bus')}</div>${numberField('buffer', 'Travel safety buffer (min)', 0, 90)}${numberField('minSession', 'Minimum session (min)', 15, 240)}${numberField('extraBus', 'Extra bus delay (min)', 0, 180)}${numberField('lateStart', 'Arrival disruption (min)', 0, 180)}${numberField('travelAdjustment', 'Extra travel each way (min)', 0, 120)}${numberField('sessionAdjustment', 'Session length adjustment', -60, 120)}<div class="field"><label for="policy-step">Slider increments</label><select id="policy-step" data-policy="step">${[5, 15, 30, 60].map((n) => `<option value="${n}" ${p.step === n ? 'selected' : ''}>${n} minutes</option>`).join('')}</select></div></details><details><summary>Space & access</summary><div class="field-pair">${numberField('seats', 'Seats')}${numberField('computers', 'Computer places')}</div>${numberField('seatReserve', 'Seats kept outside this model', 0, 200)}${switchField('wheelchair', 'Step-free entrance available')}${switchField('wifi', 'Internet available')}${switchField('power', 'Power available')}${switchField('quiet', 'Quiet space available')}${switchField('staff', 'Staff coverage available')}${switchField('children', 'Accompanying children welcome')}${switchField('weekend', 'Weekend access available')}<div class="field"><label for="policy-priority">Allocation order</label><select id="policy-priority" data-policy="priority">${[
    ['deadline', 'Earliest deadline'],
    ['earliest', 'Earliest arrival'],
    ['shortest', 'Shortest session'],
    ['priority', 'Supplied priority first'],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${p.priority === v ? 'selected' : ''}>${l}</option>`,
    )
    .join(
      '',
    )}</select></div></details><details><summary>Cost assumptions</summary>${numberField('costPerHour', 'Operating cost / hour (R)', 0, 100000)}${numberField('travelCost', 'Return-trip cost (R)', 0, 10000)}${numberField('staffCount', 'Staff in this estimate', 0, 100)}${numberField('staffHours', 'Hours per staff member', 0, 24, 'policy', 0.5)}${numberField('carbonPerTrip', 'kg CO₂e per return trip', 0, 100, 'policy', 0.1)}<p>Supplied estimates only. Costs do not establish whether a decision is affordable.</p></details><details><summary>Current situation</summary><p>Compare every proposal with this baseline.</p><div class="field-pair">${timeField('open', 'Currently opens', 'baseline')}${timeField('close', 'Currently closes', 'baseline')}</div><div class="field-pair">${numberField('seats', 'Current seats', 0, 200, 'baseline')}${numberField('computers', 'Current computers', 0, 200, 'baseline')}</div>${timeField('lastBus', 'Current last bus', 'baseline')}<button class="text-btn" data-action="baseline-editor">All baseline settings ↗</button></details></div><div class="panel-bottom"><button data-action="undo" ${!history.length ? 'disabled' : ''}>${icon('undo')}Undo</button><button data-action="redo" ${!future.length ? 'disabled' : ''}>${icon('redo')}Redo</button><button data-action="reset-policy">Reset decision</button></div></aside>`;
}
function stats(m) {
  return `<div class="stat-strip"><div class="stat-card"><span class="stat-label">Still within reach</span><strong>${num(m.reach)}<span style="font-size:17px">%</span></strong><small>${num(m.served)} of ${num(m.population)} represented visits</small></div><div class="stat-card loss"><span class="stat-label">Access lost</span><strong>${num(m.lost)}</strong><small>Compared with current access</small></div><div class="stat-card gain"><span class="stat-label">Access gained</span><strong>${num(m.gained)}</strong><small>Newly able to complete a session</small></div><div class="stat-card neutral"><span class="stat-label">Missing information</span><strong>${num(m.unknown)}</strong><small>Resident-day outcomes unknown</small></div></div>`;
}
function renderLab() {
  return `<div class="lab-layout">${controls()}<div id="labMain" class="lab-main">${labMain()}</div></div>`;
}
function labMain() {
  const r = result(),
    m = r.metrics;
  const worst = [...r.groups].sort((a, b) => b.lost - a.lost)[0];
  return `${stats(m)}<div class="chart-panel"><div class="chart-head"><div><h3>Whose day still fits?</h3><p>Follow the space between being available and getting home.</p></div><div class="segmented" aria-label="Chart view">${[
    ['timeline', 'Timeline'],
    ['map', 'Ripples'],
    ['groups', 'Groups'],
  ]
    .map(
      ([v, l]) =>
        `<button data-action="chart" data-mode="${v}" class="${chartMode === v ? 'active' : ''}" aria-pressed="${chartMode === v}">${l}</button>`,
    )
    .join(
      '',
    )}</div></div><div class="chart-meta">${prefs.showLegend ? `<div class="legend"><span><i></i>Access retained</span><span class="lost"><i></i>Access lost / excluded</span><span class="baseline"><i></i>Current window</span></div>` : ''}<span>${room.policy.days.join(' · ')} · ${room.people.length} profiles</span></div>${chartMode === 'timeline' ? timeline(r) : chartMode === 'map' ? rippleMap(r) : groupChart(r)}<div class="chart-bottom"><span>${icon('shield')} Availability is supplied, outcomes are modelled. ${prefs.showBuffer ? room.policy.buffer + 'm travel buffer. ' : ''}${prefs.showCapacity ? room.policy.seats + ' seats / ' + room.policy.computers + ' computers. ' : ''}This is not a booking system.</span><button data-action="methods">How we calculate</button></div></div><div class="insight-callout"><span class="insight-number">${m.lost ? '↘' : '↗'}</span><div><h4>${m.lost ? `${num(m.lost)} represented visits no longer fit.` : m.gained ? `${num(m.gained)} represented visits gain access.` : 'Every supplied constraint matters.'}</h4><p>${m.lost && worst ? `${esc(worst.name)} account for ${num(worst.lost)} of those lost visits. ${r.reasons[0] ? esc(r.reasons[0][0]) + ' is the most frequent barrier.' : ''}` : 'Try a different closing time, add a later bus, or explore the effect of a shared resource.'}</p></div><button class="text-btn" data-view="alternatives">Find another possibility ↗</button></div>${prefs.screenReader ? `<div class="notice" style="margin-top:15px">${r.rows.map((p) => `${esc(p.name)}, ${p.day}: ${p.change}. ${esc(p.reason || 'A session fits')}. `).join('')}</div>` : ''}`;
}
function filteredRows(rows) {
  return rows
    .filter(
      (p) =>
        (filters.group === 'all' || p.group === filters.group) &&
        (filters.status === 'all' || p.change === filters.status) &&
        (filters.day === 'all' || p.day === filters.day) &&
        (!filters.search ||
          `${p.name} ${p.group} ${p.note} ${p.reason}`
            .toLowerCase()
            .includes(filters.search.toLowerCase())) &&
        prefs['show' + p.change[0].toUpperCase() + p.change.slice(1)] !== false,
    )
    .sort((a, b) =>
      filters.sort === 'arrival'
        ? a.start - b.start
        : filters.sort === 'impact'
          ? { lost: 0, excluded: 1, unknown: 2, gained: 3, retained: 4 }[
              a.change
            ] -
            { lost: 0, excluded: 1, unknown: 2, gained: 3, retained: 4 }[
              b.change
            ]
          : a.name.localeCompare(b.name),
    );
}
function timeline(r) {
  const all = filteredRows(r.rows).sort((a, b) =>
    prefs.chartSort === 'arrival'
      ? a.start - b.start
      : prefs.chartSort === 'impact'
        ? { lost: 0, excluded: 1, unknown: 2, gained: 3, retained: 4 }[
            a.change
          ] -
          { lost: 0, excluded: 1, unknown: 2, gained: 3, retained: 4 }[b.change]
        : a.name.localeCompare(b.name),
  );
  const rows = showAllRows ? all : all.slice(0, 10);
  const min = Math.min(480, room.policy.open, room.baseline.open),
    max = Math.max(1200, room.policy.close, room.baseline.close),
    span = max - min;
  const pct = (t) => clamp(((t - min) / span) * 100, 0, 100);
  return `<div class="timeline-scroll"><div class="timeline"><div class="time-axis"><span>RESIDENT / CONSTRAINT</span><div class="axis-hours">${Array.from({ length: 7 }, (_, i) => `<span>${clock(min + (span * i) / 6)}</span>`).join('')}</div></div>${rows.map((p) => `<div class="timeline-row ${p.change}" role="button" tabindex="0" data-action="inspect-person" data-id="${esc(p.id)}" aria-label="${esc(p.name)}, ${p.day}, ${p.change}: ${esc(p.reason || 'a session fits')}"><div class="person-label">${prefs.chartAvatars ? `<span class="avatar">${esc(p.name[0])}</span>` : ''}<span class="name">${esc(p.name)}<small>${prefs.showGroup ? esc(p.group) : ''}${prefs.showDay && room.policy.days.length > 1 ? ' · ' + p.day : ''}${prefs.showWeights && p.weight > 1 ? ' · ×' + p.weight : ''}</small></span></div><div class="timeline-track"><span class="closed-area" style="width:${100 - pct(room.policy.close)}%"></span><span class="cutoff" style="left:${pct(room.policy.close)}%"></span>${p.status !== 'unknown' ? `${prefs.chartBaseline && p.before?.available > 0 ? `<span class="bar-base" style="left:${pct(p.before.start)}%;width:${Math.max(0, pct(p.before.finish) - pct(p.before.start))}%"></span>` : ''}<span class="bar" style="left:${pct(p.start)}%;width:${Math.max(0, pct(p.finish) - pct(p.start))}%;${prefs.chartColor === 'group' ? `background:${groupColor(p.group)}` : ''}"></span>${prefs.chartLabels ? `<span class="bar-label" style="left:${pct(p.start)}%">${clock(p.start)}–${clock(Math.max(p.start, p.finish))}${prefs.showMinSession ? ' / ' + p.needed + 'm needed' : ''}</span>` : ''}` : '<span class="bar-label" style="left:8%">Availability missing</span>'}</div></div>`).join('')}${!rows.length ? '<div class="notice">No resident-day observations match this view.</div>' : ''}</div></div><div style="padding:0 24px 16px;display:flex;justify-content:space-between;gap:10px"><span class="muted" style="font-size:8px">Windows shown; shared capacity checked separately.</span>${all.length > 10 ? `<button class="text-btn" style="font-size:9px" data-action="toggle-rows">${showAllRows ? 'Show first 10' : 'Show all ' + all.length + ' observations'} ↓</button>` : ''}</div>`;
}
function groupColor(g) {
  return (
    ['#487565', '#d18e76', '#8e9669', '#71919d', '#a08aaf', '#b49f64'][
      GROUPS.indexOf(g)
    ] || '#487565'
  );
}
function groupChart(r) {
  return `<div style="padding:10px 24px 28px">${r.groups.map((g) => `<div class="group-row"><span>${esc(g.name)}<small class="group-label" style="display:block">${num(g.served)} of ${num(g.total)} visits</small></span><div class="group-bar"><i style="width:${g.rate}%"></i>${prefs.chartBaseline ? `<b style="left:${g.baseline}%" title="Current reach ${num(g.baseline)}%"></b>` : ''}</div><strong>${num(g.rate)}%</strong></div>`).join('') || '<p class="muted">Add complete resident profiles to compare groups.</p>'}<p class="group-label">Dashed marks show current reach. Groups describe this supplied sample.</p></div>`;
}
function rippleMap(r) {
  return `<div class="ripple-map"><svg viewBox="0 0 660 340" role="img" aria-label="Relationship diagram of modelled access outcomes, not a geographical map"><circle cx="330" cy="170" r="54" fill="var(--soft)" stroke="var(--line)"/><circle cx="330" cy="170" r="100" fill="none" stroke="var(--line)" stroke-dasharray="3 5"/><circle cx="330" cy="170" r="144" fill="none" stroke="var(--line)"/><circle cx="330" cy="170" r="34" fill="var(--ink)" stroke="none"/><text x="330" y="166" text-anchor="middle" fill="var(--paper)" stroke="none" font-size="11">${clock(room.policy.close)}</text><text x="330" y="181" text-anchor="middle" fill="var(--paper)" stroke="none" font-size="7">CLOSING TIME</text>${r.rows
    .slice(0, 60)
    .map((p, i) => {
      const angle =
          (i / Math.min(60, r.rows.length)) * Math.PI * 2 - Math.PI / 2,
        rad = p.status === 'retained' ? 95 : p.status === 'unknown' ? 142 : 145;
      const x = 330 + Math.cos(angle) * rad * 1.55,
        y = 170 + Math.sin(angle) * rad;
      return `<g><line x1="330" y1="170" x2="${x}" y2="${y}" stroke="${p.status === 'retained' ? 'var(--good)' : 'var(--accent)'}" opacity=".12"/><circle cx="${x}" cy="${y}" r="${5 + Math.min(3, p.weight)}" class="dot-${p.status}" stroke="var(--panel)" stroke-width="2"/><text class="map-label" x="${x + Math.cos(angle) * 17}" y="${y + Math.sin(angle) * 15 + 3}" text-anchor="${Math.cos(angle) < -0.2 ? 'end' : Math.cos(angle) > 0.2 ? 'start' : 'middle'}">${prefs.chartLabels ? esc(p.name) : ''}</text></g>`;
    })
    .join(
      '',
    )}<text x="20" y="323" class="map-caption">INNER RING / ACCESS FITS</text><text x="430" y="323" class="map-caption">OUTER RING / BARRIER OR UNKNOWN</text></svg></div>`;
}
function sectionHead(title, desc, actions = '') {
  return `<div class="section-heading"><div><h3>${title}</h3><p>${desc}</p></div><div>${actions}</div></div>`;
}
function toolbar() {
  return `<div class="toolbar"><input type="search" data-filter="search" aria-label="Search residents" placeholder="Find a resident, need or barrier…" value="${esc(filters.search)}"><select aria-label="Filter by group" data-filter="group"><option value="all">Every group</option>${GROUPS.map((g) => `<option ${filters.group === g ? 'selected' : ''}>${g}</option>`).join('')}</select><select aria-label="Filter by outcome" data-filter="status">${[
    ['all', 'Every outcome'],
    ['lost', 'Access lost'],
    ['gained', 'Access gained'],
    ['retained', 'Retained access'],
    ['excluded', 'Still excluded'],
    ['unknown', 'Unknown'],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${filters.status === v ? 'selected' : ''}>${l}</option>`,
    )
    .join(
      '',
    )}</select><select aria-label="Sort residents" data-filter="sort">${[
    ['name', 'Alias A–Z'],
    ['arrival', 'Arrival time'],
    ['impact', 'Impact first'],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${filters.sort === v ? 'selected' : ''}>${l}</option>`,
    )
    .join(
      '',
    )}</select><button class="icon-btn outlined" data-action="person-layout" aria-label="Switch residents ${personLayout === 'cards' ? 'to table' : 'to cards'}">${icon(personLayout === 'cards' ? 'chart' : 'grid')}</button></div>`;
}
function renderPeople() {
  const r = result(),
    rows = filteredRows(r.rows),
    unique = [...new Map(rows.map((p) => [p.id, p])).values()];
  return `<div class="section-view">${sectionHead('People make the picture.', 'Use aliases and practical constraints. Keep personal identifiers out of the room.', `<button class="btn dark" data-action="add-person">${icon('plus')}Add resident</button>`)}${toolbar()}<div class="toolbar"><button class="btn small quiet" data-action="import">Import CSV</button><button class="btn small quiet" data-action="csv-template">Get CSV template</button><button class="text-btn" data-action="bulk-edit">Bulk edit</button><button class="text-btn" data-action="clear-filters">Reset filters</button><span class="muted" style="font-size:10px;margin-left:auto">${unique.length} of ${room.people.length} profiles</span></div>${unique.length ? (personLayout === 'cards' ? `<div class="card-grid">${unique.map((p) => personCard(p)).join('')}</div>` : peopleTable(unique)) : `<div class="empty">${icon('people')}<h4>Every story starts somewhere.</h4><p>Add a resident or clear your filters to start following the ripple.</p><button class="btn dark" data-action="add-person">Add the first resident</button></div>`}</div>`;
}
function statusBadge(p) {
  return `<span class="badge ${['lost', 'excluded'].includes(p.change) ? 'coral' : p.change === 'unknown' ? 'unknown' : 'green'}">${{ lost: 'Access lost', excluded: 'Still excluded', gained: 'Access gained', retained: 'Access retained', unknown: 'Unknown' }[p.change]}</span>`;
}
function personCard(p) {
  return `<article class="card person-card"><div class="card-top"><span class="avatar" style="background:${groupColor(p.group)}22">${esc(p.name[0])}</span>${statusBadge(p)}</div><h4>${esc(p.name)}</h4><div class="muted" style="font-size:10px">${esc(p.group)}${prefs.showWeights ? ' · represents ' + p.weight : ''}</div><div class="person-stats"><span><small>Available from</small>${p.arrive === null ? 'Unknown' : clock(p.arrive)}</span><span><small>Must leave by</small>${p.leaveBy === null ? 'Unknown' : clock(p.leaveBy)}</span><span><small>Session needed</small>${p.duration === null ? 'Unknown' : p.duration + ' min'}</span><span><small>Days available</small>${p.days.join(', ')}</span></div><div class="chips">${[
    ['transit', 'Bus dependent'],
    ['computer', 'Computer'],
    ['access', 'Step-free'],
    ['child', 'With child'],
    ['wifi', 'Internet'],
    ['quiet', 'Quiet space'],
  ]
    .filter(([k]) => p[k])
    .map(([, l]) => `<span class="chip">${l}</span>`)
    .join(
      '',
    )}</div><div class="reason ${p.status === 'retained' ? 'ok' : ''}">${esc(p.reason || 'A complete session fits')}${p.allocated ? ' · ' + clock(p.allocated.start) + '–' + clock(p.allocated.end) : ''}</div>${prefs.showNotes && p.note ? `<p style="margin-top:9px">${esc(p.note)}</p>` : ''}<div class="card-actions"><button class="text-btn" data-action="edit-person" data-id="${esc(p.id)}">Edit constraints ↗</button><button class="icon-btn" style="margin-left:auto" data-action="inspect-person" data-id="${esc(p.id)}" aria-label="Inspect ${esc(p.name)}">${icon('info')}</button></div></article>`;
}
function peopleTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>Resident alias</th>${prefs.showGroup ? '<th>Group</th>' : ''}<th>Available</th><th>Deadline</th><th>Session</th>${prefs.showTravel ? '<th>Travel in / out</th>' : ''}${prefs.showWeights ? '<th>Weight</th>' : ''}${prefs.showDay ? '<th>Days</th>' : ''}<th>Outcome</th>${prefs.showSource ? '<th>Source label</th>' : ''}<th>Action</th></tr></thead><tbody>${rows.map((p) => `<tr><td>${esc(p.name)}</td>${prefs.showGroup ? `<td>${esc(p.group)}</td>` : ''}<td>${p.arrive === null ? 'Unknown' : clock(p.arrive)}</td><td>${p.leaveBy === null ? 'Unknown' : clock(p.leaveBy)}</td><td>${p.duration ?? '?'} min</td>${prefs.showTravel ? `<td>${p.travelIn} / ${p.travelOut} min</td>` : ''}${prefs.showWeights ? `<td>${p.weight}</td>` : ''}${prefs.showDay ? `<td>${p.days.join(', ')}</td>` : ''}<td>${statusBadge(p)}</td>${prefs.showSource ? `<td>${esc(p.source)}</td>` : ''}<td><button data-action="edit-person" data-id="${esc(p.id)}">Edit</button></td></tr>`).join('')}</tbody></table></div>`;
}
function renderAlternatives() {
  const current = result().metrics;
  const list = alternatives(room.people, room.baseline, room.policy)
    .map((option, optionIndex) => ({ ...option, optionIndex }))
    .sort((a, b) => b.reach - a.reach || a.operatingCost - b.operatingCost);
  return `<div class="section-view">${sectionHead('There is always another what if.', 'These are modelled options to discuss, not recommendations made on behalf of your community.', `<button class="btn quiet" data-action="alternative-export">${icon('download')}Export options</button>`)}<div class="notice">Each option changes the named settings and keeps your other assumptions. Operating cost estimates cover opening hours only; extra equipment and transport may have costs not supplied here.</div><div class="card-grid">${list
    .map((a) => {
      const idx = a.optionIndex;
      return `<article class="card"><div class="card-top"><span class="card-icon">${icon('arrow')}</span><span class="badge ${a.reach > current.reach ? 'green' : ''}">${a.reach > current.reach ? '+' : ''}${num(a.reach - current.reach)} pp reach</span></div><h4>${esc(a.title)}</h4><div class="alternative-metrics"><span><small>Modelled reach</small><strong>${num(a.reach)}%</strong></span><span><small>Access lost</small><strong>${num(a.lost)}</strong></span><span><small>Operating estimate</small><strong style="font-size:15px">${money(a.operatingCost)}</strong></span></div><p>${Object.entries(
        a.patch,
      )
        .map(
          ([k, v]) =>
            esc(policyNames[k] || k) +
            ': ' +
            (typeof v === 'boolean'
              ? v
                ? 'available'
                : 'unavailable'
              : ['open', 'close', 'lastBus'].includes(k)
                ? clock(v)
                : esc(v)),
        )
        .join(
          ' · ',
        )}</p><button class="btn small quiet" data-action="apply-alternative" data-index="${idx}">Try this possibility ${icon('arrow')}</button></article>`;
    })
    .join('')}</div></div>`;
}
function renderScenarios() {
  const m = result().metrics;
  return `<div class="section-view">${sectionHead('Keep the possibilities side by side.', 'Snapshots preserve the supplied cohort, assumptions and results at the moment you save.', `<button class="btn dark" data-action="snapshot">${icon('save')}Save this scenario</button>`)}${room.scenarios.length ? `<div class="table-wrap"><table><thead><tr><th>Measure</th><th>Live proposal</th>${room.scenarios.map((s) => `<th>${esc(s.title)}<br><small>${fmtDate(s.createdAt)}</small></th>`).join('')}</tr></thead><tbody>${['reach', 'served', 'lost', 'gained', 'unknown', 'scheduledHours', 'unmetHours', 'equityGap', 'operatingCost', 'costSavings', 'completeness'].map((k) => `<tr><td>${metricLabels[k][0]}</td><td>${metricValue(k, m[k])} ${metricLabels[k][1] === 'ZAR' ? '' : metricLabels[k][1]}</td>${room.scenarios.map((s) => `<td>${metricValue(k, s.metrics[k])} ${metricLabels[k][1] === 'ZAR' ? '' : metricLabels[k][1]}</td>`).join('')}</tr>`).join('')}<tr><td>Closing time</td><td>${clock(room.policy.close)}</td>${room.scenarios.map((s) => `<td>${clock(s.policy.close)}</td>`).join('')}</tr><tr><td>Profiles captured</td><td>${room.people.length}</td>${room.scenarios.map((s) => `<td>${s.people.length}</td>`).join('')}</tr><tr><td>Actions</td><td>Live workspace</td>${room.scenarios.map((s) => `<td><button data-action="restore-scenario" data-id="${s.id}">Restore</button> · <button data-action="rename-scenario" data-id="${s.id}">Rename</button> · <button data-action="delete-scenario" data-id="${s.id}">Remove</button></td>`).join('')}</tr></tbody></table></div><div class="toolbar" style="margin-top:18px"><button class="btn quiet" data-action="comparison-export">${icon('download')}Comparison CSV</button><button class="btn quiet" data-action="comparison-json">Snapshot archive</button><button class="text-btn" data-action="clear-scenarios">Clear snapshots</button></div>` : `<div class="empty">${icon('grid')}<h4>Give a possibility a name.</h4><p>Save this proposal, change a few assumptions, then compare what happens.</p><button class="btn dark" data-action="snapshot">Save the first scenario</button></div>`}</div>`;
}
function renderEvidence() {
  return `<div class="section-view">${sectionHead('Show what you know. Name what you don’t.', 'Separate sources, observations and assumptions so people can challenge the picture.', `<button class="btn dark" data-action="add-evidence">${icon('plus')}Add evidence</button>`)}<div class="two-col"><div><h4 style="font-size:13px">Evidence ledger <span class="badge">${room.evidence.length}</span></h4>${room.evidence.map((e) => `<article class="card" style="margin-bottom:14px"><div class="card-top"><span class="badge">${esc(e.kind)}</span><span class="overline">${esc(e.confidence)}</span></div><h4>${esc(e.title)}</h4><p>${esc(e.detail)}</p>${safeURL(e.url) ? `<a class="text-btn" style="font-size:10px" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : ''}<div class="card-actions"><span class="muted" style="font-size:9px">${esc(e.date || 'Date not supplied')}</span><button class="text-btn" style="margin-left:auto" data-action="edit-evidence" data-id="${e.id}">Edit</button><button class="text-btn danger-text" data-action="delete-evidence" data-id="${e.id}">Remove</button></div></article>`).join('') || '<div class="notice">No evidence recorded yet. Start with one source or an explicit assumption.</div>'}</div><div><div class="section-heading"><h4 style="font-size:13px;margin:0">The conversation</h4><button class="text-btn" data-action="add-note">Add a note +</button></div>${room.notes.map((n) => `<article class="card note-card" style="margin-bottom:14px"><span class="badge">${esc(n.kind || 'Discussion')}</span><h4>${esc(n.title)}</h4><p>${esc(n.body)}</p><div class="card-actions"><time>${fmtDate(n.createdAt)}</time><button class="text-btn" style="margin-left:auto" data-action="edit-note" data-id="${n.id}">Edit</button><button class="text-btn danger-text" data-action="delete-note" data-id="${n.id}">Remove</button></div></article>`).join('') || '<div class="notice">Leave open questions, record disagreements and explain what you would need to know before making a decision.</div>'}<button class="btn quiet small" data-action="evidence-export">${icon('download')}Export the ledger</button></div></div></div>`;
}
function renderInsights() {
  const r = result();
  return `<div class="section-view">${sectionHead('Look a little closer.', 'Every number describes your supplied sample, not the whole community.', `<button class="btn quiet" data-action="metrics-export">${icon('download')}All measures</button>`)}<div class="two-col" style="margin-bottom:22px"><div class="card"><h4>Who carries the change?</h4>${groupChart(r)}</div><div class="card"><h4>Where the barriers appear</h4>${r.reasons.map(([reason, n]) => `<div class="group-row" style="grid-template-columns:1.4fr 1fr 25px"><span>${esc(reason)}</span><div class="group-bar"><i style="width:${r.metrics.excluded ? (n / r.metrics.excluded) * 100 : 0}%;background:var(--accent)"></i></div><strong>${num(n)}</strong></div>`).join('') || '<p>No exclusions in this run.</p>'}<p>Reasons follow a documented check order. A resident may face additional barriers.</p><button class="text-btn" data-action="bottleneck-export">Export barrier counts ↗</button></div></div><div class="card" style="margin-bottom:24px"><div class="section-heading"><div><h4>How much difference does 30 minutes make?</h4><p>Reach as closing time changes. Other assumptions remain fixed.</p></div><button class="text-btn" data-action="sensitivity-export">Export sweep ↗</button></div>${sensitivityChart()}<button class="text-btn" style="margin-top:15px" data-action="stress-test">Try a disruption test ↗</button></div><div class="toolbar"><input type="search" data-filter="metricSearch" placeholder="Search ${Object.keys(metricLabels).length} measures…" aria-label="Search analytic measures" value="${esc(prefs.metricSearch)}"></div><div class="metric-grid">${Object.entries(
    metricLabels,
  )
    .filter(([k, [l]]) =>
      l.toLowerCase().includes(prefs.metricSearch.toLowerCase()),
    )
    .map(
      ([k, [label, unit]]) =>
        `<button class="metric-tile" data-action="metric-detail" data-key="${k}"><h4>${esc(label)}</h4><strong>${metricValue(k, r.metrics[k])}</strong>${unit !== 'ZAR' && unit !== 'time' ? `<small>${unit}</small>` : ''}</button>`,
    )
    .join('')}</div></div>`;
}
function sweep() {
  const start = Math.max(room.policy.open + 30, 840);
  return Array.from({ length: 13 }, (_, i) => start + i * 30)
    .filter((close) => close <= 1440)
    .map((close) => ({
      close,
      ...analyse(room.people, room.baseline, { ...room.policy, close }).metrics,
    }));
}
function sensitivityChart() {
  const points = sweep();
  return `<div class="sensitivity-chart">${points.map((p) => `<button style="height:${Math.max(2, p.reach)}%" data-action="sweep-time" data-time="${p.close}" aria-label="Close at ${clock(p.close)}, modelled reach ${num(p.reach)} percent" title="${clock(p.close)} · ${num(p.reach)}%"><span>${num(p.reach)}%</span></button>`).join('')}</div><div class="sensitivity-axis">${points
    .filter((_, i) => i % 2 === 0)
    .map((p) => `<span>${clock(p.close)}</span>`)
    .join('')}</div>`;
}
function assumptions() {
  return [
    `Availability is self-supplied; missing times are ${room.policy.includeUnknown ? 'estimated from opening hours' : 'kept unknown'}.`,
    `Sessions need at least ${room.policy.minSession} minutes; a resident’s longer supplied need takes precedence.`,
    `Travel includes a ${room.policy.buffer}-minute buffer. Transit-dependent residents must meet the supplied last bus.`,
    `${room.policy.seats - room.policy.seatReserve} seats and ${room.policy.computers} computers are allocated in 15-minute slots, using ${room.policy.priority} order.`,
    `Representation weights affect reported totals, not physical slot demand. One profile receives at most one booking per day.`,
    `Operating cost is a supplied estimate of ${money(room.policy.costPerHour)} per opening hour. Other intervention costs are not included.`,
    `The sample is voluntary and not population-representative. Group differences do not establish discrimination or causation.`,
  ];
}
function reportMarkup() {
  const r = result(),
    m = r.metrics,
    p = room.policy,
    b = room.baseline;
  return `<article class="report ${prefs.reportPageBreak ? 'report-page-break' : ''} ${prefs.reportAccent ? '' : 'monochrome'}" id="decisionReport"><div class="report-kicker"><span>RIPPLE ROOM / DECISION BRIEF</span>${prefs.reportDate ? `<span>${fmtDate(new Date())}</span>` : ''}</div>${prefs.reportTitle ? `<h2>${esc(room.title)}</h2><p>${esc(room.description)}</p>` : ''}${room.demo ? '<div class="notice warning">Illustrative scenario · fictional resident profiles. This brief is a demonstration, not evidence about an actual community.</div>' : ''}${prefs.reportSummary ? `<div class="report-summary">The proposal closes at ${clock(p.close)} (currently ${clock(b.close)}), leaving ${num(m.served)} of ${num(m.population)} represented visits able to complete a session. ${num(m.lost)} lose access; ${num(m.gained)} gain it. ${num(m.unknown)} outcomes remain unknown.</div>` : ''}${prefs.reportMetrics ? stats(m) : ''}${prefs.reportBaseline ? `<h3>The decision in context</h3><div class="table-wrap"><table><thead><tr><th>Setting</th><th>Current</th><th>Proposed</th></tr></thead><tbody>${['open', 'close', 'seats', 'computers', 'lastBus', 'minSession', 'buffer', 'wheelchair', 'wifi', 'power', 'children', 'quiet'].map((k) => `<tr><td>${esc(policyNames[k])}</td><td>${policyDisplay(k, b[k])}</td><td>${policyDisplay(k, p[k])}</td></tr>`).join('')}</tbody></table></div>` : ''}${prefs.reportGroups ? `<h3>Who feels the change?</h3>${groupChart(r)}` : ''}${prefs.reportTimeline ? `<h3>Barrier summary</h3><ul>${r.reasons.map(([reason, n]) => `<li>${esc(reason)}: ${num(n)} represented visits.</li>`).join('') || '<li>No exclusions in the supplied sample.</li>'}</ul>` : ''}${
    prefs.reportAssumptions
      ? `<h3>Assumptions to discuss</h3><ul>${assumptions()
          .map((s) => `<li>${esc(s)}</li>`)
          .join('')}</ul>`
      : ''
  }${
    prefs.reportAlternatives
      ? `<h3>Possibilities worth discussing</h3><ul>${alternatives(
          room.people,
          b,
          p,
        )
          .sort((a, b) => b.reach - a.reach)
          .slice(0, 3)
          .map(
            (a) =>
              `<li>${esc(a.title)}: ${num(a.reach)}% modelled reach, ${num(a.lost)} represented visits lose access.</li>`,
          )
          .join('')}</ul>`
      : ''
  }${prefs.reportEvidence ? `<h3>What the picture rests on</h3>${room.evidence.map((e) => `<p><strong>${esc(e.title)}</strong> · ${esc(e.kind)} · ${esc(e.confidence)} · ${esc(e.date)}<br>${esc(e.detail)}${safeURL(e.url) ? `<br><a href="${esc(e.url)}">${esc(e.url)}</a>` : ''}</p>`).join('') || '<p>No evidence sources have been recorded.</p>'}` : ''}${prefs.reportNotes && room.notes.length ? `<h3>Open questions & discussion</h3>${room.notes.map((n) => `<p><strong>${esc(n.title)}</strong><br>${esc(n.body)}</p>`).join('')}` : ''}${prefs.reportPeople ? `<h3>Supplied resident aliases — private appendix</h3><p>This optional appendix may contain sensitive constraints. Share deliberately.</p>${peopleTable(r.rows)}` : ''}${prefs.reportMethods ? `<h3>Method</h3><p>Compare each supplied resident-day against current and proposed conditions. Calculate usable windows after travel and transport deadlines. Check access requirements, then allocate uninterrupted 15-minute slots against shared capacity. The first identified barrier is reported. Unknown outcomes remain separate unless estimation is explicitly enabled.</p>` : ''}${prefs.reportLimitations ? `<h3>What this model cannot tell you</h3><p>This is a deterministic scenario model, not a forecast or a decision on anyone’s eligibility. It does not measure unrepresented residents, service quality, future demand or unrecorded barriers. Sample results should be discussed with the people affected. Represented visits are not a verified population count.</p>` : ''}${prefs.reportFooter ? '<div class="report-footer">Prepared with Ripple Room · Designed & developed by Simoné Govender · A Quantum Cupcake Creation</div>' : ''}</article>`;
}
function renderReport() {
  return `<div class="section-view">${sectionHead('A decision people can question.', 'A clear, shareable brief with assumptions, trade-offs and gaps in plain view.', `<button class="btn quiet" data-action="report-settings">${icon('settings')}Customise</button> <button class="btn dark" data-action="print">${icon('download')}Print / PDF</button>`)}<div class="toolbar"><button class="btn small quiet" data-action="report-html">Download HTML</button><button class="btn small quiet" data-action="report-markdown">Download Markdown</button><button class="btn small quiet" data-action="share">${icon('share')}Share aggregate snapshot</button><button class="text-btn" data-action="report-copy">Copy summary</button></div>${reportMarkup()}</div>`;
}
const policyNames = {
  open: 'Opening time',
  close: 'Closing time',
  seats: 'Available seats',
  computers: 'Computer places',
  minSession: 'Minimum session',
  buffer: 'Travel safety buffer',
  lastBus: 'Last bus departure',
  extraBus: 'Later bus allowance',
  lateStart: 'Arrival disruption',
  travelAdjustment: 'Extra travel each way',
  sessionAdjustment: 'Session adjustment',
  seatReserve: 'Reserved seats',
  priority: 'Allocation order',
  wheelchair: 'Step-free access',
  wifi: 'Internet access',
  power: 'Power available',
  quiet: 'Quiet space',
  staff: 'Staff coverage',
  children: 'Accompanying children',
  weekend: 'Weekend access',
  includeUnknown: 'Estimate unknown availability',
  weighting: 'Representation weights',
  step: 'Time slider increments',
  days: 'Days modelled',
  costPerHour: 'Hourly operating cost',
  travelCost: 'Return-trip cost',
  staffCount: 'Staff count',
  staffHours: 'Staff hours',
  carbonPerTrip: 'Trip emissions assumption',
};
function policyDisplay(k, v) {
  return typeof v === 'boolean'
    ? v
      ? 'Available / enabled'
      : 'Unavailable / disabled'
    : ['open', 'close', 'lastBus'].includes(k)
      ? clock(v)
      : Array.isArray(v)
        ? v.join(', ')
        : esc(v);
}
function safeURL(s) {
  try {
    return ['https:', 'http:'].includes(new URL(s).protocol);
  } catch {
    return false;
  }
}
function textInput(name, label, value = '', type = 'text', extra = '') {
  return `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
}
function selectInput(name, label, values, current) {
  return `<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">${values
    .map((v) => {
      const [key, label] = Array.isArray(v) ? v : [v, v];
      return `<option value="${esc(key)}" ${key === current ? 'selected' : ''}>${esc(label)}</option>`;
    })
    .join('')}</select></div>`;
}
function formActions(label = 'Save changes') {
  return `<div id="formError" role="alert"></div><div class="dialog-actions"><button type="button" class="btn quiet" data-action="close-dialog">Cancel</button><button type="submit" class="btn dark">${label} ${icon('check')}</button></div>`;
}
function personForm(id) {
  const p = room.people.find((p) => p.id === id) || {
    id: '',
    name: '',
    group: 'Learners',
    arrive: 900,
    leaveBy: 1080,
    duration: 45,
    travelIn: 10,
    travelOut: 10,
    weight: 1,
    priority: 0,
    days: ['Mon'],
    source: '',
    note: '',
  };
  dialog(
    p.id
      ? 'A little context changes the picture.'
      : 'Make room for another resident.',
    `<form data-form="person" data-id="${p.id}"><div class="notice">Use an alias. Record practical needs without names, contact details or diagnoses. Keep the resident’s permission to use their contribution.</div><div class="form-grid">${textInput('name', 'Resident alias', p.name, 'text', 'required maxlength="50"')}${selectInput('group', 'Group', GROUPS, p.group)}${textInput('arrive', 'Available from (leave blank if unknown)', p.arrive === null ? '' : clock(p.arrive), 'time')}${textInput('leaveBy', 'Must depart by (blank if unknown)', p.leaveBy === null ? '' : clock(p.leaveBy), 'time')}${textInput('duration', 'Session required (minutes)', p.duration ?? '', 'number', 'min="15" max="720"')}${textInput('weight', 'Residents represented', p.weight, 'number', 'min="1" max="1000" required')}${textInput('travelIn', 'Travel to this space (minutes)', p.travelIn, 'number', 'min="0" max="240" required')}${textInput('travelOut', 'Travel from space to destination / bus', p.travelOut, 'number', 'min="0" max="240" required')}${selectInput(
      'priority',
      'Supplied priority',
      [
        [0, 'Standard'],
        [1, 'Priority'],
        [2, 'Protected priority'],
      ],
      p.priority,
    )}${textInput('source', 'Source label', p.source, 'text', 'maxlength="300"')}<div class="field wide"><label>Days available</label><div style="display:flex;gap:13px;flex-wrap:wrap">${DAYS.map((d) => `<label style="font-size:11px;display:flex;gap:4px"><input type="checkbox" name="days" value="${d}" ${p.days.includes(d) ? 'checked' : ''}>${d}</label>`).join('')}</div></div><div class="checkbox-grid wide">${[
      ['transit', 'Depends on the last bus'],
      ['computer', 'Needs a computer'],
      ['wifi', 'Needs internet'],
      ['access', 'Needs step-free access'],
      ['child', 'Needs to bring a child'],
      ['quiet', 'Needs quiet space'],
    ]
      .map(
        ([k, l]) =>
          `<label class="switch-label"><span>${l}</span><input type="checkbox" name="${k}" ${p[k] ? 'checked' : ''}></label>`,
      )
      .join(
        '',
      )}</div><div class="field wide"><label for="f-note">Context in their words (optional)</label><textarea id="f-note" name="note" maxlength="1000">${esc(p.note)}</textarea></div></div>${p.id ? `<div style="display:flex;gap:17px"><button type="button" class="text-btn" data-action="duplicate-person" data-id="${p.id}">Duplicate profile</button><button type="button" class="text-btn danger-text" data-action="delete-person" data-id="${p.id}">Remove profile</button></div>` : ''}${formActions(p.id ? 'Save constraints' : 'Add resident')}</form>`,
    'PEOPLE & THEIR EVERYDAY REALITIES',
  );
}
function inspectPerson(id, day) {
  const p = result().rows.find((p) => p.id === id && (!day || p.day === day));
  if (!p) return;
  dialog(
    esc(p.name) + '’s ripple',
    `<div class="notice">${statusBadge(p)} <span style="margin-left:8px">${esc(p.group)} · ${p.day} · represents ${p.weight}</span></div><div class="two-col"><div class="card"><div class="overline">CURRENT SITUATION</div><h4>${p.before.status === 'retained' ? 'A session fits' : p.before.status === 'unknown' ? 'Unknown outcome' : 'A barrier remains'}</h4><p>${esc(p.before.reason || 'Capacity and access requirements are met.')}</p><p>Window: ${clock(p.before.start)}–${clock(Math.max(p.before.start, p.before.finish))}<br>${p.before.available} available minutes</p></div><div class="card"><div class="overline">YOUR PROPOSAL</div><h4>${p.status === 'retained' ? 'A session fits' : p.status === 'unknown' ? 'Unknown outcome' : 'A barrier appears'}</h4><p>${esc(p.reason || 'Capacity and access requirements are met.')}</p><p>Window: ${clock(p.start)}–${clock(Math.max(p.start, p.finish))}<br>${p.available} available minutes</p></div></div><p style="font-size:12px;line-height:1.9">Required session: ${p.needed} minutes. ${p.allocated ? 'Allocated slot: ' + clock(p.allocated.start) + '–' + clock(p.allocated.end) + '.' : 'No slot allocated.'} ${esc(p.note)}</p><div class="dialog-actions"><button class="btn quiet" data-action="delete-person" data-id="${p.id}">Remove</button><button class="btn dark" data-action="edit-person" data-id="${p.id}">Edit these constraints</button></div>`,
    'FOLLOW ONE LIFE THROUGH THE CHANGE',
  );
}
function evidenceForm(id) {
  const e = room.evidence.find((e) => e.id === id) || {
    id: '',
    title: '',
    kind: 'Observation',
    detail: '',
    date: new Date().toISOString().slice(0, 10),
    url: '',
    confidence: 'Unverified',
  };
  dialog(
    e.id ? 'Keep the source clear.' : 'What does this assumption rest on?',
    `<form data-form="evidence" data-id="${e.id}"><div class="form-grid">${textInput('title', 'Evidence title', e.title, 'text', 'required maxlength="150"')}${selectInput('kind', 'Evidence type', ['Observation', 'Survey', 'Official source', 'Assumption', 'Meeting note', 'Open question'], e.kind)}${selectInput('confidence', 'Verification state', ['Verified', 'Unverified', 'Illustrative', 'Outdated', 'Needs review'], e.confidence)}${textInput('date', 'Date recorded', e.date, 'date')}${textInput('url', 'Source link (optional)', e.url, 'url', 'maxlength="1000"')}<div class="field wide"><label for="f-detail">What it tells us, and what it does not</label><textarea id="f-detail" name="detail" required maxlength="4000">${esc(e.detail)}</textarea></div></div>${formActions('Save evidence')}</form>`,
    'A TRACEABLE PICTURE',
  );
}
function noteForm(id) {
  const n = room.notes.find((n) => n.id === id) || {
    id: '',
    title: '',
    kind: 'Open question',
    body: '',
  };
  dialog(
    n.id ? 'Continue the conversation.' : 'Leave a thought in the room.',
    `<form data-form="note" data-id="${n.id}">${textInput('title', 'A short title', n.title, 'text', 'required maxlength="150"')}${selectInput('kind', 'Note type', ['Open question', 'Discussion', 'Disagreement', 'Decision', 'Next step'], n.kind)}<div class="field"><label for="f-body">The note</label><textarea id="f-body" name="body" required maxlength="5000">${esc(n.body)}</textarea></div>${formActions('Save note')}</form>`,
    'DECISIONS DESERVE A CONVERSATION',
  );
}
function newRoomDialog() {
  dialog(
    'What kind of ripple are you exploring?',
    `<p>Start with an illustrative room, or create an empty one for your community.</p><div class="card-grid">${templates.map((t) => `<article class="card"><div class="preset-preview">${icon(t.icon)}</div><span class="overline">${t.category}</span><h4>${esc(t.title)}</h4><p>${esc(t.description)}</p><button class="btn quiet small" data-action="use-template" data-id="${t.id}">Open this room ${icon('arrow')}</button></article>`).join('')}</div>`,
    'A DIFFERENT DECISION. A DIFFERENT WORLD.',
  );
}
async function openRoom(id) {
  if (room) await persist();
  const found = await db.get('rooms', id);
  if (!found) throw Error('This room is no longer on this device.');
  room = validateWorkspace(found);
  history = [];
  future = [];
  filters = {
    search: '',
    group: 'all',
    status: 'all',
    sort: 'name',
    day: 'all',
  };
  view = 'lab';
  await db.put('settings', { id: 'active', value: room.id });
  closeDialog();
  render();
}
async function addRoom(id) {
  await persist();
  room = createRoom(id);
  history = [];
  future = [];
  view = 'lab';
  filters.search = '';
  await persist();
  closeDialog();
  render();
  $('#workspace').scrollIntoView({
    behavior: prefs.motion ? 'smooth' : 'instant',
  });
  toast('A new room is ready.');
  if (id === 'blank') roomMetadata();
}
function roomsDialog() {
  dialog(
    'Your rooms, with room to grow.',
    `<p>Device rooms stay in this browser. Private cloud copies are available after sign-in.</p><div class="card-grid">${rooms.map((r) => `<article class="card"><span class="overline">${r.demo ? 'ILLUSTRATIVE' : 'YOUR COMMUNITY'}</span><h4>${esc(r.title)}</h4><p>${r.people.length} profiles · ${r.scenarios.length} snapshots<br>Updated ${fmtDate(r.updatedAt)}</p><div class="card-actions"><button class="btn small ${r.id === room.id ? 'dark' : 'quiet'}" data-action="open-room" data-id="${r.id}">${r.id === room.id ? 'Current room' : 'Open room'}</button><button class="text-btn danger-text" data-action="remove-room" data-id="${r.id}">Remove</button></div></article>`).join('')}</div><div class="dialog-actions"><button class="btn quiet" data-action="cloud-rooms">Cloud copies</button><button class="btn dark" data-action="new">New room ${icon('plus')}</button></div>`,
    'A LITTLE SPACE TO EXPERIMENT',
  );
}
function roomMetadata() {
  dialog(
    'Give this room its own context.',
    `<form data-form="metadata">${textInput('title', 'Room name', room.title, 'text', 'required maxlength="120"')}${textInput('location', 'General community / area (optional)', room.location, 'text', 'maxlength="150"')}<div class="field"><label for="f-description">What decision are you exploring?</label><textarea id="f-description" name="description" maxlength="1500">${esc(room.description)}</textarea></div><label class="switch-label"><span>This is an illustrative dataset</span><input name="demo" type="checkbox" ${room.demo ? 'checked' : ''}></label>${formActions('Save room details')}</form>`,
    'YOUR ROOM. YOUR CONTEXT.',
  );
}
function snapshotDialog(id) {
  const s = room.scenarios.find((s) => s.id === id);
  dialog(
    s
      ? 'Give this possibility a new name.'
      : 'A possibility worth remembering.',
    `<form data-form="snapshot" data-id="${s?.id || ''}">${textInput('title', 'Scenario name', s?.title || `Closing at ${clock(room.policy.close)}`, 'text', 'required maxlength="100"')}<p class="muted" style="font-size:11px">${s ? 'Only the name will change.' : 'This captures the current residents, baseline, assumptions, group results and all analytic measures.'}</p>${formActions(s ? 'Rename snapshot' : 'Save scenario')}</form>`,
    'A MOMENT IN THE MODEL',
  );
}
const prefLabels = {
  motion: 'Interface motion',
  contrast: 'Higher contrast',
  chartLabels: 'Window labels',
  chartGrid: 'Timeline grid',
  chartBaseline: 'Current-situation overlay',
  chartAvatars: 'Alias initials on charts',
  chartAnimation: 'Chart transitions',
  showUnknown: 'Show unknown outcomes',
  showRetained: 'Show retained access',
  showExcluded: 'Show existing exclusions',
  showGained: 'Show gained access',
  showLost: 'Show lost access',
  showLegend: 'Chart legends',
  showWeights: 'Representation weights in profiles',
  showNotes: 'Resident context in cards',
  showTravel: 'Travel columns in resident tables',
  showMinSession: 'Required session on timeline',
  showBuffer: 'Buffer reminder under charts',
  showCapacity: 'Capacity reminder under charts',
  showDay: 'Day labels',
  showGroup: 'Group labels',
  showSource: 'Source labels in tables',
  autoSave: 'Automatically save to this device',
  keyboard: 'Keyboard shortcuts',
  confirmDelete: 'Confirm removal actions',
  screenReader: 'Expanded text summary under charts',
  stickyControls: 'Keep decision controls in view',
  tableStriped: 'Alternating table rows',
  tableCompact: 'Compact tables',
  reduceShadows: 'Reduce visual shadows',
  largeTargets: 'Larger button targets',
  focusMode: 'Focus on the workspace',
  reportPeople: 'Include private resident appendix',
  reportEvidence: 'Include evidence ledger',
  reportAssumptions: 'Include assumptions',
  reportAlternatives: 'Include alternatives',
  reportGroups: 'Include group comparisons',
  reportMetrics: 'Include headline measures',
  reportTimeline: 'Include barrier summary',
  reportNotes: 'Include discussion notes',
  reportTitle: 'Include room title and description',
  reportFooter: 'Include report credits',
  reportDate: 'Include report date',
  reportBaseline: 'Include current / proposed settings',
  reportLimitations: 'Include limitations',
  reportMethods: 'Include method',
  reportPageBreak: 'Start report sections on new pages',
  reportAccent: 'Use colour in the report',
  reportSummary: 'Include plain-language summary',
};
function prefToggle(k) {
  return `<div class="setting-row"><label class="switch-label"><span>${prefLabels[k]}</span><input data-pref="${k}" type="checkbox" ${prefs[k] ? 'checked' : ''}></label></div>`;
}
function prefSelect(k, label, options) {
  return `<div class="field"><label for="pref-${k}">${label}</label><select id="pref-${k}" data-pref="${k}">${options
    .map((v) => {
      const [key, label] = Array.isArray(v) ? v : [v, v];
      return `<option value="${key}" ${String(prefs[k]) === String(key) ? 'selected' : ''}>${label}</option>`;
    })
    .join('')}</select></div>`;
}
function settingsDialog(category = 'all') {
  const report = category === 'report';
  const bools = Object.keys(prefLabels).filter((k) =>
    report ? k.startsWith('report') : !k.startsWith('report'),
  );
  dialog(
    report
      ? 'Shape the brief around the conversation.'
      : 'Make yourself at home.',
    `${report ? '<div class="notice warning">Resident appendices are off by default. Aggregate snapshots never include individual resident records, evidence notes or discussion text.</div>' : ''}${
      !report
        ? `<div class="form-grid">${prefSelect('theme', 'Room atmosphere', [
            ['paper', 'Paper & cobalt'],
            ['night', 'Night studio'],
          ])}${prefSelect('accent', 'Accent colour', [
            ['coral', 'Terracotta'],
            ['violet', 'Wisteria'],
            ['gold', 'Ochre'],
            ['blue', 'Harbour blue'],
          ])}${prefSelect('fontSize', 'Reading scale', [
            [14, 'Compact · 88%'],
            [16, 'Standard · 100%'],
            [18, 'Comfortable · 113%'],
            [20, 'Large · 125%'],
          ])}${prefSelect('density', 'Layout density', [
            ['comfortable', 'Comfortable'],
            ['compact', 'Compact'],
          ])}${prefSelect('metricPrecision', 'Number precision', [
            [0, 'Whole numbers'],
            [1, 'One decimal'],
            [2, 'Two decimals'],
          ])}${prefSelect('locale', 'Number and date format', [
            ['en-ZA', 'South Africa'],
            ['en-GB', 'United Kingdom'],
            ['en-US', 'United States'],
          ])}${prefSelect('chartColor', 'Timeline colours', [
            ['status', 'By access outcome'],
            ['group', 'By resident group'],
          ])}${prefSelect('chartSort', 'Timeline order', [
            ['name', 'Alias A–Z'],
            ['arrival', 'Arrival time'],
            ['impact', 'Impact first'],
          ])}${prefSelect('chartHeight', 'Timeline row spacing', [
            [34, 'Compact'],
            [44, 'Standard'],
            [54, 'Spacious'],
          ])}</div>`
        : prefSelect('reportOrientation', 'Print orientation', [
            ['portrait', 'Portrait'],
            ['landscape', 'Landscape'],
          ])
    }<div class="settings-grid">${bools.map(prefToggle).join('')}</div><div class="dialog-actions"><button class="btn quiet" data-action="${report ? 'report-defaults' : 'reset-prefs'}">Restore defaults</button><button class="btn dark" data-action="close-dialog">Done ${icon('check')}</button></div>`,
    'A FEW SMALL ADJUSTMENTS',
  );
}
function baselineEditor() {
  dialog(
    'The situation you are comparing against.',
    `<p>Edit the current conditions. The same resident cohort and selected days are used in both runs.</p><div class="form-grid">${['open', 'close', 'lastBus'].map((k) => timeField(k, policyNames[k], 'baseline')).join('')}${['seats', 'computers', 'minSession', 'buffer', 'extraBus', 'lateStart', 'travelAdjustment', 'sessionAdjustment', 'seatReserve', 'costPerHour', 'travelCost', 'staffCount', 'staffHours', 'carbonPerTrip'].map((k) => numberField(k, policyNames[k], k === 'sessionAdjustment' ? -60 : 0, ['seats', 'computers', 'seatReserve'].includes(k) ? 200 : k === 'costPerHour' ? 100000 : k === 'travelCost' ? 10000 : k === 'staffCount' ? 100 : k === 'staffHours' ? 24 : k === 'carbonPerTrip' ? 100 : 240, 'baseline', k === 'carbonPerTrip' ? 0.1 : 1)).join('')}</div><div class="checkbox-grid">${['wheelchair', 'wifi', 'power', 'quiet', 'staff', 'children', 'weekend'].map((k) => switchField(k, policyNames[k], 'baseline')).join('')}</div><div class="field"><label>Allocation order</label><select data-baseline="priority">${['deadline', 'earliest', 'shortest', 'priority'].map((p) => `<option ${room.baseline.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div><div class="dialog-actions"><button class="btn quiet" data-action="baseline-from-policy">Use proposed conditions as current</button><button class="btn dark" data-action="close-dialog">Done</button></div>`,
    'AN HONEST POINT OF COMPARISON',
  );
}
function methodsDialog() {
  dialog(
    'A model you can look inside.',
    `<div class="help-steps"><div class="help-step"><div><h4>Start with a usable window.</h4><p>Availability starts after the supplied journey to the space and any arrival disruption. Departure is the earliest of closing time, the resident’s deadline and—when required—the last bus, minus the outward journey and safety buffer.</p></div></div><div class="help-step"><div><h4>Check what a complete session needs.</h4><p>A window must fit the greater of the room minimum and the resident’s adjusted session length. Step-free access, power, internet, quiet space, accompanying children, staff and weekend availability are checked when applicable.</p></div></div><div class="help-step"><div><h4>Share finite capacity.</h4><p>Available seats and computer places are booked in uninterrupted 15-minute slots, using the allocation order you choose. This is a greedy scheduling model, not a proof of the optimal allocation. Different orderings may produce different results.</p></div></div><div class="help-step"><div><h4>Keep unknowns visible.</h4><p>Missing arrival, departure or session length leaves an outcome unknown by default. If estimation is enabled, opening hours and a 45-minute session are used as explicit fallback assumptions. They are not recovered facts.</p></div></div><div class="help-step"><div><h4>Describe representation honestly.</h4><p>Weights multiply reported resident visits. They do not create extra physical bookings. Add separate profiles to model concurrent resource demand. Repeat observations across selected days are visits, not unique residents.</p></div></div><div class="help-step"><div><h4>Invite disagreement.</h4><p>The first barrier in the check order is reported: missing data, staff, weekend, step-free access, power, internet, quiet space, children, usable time, then capacity. Multiple barriers can coexist. Estimates describe the supplied sample and should support discussion with the people affected.</p></div></div></div><div class="dialog-actions"><button class="btn quiet" data-action="methods-export">Download method notes</button><button class="btn dark" data-action="close-dialog">Back to the room</button></div>`,
    'NO MYSTERY BETWEEN INPUT AND OUTCOME',
  );
}
function guideDialog() {
  dialog(
    'One decision. A wider conversation.',
    `<div class="help-steps">${[
      [
        'Choose a room.',
        'Explore a fictional example or start with a blank space. Name the decision and describe its context.',
      ],
      [
        'Listen before you model.',
        'Add anonymous resident constraints: available times, travel, session length and practical access needs. Record what is missing.',
      ],
      [
        'Move one thing.',
        'Change a closing time or resource. Follow each resident’s window and inspect why an outcome changes.',
      ],
      [
        'Try a different possibility.',
        'Test alternatives, save snapshots and compare the costs, benefits and distribution of access.',
      ],
      [
        'Put the assumptions on the table.',
        'Attach evidence, record questions and export a decision brief. The people affected should help decide what happens next.',
      ],
    ]
      .map(
        ([h, p]) =>
          `<div class="help-step"><div><h4>${h}</h4><p>${p}</p></div></div>`,
      )
      .join(
        '',
      )}</div><div class="notice" style="margin-top:20px">Keyboard: <strong>?</strong> opens this guide · <strong>/</strong> finds a tool · <strong>Alt + 1–7</strong> changes views · <strong>Ctrl/Cmd + S</strong> saves locally · <strong>Ctrl/Cmd + Z</strong> undo · <strong>Ctrl/Cmd + Shift + Z</strong> redo.</div><div class="dialog-actions"><button class="btn dark" data-action="close-dialog">Let’s follow the ripple ${icon('arrow')}</button></div>`,
    'A FIELD GUIDE TO BETTER WHAT IFS',
  );
}
function privacyDialog() {
  dialog(
    'A smaller footprint. A clearer choice.',
    `<div class="help-steps"><div class="help-step"><div><h4>Your device is the starting point.</h4><p>Rooms and preferences are stored in this browser’s IndexedDB. They are not automatically uploaded. Clearing site data removes device copies; JSON exports are portable backups.</p></div></div><div class="help-step"><div><h4>Cloud copies are a deliberate action.</h4><p>Signing in uses Supabase authentication. Choosing “Save private cloud copy” sends this room—including its resident aliases, constraints, evidence and notes—to the connected database. Row-level access rules restrict records to their signed-in owner. Device and cloud copies are separate until you explicitly save or load them.</p></div></div><div class="help-step"><div><h4>Use aliases and minimise what you collect.</h4><p>A practical need can still be sensitive. Do not record contact details, identity numbers, medical diagnoses or information you do not have permission to use. A shared device is not a private workspace.</p></div></div><div class="help-step"><div><h4>Share the picture deliberately.</h4><p>Aggregate links include group totals and results, but no individual profiles, evidence text or discussion notes. Small group totals may still identify people in a small community. Review them before copying a link. Full JSON and private report appendices include your underlying records.</p></div></div></div><p>No advertising, tracking pixels or analytics scripts are included. The hosting provider and database provider may process normal service logs. Typography files are served from this site; system fonts provide a fallback.</p><div class="dialog-actions"><button class="btn quiet" data-action="export-anonymous">Export anonymised copy</button><button class="btn dark" data-action="close-dialog">Done</button></div>`,
    'THE PEOPLE BEHIND THE DATA MATTER',
  );
}
function bulkDialog() {
  dialog(
    'A careful change across several profiles.',
    `<form data-form="bulk"><div class="notice">Changes affect profiles matching the group below. Undo can restore the previous state.</div>${selectInput('group', 'Profiles to change', [['all', 'Every profile'], ...GROUPS.map((g) => [g, g])], 'all')}${selectInput(
      'operation',
      'Change',
      [
        ['travelIn', 'Set travel to space (minutes)'],
        ['travelOut', 'Set outward travel (minutes)'],
        ['duration', 'Set required session (minutes)'],
        ['weight', 'Set representation weight'],
        ['priority', 'Set priority (0–2)'],
        ['transit', 'Set bus dependency (0 or 1)'],
        ['computer', 'Set computer need (0 or 1)'],
        ['wifi', 'Set internet need (0 or 1)'],
        ['access', 'Set step-free need (0 or 1)'],
        ['child', 'Set accompanying child (0 or 1)'],
        ['quiet', 'Set quiet-space need (0 or 1)'],
      ],
      'travelIn',
    )}${textInput('value', 'New value', 15, 'number', 'required min="0" max="1000"')}${formActions('Apply to matching profiles')}</form>`,
    'THE SAME CHANGE, WITH A TRACEABLE UNDO',
  );
}
function stressDialog() {
  dialog(
    'Put the proposal under a little pressure.',
    `<p>Each test applies one explicit disruption. Compare the new outcome before deciding whether to keep it.</p><div class="card-grid">${[
      [
        'Late arrival',
        'Add 15 minutes to effective arrival.',
        'lateStart',
        room.policy.lateStart + 15,
      ],
      [
        'Longer travel',
        'Add 10 minutes to each journey.',
        'travelAdjustment',
        room.policy.travelAdjustment + 10,
      ],
      [
        'Fewer computers',
        'Remove two available computers.',
        'computers',
        Math.max(0, room.policy.computers - 2),
      ],
      ['No internet', 'Check internet-dependent activities.', 'wifi', false],
      ['No power', 'Check computer-dependent activities.', 'power', false],
      ['No staff', 'Check the effect of missing coverage.', 'staff', false],
    ]
      .map(
        ([t, d, k, v]) =>
          `<div class="card"><h4>${t}</h4><p>${d}</p><button class="btn quiet small" data-action="stress-apply" data-key="${k}" data-value="${v}">Run this test</button></div>`,
      )
      .join('')}</div>`,
    'RESILIENCE IS A QUESTION YOU CAN TEST',
  );
}
function confirmAction(title, detail, action, id = '') {
  if (!prefs.confirmDelete)
    return performAction(action, { id, confirmed: 'true' });
  dialog(
    title,
    `<p>${esc(detail)}</p><div class="dialog-actions"><button class="btn quiet" data-action="close-dialog">Keep it</button><button class="btn coral" data-action="${action}" data-id="${esc(id)}" data-confirmed="true">Remove</button></div>`,
    'A DELIBERATE LITTLE PAUSE',
  );
}
function download(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Your download is ready.');
}
const slug = () =>
  room.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'ripple-room';
function csv(headers, rows) {
  return (
    '\ufeff' +
    [headers, ...rows]
      .map((row) =>
        row
          .map((v) =>
            csvEscape(typeof v === 'string' && /^[=+@-]/.test(v) ? "'" + v : v),
          )
          .join(','),
      )
      .join('\r\n')
  );
}
function summary() {
  const m = result().metrics;
  return `${room.title}\nCurrent closing: ${clock(room.baseline.close)}. Proposed closing: ${clock(room.policy.close)}.\n${num(m.served)} of ${num(m.population)} represented visits retain access (${num(m.reach)}%). ${num(m.lost)} lose access; ${num(m.gained)} gain access. ${num(m.unknown)} outcomes unknown.\n${room.demo ? 'Illustrative dataset. Fictional resident profiles.\n' : ''}This model describes supplied constraints and assumptions, not a population forecast.\nPrepared with Ripple Room.`;
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied.');
  } catch {
    dialog(
      'Copy this text.',
      `<textarea readonly style="width:100%;min-height:180px">${esc(text)}</textarea>`,
    );
  }
}
function exportPeople() {
  const headers = [
    'name',
    'group',
    'arrive',
    'leaveBy',
    'duration',
    'travelIn',
    'travelOut',
    'weight',
    'priority',
    'days',
    'transit',
    'computer',
    'wifi',
    'access',
    'child',
    'quiet',
    'source',
    'note',
  ];
  download(
    slug() + '-resident-constraints.csv',
    csv(
      headers,
      room.people.map((p) =>
        headers.map((k) =>
          k === 'arrive' || k === 'leaveBy'
            ? p[k] === null
              ? ''
              : clock(p[k])
            : k === 'days'
              ? p[k].join('|')
              : p[k],
        ),
      ),
    ),
    'text/csv;charset=utf-8',
  );
}
function exportOutcomes() {
  const r = result();
  const headers = [
    'alias',
    'group',
    'day',
    'outcome',
    'status',
    'first_barrier',
    'window_start',
    'window_end',
    'usable_minutes',
    'required_minutes',
    'allocated_start',
    'allocated_end',
    'representation',
  ];
  download(
    slug() + '-outcomes.csv',
    csv(
      headers,
      r.rows.map((p) => [
        p.name,
        p.group,
        p.day,
        p.change,
        p.status,
        p.reason,
        clock(p.start),
        clock(Math.max(p.start, p.finish)),
        p.available,
        p.needed,
        p.allocated ? clock(p.allocated.start) : '',
        p.allocated ? clock(p.allocated.end) : '',
        p.weight,
      ]),
    ),
    'text/csv;charset=utf-8',
  );
}
function exportSVG() {
  const r = result(),
    max = 1200,
    min = 480,
    width = 1100,
    rowH = 38,
    height = 100 + r.rows.length * rowH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ripple Room availability windows"><rect width="100%" height="100%" fill="#f4f1e9"/><text x="30" y="36" font-family="Arial" font-size="22" fill="#183e3b">${esc(room.title)} · ${clock(room.policy.close)} proposed closing</text><text x="30" y="58" font-family="Arial" font-size="11" fill="#68736a">${room.demo ? 'Illustrative data · ' : ''}Availability windows; capacity checked separately. ${r.metrics.reach.toFixed(1)}% modelled reach.</text>${r.rows
    .map((p, i) => {
      const y = 85 + i * rowH,
        x = 180 + clamp((p.start - min) / (max - min), 0, 1) * 850,
        w = Math.max(
          0,
          Math.min(850, ((p.finish - p.start) / (max - min)) * 850),
        );
      return `<text x="30" y="${y + 13}" fill="#183e3b" font-family="Arial" font-size="11">${esc(p.name)} / ${p.day}</text><line x1="180" x2="1030" y1="${y + 20}" y2="${y + 20}" stroke="#d8dcd0"/><rect x="${x}" y="${y}" width="${w}" height="17" rx="3" fill="${p.status === 'retained' ? '#367767' : p.status === 'unknown' ? '#a1aa99' : '#e37c62'}"/><text x="${x}" y="${y + 29}" font-family="Arial" font-size="8" fill="#68736a">${p.status === 'unknown' ? 'Unknown' : clock(p.start) + '–' + clock(Math.max(p.start, p.finish)) + ' · ' + esc(p.reason || 'Access fits')}</text>`;
    })
    .join(
      '',
    )}<text x="30" y="${height - 10}" font-family="Arial" font-size="9" fill="#68736a">Ripple Room · Designed &amp; developed by Simoné Govender · A Quantum Cupcake Creation</text></svg>`;
}
function markdownReport() {
  const r = result();
  return `# ${room.title}\n\n${summary()}\n\n## Assumptions\n\n${assumptions()
    .map((s) => '- ' + s)
    .join(
      '\n',
    )}\n\n## Group outcomes\n\n| Group | Represented visits | Served visits | Reach |\n|---|---:|---:|---:|\n${r.groups.map((g) => `| ${g.name} | ${g.total} | ${g.served} | ${g.rate.toFixed(1)}% |`).join('\n')}\n\n## Evidence\n\n${room.evidence.map((e) => `### ${e.title}\n\n${e.kind} · ${e.confidence} · ${e.date}\n\n${e.detail}\n${e.url || ''}\n`).join('\n')}\n\n## Limitations\n\nThis is a deterministic scenario model of supplied constraints, not a forecast or an eligibility decision. Weights do not create extra bookings. Results depend on sample coverage, resource-allocation order and explicit assumptions.\n\nPrepared with Ripple Room. Designed & developed by Simoné Govender. A Quantum Cupcake Creation.\n`;
}
async function shareDialog() {
  const r = result();
  const payload = {
    v: 1,
    title: room.title,
    date: new Date().toISOString(),
    demo: room.demo,
    metrics: {
      reach: r.metrics.reach,
      served: r.metrics.served,
      population: r.metrics.population,
      lost: r.metrics.lost,
      gained: r.metrics.gained,
      unknown: r.metrics.unknown,
    },
    groups: r.groups,
    open: room.policy.open,
    close: room.policy.close,
    baselineClose: room.baseline.close,
  };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const url = new URL(location.href);
  url.hash = 'snapshot=' + encoded;
  dialog(
    'Share the ripple, keep individual stories private.',
    `<div class="notice warning">This link contains aggregate results and group totals. It excludes individual profiles, notes and evidence text. In a small community, a group total may still identify someone. Review before sharing.</div><p>${esc(summary()).replaceAll('\n', '<br>')}</p><div class="field"><label for="shareLink">Aggregate snapshot link</label><input id="shareLink" readonly value="${esc(url.href)}"></div><div class="dialog-actions"><button class="btn quiet" data-action="close-dialog">Close</button><button class="btn dark" data-action="copy-link">Copy snapshot link ${icon('share')}</button></div>`,
    'A FROZEN PICTURE. A MORE INFORMED CONVERSATION.',
  );
}
function readSharedSnapshot() {
  if (!location.hash.startsWith('#snapshot=')) return;
  try {
    const raw = location.hash.slice(10);
    if (raw.length > 20000) throw Error();
    const s = validateSharedSnapshot(
      JSON.parse(decodeURIComponent(escape(atob(raw)))),
    );
    dialog(
      'A ripple someone wanted you to see.',
      `<span class="badge">SHARED AGGREGATE SNAPSHOT · ${s.demo ? 'ILLUSTRATIVE' : 'SUPPLIED DATA'}</span><h3>${esc(s.title)}</h3><p>Saved ${fmtDate(s.date)} · closing time ${clock(s.baselineClose)} → ${clock(s.close)}.</p>${stats(s.metrics)}<div class="notice">This snapshot contains no individual resident profiles. It is separate from your live workspace. Supplied values and group coverage have not been independently verified.</div>${groupChart({ groups: s.groups })}<div class="dialog-actions"><button class="btn dark" data-action="close-dialog">Explore my own room ${icon('arrow')}</button></div>`,
      'SHARED SNAPSHOT',
    );
  } catch {
    toast('This snapshot link could not be read. Your own rooms are safe.');
  }
}
function metricDialog(key) {
  const [label, unit] = metricLabels[key] || [];
  if (!label) return;
  const value = result().metrics[key];
  dialog(
    label,
    `<div class="cap-count">${metricValue(key, value)} <span style="font-size:16px">${unit === 'ZAR' || unit === 'time' ? '' : unit}</span></div><p>${esc(metricHelp[key] || `This measure is calculated from the supplied resident-day observations, the current proposal and its baseline. ${key.toLowerCase().includes('weight') ? 'Representation weights describe how many people a profile stands for.' : key.toLowerCase().includes('reach') ? 'Access means a full session fits both practical requirements and allocated resource capacity.' : key.toLowerCase().includes('cost') ? 'This is an estimate from explicitly supplied cost assumptions.' : key.toLowerCase().includes('excluded') || key.toLowerCase().includes('served') ? 'Reported visit totals use representation weights when enabled.' : key.toLowerCase().includes('profiles') ? 'Profile observations are counted separately from weighted resident visits.' : 'Unknown availability remains separate unless estimation is enabled.'}`)}</p><div class="notice">${room.policy.days.length} selected day(s) · ${room.people.length} supplied profiles · ${room.policy.weighting ? 'weighted representation' : 'unweighted observations'}. ${room.demo ? 'This room uses illustrative data.' : ''}</div><div class="dialog-actions"><button class="btn quiet" data-action="methods">Read the full method</button><button class="btn dark" data-action="close-dialog">Done</button></div>`,
    'LOOK INSIDE THE NUMBER',
  );
}
async function accountDialog(mode = 'signin') {
  try {
    const s = await cloud.session();
    cloudUser = s?.user || null;
    if (cloudUser) {
      dialog(
        'A private place for your cloud copies.',
        `<div class="notice">Signed in as <strong>${esc(cloudUser.email || 'your account')}</strong>. Device copies stay on this browser. Saving a cloud copy uploads the current room’s full contents to your private database records.</div><div class="card-grid"><div class="card"><span class="card-icon">${icon('save')}</span><h4>Save this room</h4><p>Upload an explicit private copy, with conflict protection.</p><button class="btn dark small" data-action="cloud-save">Save private cloud copy</button></div><div class="card"><span class="card-icon">${icon('grid')}</span><h4>Your cloud rooms</h4><p>Load your saved rooms on another device.</p><button class="btn quiet small" data-action="cloud-rooms">Browse private copies</button></div></div><div class="dialog-actions"><button class="btn quiet" data-action="signout">Sign out on this device</button><button class="btn dark" data-action="close-dialog">Done</button></div>`,
        'YOUR WORKSPACE, WHEREVER YOU ARE',
      );
      updateHeader();
      return;
    }
  } catch (e) {
    toast('Cloud is temporarily unavailable. Device rooms still work.');
  }
  dialog(
    mode === 'signup' ? 'A room of your own.' : 'Pick up where you left off.',
    `<div class="auth-tabs"><button data-action="auth-signin" class="${mode === 'signin' ? 'active' : ''}">Sign in</button><button data-action="auth-signup" class="${mode === 'signup' ? 'active' : ''}">Create account</button></div><form data-form="auth" data-mode="${mode}">${textInput('email', 'Email address', '', 'email', 'required autocomplete="email"')}${textInput('password', 'Password', '', 'password', `required minlength="8" maxlength="128" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"`)}<p class="muted" style="font-size:11px">${mode === 'signup' ? 'Email confirmation may be required. After confirming, return here to sign in.' : 'Sign in to save and load your own private cloud copies.'} Your device workspace works without an account.</p><div id="formError" role="alert"></div><div class="dialog-actions"><button class="btn quiet" type="button" data-action="close-dialog">Keep working on this device</button><button class="btn dark" type="submit">${mode === 'signup' ? 'Create account' : 'Sign in'} ${icon('arrow')}</button></div></form>`,
    'PRIVATE CLOUD COPIES',
  );
}
async function cloudRooms() {
  const s = await cloud.session();
  if (!s) return accountDialog();
  const list = await cloud.list();
  dialog(
    'Your private cloud rooms.',
    `<p>Loading creates a device copy. It does not overwrite your current room. Cloud saving remains an explicit action.</p>${list.length ? `<div class="card-grid">${list.map((r) => `<article class="card"><span class="overline">PRIVATE · VERSION ${r.version}</span><h4>${esc(r.title)}</h4><p>Saved ${fmtDate(r.updated_at)}</p><button class="btn quiet small" data-action="cloud-load" data-id="${r.id}">Load private copy</button></article>`).join('')}</div>` : '<div class="notice">There are no cloud copies yet. Save your first room when you’re ready.</div>'}<div class="dialog-actions"><button class="btn quiet" data-action="account">Account</button><button class="btn dark" data-action="cloud-save">Save this room</button></div>`,
    'ONLY YOUR SIGNED-IN ACCOUNT CAN READ THESE COPIES',
  );
}
const actionsList = [
  [
    'living-disappears',
    'Who disappears? Explore lost access',
    'Living laboratory',
  ],
  [
    'living-follow',
    'Follow one person through the change',
    'Living laboratory',
  ],
  ['living-multiverse', 'Explore the decision multiverse', 'Living laboratory'],
  ['living-tiny', 'Test one tiny change', 'Living laboratory'],
  [
    'living-break',
    'Break this decision with explicit disruptions',
    'Living laboratory',
  ],
  [
    'living-constellation',
    'Explore constraint constellations',
    'Living laboratory',
  ],
  ['living-replay', 'Replay captured model runs', 'Living laboratory'],

  ['new', 'Create a room', 'Workspace'],
  ['new-empty', 'Start an empty room', 'Workspace'],
  ['rooms', 'Browse device rooms', 'Workspace'],
  ['metadata', 'Rename and describe a room', 'Workspace'],
  ['duplicate-room', 'Duplicate the complete room', 'Workspace'],
  ['local-save', 'Save device workspace now', 'Workspace'],
  ['undo', 'Undo a workspace change', 'Workspace'],
  ['redo', 'Redo an undone change', 'Workspace'],
  ['reset-policy', 'Reset proposed conditions', 'Workspace'],
  ['baseline-editor', 'Edit current conditions', 'Workspace'],
  ['baseline-from-policy', 'Promote proposal to baseline', 'Workspace'],
  ['export-json', 'Export full portable backup', 'Data'],
  ['export-anonymous', 'Export anonymised backup', 'Data'],
  ['import', 'Import room JSON or resident CSV', 'Data'],
  ['csv-template', 'Download resident CSV template', 'Data'],
  ['people-export', 'Export resident constraints', 'Data'],
  ['outcomes-export', 'Export resident-day outcomes', 'Data'],
  ['metrics-export', 'Export every analytic measure', 'Data'],
  ['groups-export', 'Export group access comparison', 'Data'],
  ['bottleneck-export', 'Export first-barrier counts', 'Data'],
  ['alternative-export', 'Export alternative results', 'Data'],
  ['sensitivity-export', 'Export closing-time sensitivity', 'Data'],
  ['comparison-export', 'Export scenario comparison', 'Data'],
  ['comparison-json', 'Export scenario archive', 'Data'],
  ['evidence-export', 'Export evidence and discussion', 'Data'],
  ['policy-export', 'Export current and proposed settings', 'Data'],
  ['methods-export', 'Download calculation method', 'Data'],
  ['preferences-export', 'Export your preferences', 'Data'],
  ['capabilities-export', 'Export tool inventory', 'Data'],
  ['chart-svg', 'Export availability chart as SVG', 'Charts'],
  ['chart-png', 'Export availability chart as PNG', 'Charts'],
  ['ripple-svg', 'Export ripple relationship diagram', 'Charts'],
  ['chart-timeline', 'Explore availability timeline', 'Charts'],
  ['chart-map', 'Explore relationship ripples', 'Charts'],
  ['chart-groups', 'Explore group reach bars', 'Charts'],
  ['toggle-rows', 'Expand / collapse timeline observations', 'Charts'],
  ['add-person', 'Add anonymous resident constraints', 'Residents'],
  ['bulk-edit', 'Bulk-update matching constraints', 'Residents'],
  ['person-layout', 'Switch resident cards / table', 'Residents'],
  ['clear-filters', 'Reset resident filters', 'Residents'],
  ['filter-lost', 'Find residents losing access', 'Residents'],
  ['filter-gained', 'Find residents gaining access', 'Residents'],
  ['filter-unknown', 'Find missing availability', 'Residents'],
  ['sort-impact', 'Prioritise affected profiles', 'Residents'],
  ['snapshot', 'Capture a named scenario', 'Scenarios'],
  ['clear-scenarios', 'Remove saved snapshots', 'Scenarios'],
  ['stress-test', 'Test explicit disruptions', 'Scenarios'],
  ['add-evidence', 'Record a source or assumption', 'Evidence'],
  ['add-note', 'Record a discussion or next step', 'Evidence'],
  ['print', 'Print or save a PDF brief', 'Reports'],
  ['report-html', 'Export a standalone HTML brief', 'Reports'],
  ['report-markdown', 'Export a Markdown brief', 'Reports'],
  ['report-copy', 'Copy plain-language summary', 'Reports'],
  ['share', 'Create an aggregate snapshot link', 'Reports'],
  ['report-settings', 'Choose report sections', 'Reports'],
  ['report-defaults', 'Restore report defaults', 'Reports'],
  ['settings', 'Customise appearance and accessibility', 'Preferences'],
  ['reset-prefs', 'Restore interface defaults', 'Preferences'],
  ['account', 'Cloud account and connection', 'Cloud'],
  ['cloud-save', 'Save explicit private cloud copy', 'Cloud'],
  ['cloud-rooms', 'Browse private cloud copies', 'Cloud'],
  ['signout', 'Sign out on this device', 'Cloud'],
  ['guide', 'Read the five-step field guide', 'Help'],
  ['methods', 'Inspect calculation method', 'Help'],
  ['privacy', 'Read data and sharing practices', 'Help'],
  ['accessibility', 'Read accessibility controls', 'Help'],
  ['capabilities', 'Browse tools and analytic measures', 'Help'],
  ['install', 'Install home-screen shortcut', 'Workspace'],
];
function capabilities() {
  const list = actionsList.map(([id, label, category]) => ({
    id: 'action:' + id,
    label,
    category,
    type: 'action',
    key: id,
  }));
  for (const [key, [label, unit]] of Object.entries(metricLabels))
    list.push({
      id: 'metric:' + key,
      label,
      category: 'Analytic measures',
      type: 'metric',
      key,
    });
  for (const [key, label] of Object.entries(policyNames))
    if (!['days', 'includeUnknown', 'weighting', 'step'].includes(key))
      for (const scope of ['policy', 'baseline'])
        list.push({
          id: scope + ':' + key,
          label: (scope === 'baseline' ? 'Current: ' : 'Proposed: ') + label,
          category:
            scope === 'baseline' ? 'Baseline controls' : 'Decision controls',
          type: 'field',
          key,
          scope,
        });
  for (const [key, label] of Object.entries(prefLabels))
    list.push({
      id: 'pref:' + key,
      label,
      category: key.startsWith('report')
        ? 'Report options'
        : 'Display and accessibility',
      type: 'pref',
      key,
    });
  for (const [key, label] of Object.entries({
    theme: 'Colour atmosphere',
    accent: 'Accent palette',
    fontSize: 'Reading scale',
    density: 'Layout density',
    metricPrecision: 'Number precision',
    locale: 'Date and number convention',
    chartColor: 'Timeline colour encoding',
    chartSort: 'Timeline ordering',
    chartHeight: 'Timeline row spacing',
    reportOrientation: 'Print orientation',
  }))
    list.push({
      id: 'pref:' + key,
      label,
      category: 'Display and accessibility',
      type: 'pref',
      key,
    });
  return list;
}
function capabilitiesDialog(query = '') {
  const caps = capabilities(),
    filtered = caps.filter((c) =>
      (c.label + ' ' + c.category).toLowerCase().includes(query.toLowerCase()),
    );
  dialog(
    'A room with more than one way in.',
    `<div style="display:flex;align-items:baseline;gap:14px"><span class="cap-count">${caps.length}</span><p class="muted" style="font-size:11px">working tools, controls and analytic measures.<br>Browse an item to open its control or calculation.</p></div><input class="search-input" type="search" id="capSearch" value="${esc(query)}" placeholder="Try ‘travel’, ‘access’, ‘export’ or ‘colour’…" aria-label="Search tools and analytic measures"><div class="cap-list">${filtered.map((c) => `<div class="cap-item"><span>${esc(c.label)}<small>${esc(c.category)}</small></span><button class="text-btn" data-action="open-capability" data-id="${c.id}">Open ↗</button></div>`).join('')}</div><div class="dialog-actions"><button class="btn quiet" data-action="capabilities-export">Download inventory</button><button class="btn dark" data-action="close-dialog">Back to the room</button></div>`,
    'PURPOSEFUL CONTROLS. VISIBLE CALCULATIONS.',
  );
  $('#capSearch').focus();
  $('#capSearch').setSelectionRange(query.length, query.length);
}
async function performAction(action, d = {}) {
  switch (action) {
    case 'close-dialog':
      return closeDialog();
    case 'living-disappears':
    case 'living-follow':
    case 'living-multiverse':
    case 'living-tiny':
    case 'living-break':
    case 'living-constellation':
    case 'living-replay':
      livingLab.open(action.slice(7));
      switchView('living');
      closeDialog();
      return $('#workspace').scrollIntoView({
        behavior: prefs.motion ? 'smooth' : 'instant',
      });
    case 'lab':
      switchView('lab');
      return $('#workspace').scrollIntoView({
        behavior: prefs.motion ? 'smooth' : 'instant',
      });
    case 'jump':
      return $('#workspace').scrollIntoView({
        behavior: prefs.motion ? 'smooth' : 'instant',
      });
    case 'templates':
    case 'new':
      return newRoomDialog();
    case 'new-empty':
      return addRoom('blank');
    case 'use-template':
      return addRoom(d.id);
    case 'rooms':
      return roomsDialog();
    case 'open-room':
      return openRoom(d.id);
    case 'metadata':
      return roomMetadata();
    case 'remove-room':
      if (d.confirmed !== 'true')
        return confirmAction(
          'Remove this device room?',
          'The device copy will be removed. An exported backup or cloud copy can be loaded again.',
          'remove-room',
          d.id,
        );
      await db.remove('rooms', d.id);
      rooms = rooms.filter((r) => r.id !== d.id);
      if (room.id === d.id) {
        room = rooms[0] || createRoom('blank');
        await persist();
        history = [];
        future = [];
        view = 'lab';
        render();
      }
      return roomsDialog();
    case 'duplicate-room':
      await persist();
      room = clone(room);
      room.id = uid();
      room.title = (room.title + ' · copy').slice(0, 120);
      room.createdAt = new Date().toISOString();
      history = [];
      future = [];
      await persist();
      render();
      toast('A separate device copy is ready.');
      return closeDialog();
    case 'local-save':
      await persist();
      return toast('Saved on this device.');
    case 'undo':
      if (history.length) {
        future.push(clone(room));
        room = history.pop();
        saveSoon();
        render();
        toast('Previous change restored.');
      }
      return;
    case 'redo':
      if (future.length) {
        history.push(clone(room));
        room = future.pop();
        saveSoon();
        render();
        toast('Change reapplied.');
      }
      return;
    case 'reset-policy':
      mutate(() => (room.policy = clone(room.baseline)));
      return toast('Proposed settings match the current situation.');
    case 'baseline-editor':
      return baselineEditor();
    case 'baseline-from-policy':
      mutate(() => (room.baseline = clone(room.policy)));
      closeDialog();
      return toast('Current proposal is now the baseline.');
    case 'chart':
      chartMode = d.mode;
      render();
      return;
    case 'chart-timeline':
    case 'chart-map':
    case 'chart-groups':
      chartMode = action.split('-')[1] === 'map' ? 'map' : action.split('-')[1];
      switchView('lab');
      return closeDialog();
    case 'toggle-rows':
      showAllRows = !showAllRows;
      render();
      return;
    case 'day':
      if (room.policy.days.includes(d.day) && room.policy.days.length === 1)
        return toast('Keep at least one day in the model.');
      mutate(() => {
        room.policy.days = room.policy.days.includes(d.day)
          ? room.policy.days.filter((x) => x !== d.day)
          : DAYS.filter((x) => room.policy.days.includes(x) || x === d.day);
      });
      return;
    case 'add-person':
      return personForm();
    case 'edit-person':
      return personForm(d.id);
    case 'inspect-person':
      return inspectPerson(d.id);
    case 'duplicate-person': {
      const p = room.people.find((p) => p.id === d.id);
      if (!p) return;
      const id = uid();
      mutate(() =>
        room.people.push({
          ...clone(p),
          id,
          name: (p.name + ' · copy').slice(0, 50),
        }),
      );
      return personForm(id);
    }
    case 'delete-person':
      if (d.confirmed !== 'true')
        return confirmAction(
          'Remove this resident profile?',
          'This removes its constraints from the device model. Undo can restore it.',
          'delete-person',
          d.id,
        );
      mutate(() => (room.people = room.people.filter((p) => p.id !== d.id)));
      closeDialog();
      return toast('Profile removed. Undo is available.');
    case 'bulk-edit':
      return bulkDialog();
    case 'person-layout':
      personLayout = personLayout === 'cards' ? 'table' : 'cards';
      return render();
    case 'clear-filters':
      filters = {
        search: '',
        group: 'all',
        status: 'all',
        sort: 'name',
        day: 'all',
      };
      prefs.metricSearch = '';
      return render();
    case 'filter-lost':
    case 'filter-gained':
    case 'filter-unknown':
      switchView('people');
      filters.status = action.split('-')[1];
      render();
      return closeDialog();
    case 'sort-impact':
      switchView('people');
      filters.sort = 'impact';
      render();
      return closeDialog();
    case 'snapshot':
      return snapshotDialog();
    case 'rename-scenario':
      return snapshotDialog(d.id);
    case 'restore-scenario': {
      const s = room.scenarios.find((s) => s.id === d.id);
      if (!s) return;
      mutate(() => {
        room.policy = clone(s.policy);
        room.baseline = clone(s.baseline);
        room.people = clone(s.people);
      });
      view = 'lab';
      render();
      return toast('Captured cohort and conditions restored.');
    }
    case 'delete-scenario':
      if (d.confirmed !== 'true')
        return confirmAction(
          'Remove this saved possibility?',
          'The snapshot will leave this device room. Undo can restore it.',
          'delete-scenario',
          d.id,
        );
      mutate(
        () => (room.scenarios = room.scenarios.filter((s) => s.id !== d.id)),
      );
      closeDialog();
      return;
    case 'clear-scenarios':
      if (d.confirmed !== 'true')
        return confirmAction(
          'Clear the saved snapshots?',
          'The live proposal stays in the room. Undo can restore the snapshots.',
          'clear-scenarios',
        );
      mutate(() => (room.scenarios = []));
      closeDialog();
      return;
    case 'apply-alternative': {
      const a = alternatives(room.people, room.baseline, room.policy)[
        Number(d.index)
      ];
      if (!a) return;
      mutate(() => Object.assign(room.policy, a.patch));
      switchView('lab');
      return toast(a.title + ' applied. Undo is available.');
    }
    case 'stress-test':
      return stressDialog();
    case 'stress-apply':
      mutate(
        () =>
          (room.policy[d.key] = d.value === 'false' ? false : Number(d.value)),
      );
      closeDialog();
      switchView('lab');
      return;
    case 'sweep-time':
      mutate(() => (room.policy.close = Number(d.time)));
      switchView('lab');
      return;
    case 'add-evidence':
      return evidenceForm();
    case 'edit-evidence':
      return evidenceForm(d.id);
    case 'add-note':
      return noteForm();
    case 'edit-note':
      return noteForm(d.id);
    case 'delete-evidence':
    case 'delete-note':
      if (d.confirmed !== 'true')
        return confirmAction(
          'Remove this contribution?',
          'It will be removed from this device room. Undo can restore it.',
          action,
          d.id,
        );
      mutate(() => {
        const key = action === 'delete-evidence' ? 'evidence' : 'notes';
        room[key] = room[key].filter((e) => e.id !== d.id);
      });
      closeDialog();
      return;
    case 'settings':
    case 'accessibility':
      return settingsDialog();
    case 'report-settings':
      return settingsDialog('report');
    case 'reset-prefs':
      prefs = { ...defaultPrefs };
      await db.put('settings', { id: 'prefs', value: prefs });
      applyPrefs();
      render();
      return settingsDialog();
    case 'report-defaults':
      Object.keys(prefs)
        .filter((k) => k.startsWith('report'))
        .forEach((k) => (prefs[k] = defaultPrefs[k]));
      await db.put('settings', { id: 'prefs', value: prefs });
      render();
      return settingsDialog('report');
    case 'guide':
      return guideDialog();
    case 'methods':
    case 'policy-help':
      return methodsDialog();
    case 'privacy':
      return privacyDialog();
    case 'metric-detail':
      return metricDialog(d.key);
    case 'command':
    case 'capabilities':
      return capabilitiesDialog();
    case 'open-capability': {
      const c = capabilities().find((c) => c.id === d.id);
      if (!c) return;
      if (c.type === 'metric') return metricDialog(c.key);
      if (c.type === 'pref')
        return settingsDialog(c.key.startsWith('report') ? 'report' : 'all');
      if (c.type === 'field') {
        if (c.scope === 'baseline') return baselineEditor();
        closeDialog();
        switchView('lab');
        const el = [
          ...document.querySelectorAll(`[data-policy="${c.key}"]`),
        ].at(-1);
        if (el) {
          for (const det of [el.closest('details')].filter(Boolean))
            det.open = true;
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      return performAction(c.key);
    }
    case 'room-menu':
      return dialog(
        'A little housekeeping.',
        `<div class="card-grid">${[
          ['metadata', 'Room name & context', 'settings'],
          ['duplicate-room', 'Duplicate room', 'plus'],
          ['local-save', 'Save device copy', 'save'],
          ['export-json', 'Full JSON backup', 'download'],
          ['import', 'Import a backup or CSV', 'book'],
          ['outcomes-export', 'Export model outcomes', 'chart'],
          ['chart-svg', 'Download chart SVG', 'chart'],
          ['chart-png', 'Download chart PNG', 'chart'],
          ['ripple-svg', 'Download ripple diagram', 'chart'],
          ['policy-export', 'Export settings', 'settings'],
          ['preferences-export', 'Export preferences', 'settings'],
          ['cloud-save', 'Save private cloud copy', 'save'],
          ['share', 'Aggregate snapshot link', 'share'],
          ['install', 'Install home-screen shortcut', 'plus'],
        ]
          .map(
            ([a, t, i]) =>
              `<button class="btn quiet" data-action="${a}">${icon(i)}${t}</button>`,
          )
          .join('')}</div>`,
        'THE ROOM TOOLBOX',
      );
    case 'account':
      return accountDialog();
    case 'auth-signin':
      return accountDialog('signin');
    case 'auth-signup':
      return accountDialog('signup');
    case 'cloud-rooms':
      return cloudRooms();
    case 'cloud-save': {
      if (!(await cloud.session())) return accountDialog();
      const version = await cloud.save(clone(room), cloudVersion[room.id]);
      cloudVersion[room.id] = version;
      await db.put('settings', { id: 'cloud-versions', value: cloudVersion });
      toast('Private cloud copy saved · version ' + version);
      return accountDialog();
    }
    case 'cloud-load': {
      const data = await cloud.load(d.id);
      const incoming = validateWorkspace(data.data);
      await persist();
      const existing = rooms.find((r) => r.id === incoming.id);
      if (existing && existing.updatedAt > data.updated_at) {
        incoming.id = uid();
        incoming.title = (incoming.title + ' · cloud copy').slice(0, 120);
        toast('Your newer device room was kept. Loaded a separate cloud copy.');
      } else cloudVersion[incoming.id] = data.version;
      room = incoming;
      history = [];
      future = [];
      await persist();
      await db.put('settings', { id: 'cloud-versions', value: cloudVersion });
      view = 'lab';
      render();
      return closeDialog();
    }
    case 'signout':
      await cloud.signOut();
      cloudUser = null;
      updateHeader();
      toast('Signed out. Device rooms remain on this browser.');
      return closeDialog();
    case 'import':
      $('#importFile').value = '';
      $('#importFile').click();
      return;
    case 'csv-template':
      return download(
        'ripple-room-resident-template.csv',
        csv(
          [
            'name',
            'group',
            'arrive',
            'leaveBy',
            'duration',
            'travelIn',
            'travelOut',
            'weight',
            'priority',
            'days',
            'transit',
            'computer',
            'wifi',
            'access',
            'child',
            'quiet',
            'source',
            'note',
          ],
          [
            [
              'Example alias',
              'Learners',
              '15:00',
              '18:00',
              45,
              10,
              15,
              1,
              0,
              'Mon|Wed',
              true,
              true,
              true,
              false,
              false,
              false,
              'Your source',
              'Practical context only',
            ],
          ],
        ),
        'text/csv;charset=utf-8',
      );
    case 'export-json':
      return download(
        slug() + '-room.json',
        JSON.stringify({ format: 'ripple-room', version: 1, room }, null, 2),
      );
    case 'export-anonymous': {
      const copy = clone(room);
      copy.people = copy.people.map((p, i) => ({
        ...p,
        id: uid(),
        name: 'Resident ' + String(i + 1).padStart(3, '0'),
        note: '',
        source: '',
      }));
      copy.notes = [];
      copy.evidence = [];
      copy.scenarios = [];
      copy.location = '';
      copy.id = uid();
      return download(
        slug() + '-anonymised.json',
        JSON.stringify(
          { format: 'ripple-room', version: 1, room: copy },
          null,
          2,
        ),
      );
    }
    case 'people-export':
      return exportPeople();
    case 'outcomes-export':
      return exportOutcomes();
    case 'metrics-export':
      return download(
        slug() + '-measures.csv',
        csv(
          ['measure', 'value', 'unit'],
          Object.entries(metricLabels).map(([k, [l, u]]) => [
            l,
            result().metrics[k],
            u,
          ]),
        ),
        'text/csv;charset=utf-8',
      );
    case 'groups-export':
      return download(
        slug() + '-groups.csv',
        csv(
          [
            'group',
            'visits',
            'served',
            'proposed_reach_percent',
            'current_reach_percent',
            'lost',
            'gained',
          ],
          result().groups.map((g) => [
            g.name,
            g.total,
            g.served,
            g.rate,
            g.baseline,
            g.lost,
            g.gained,
          ]),
        ),
        'text/csv;charset=utf-8',
      );
    case 'bottleneck-export':
      return download(
        slug() + '-barriers.csv',
        csv(['first_barrier', 'represented_visits'], result().reasons),
        'text/csv;charset=utf-8',
      );
    case 'alternative-export':
      return download(
        slug() + '-alternatives.csv',
        csv(
          [
            'option',
            'reach_percent',
            'lost',
            'gained',
            'estimated_operating_cost',
            'settings',
          ],
          alternatives(room.people, room.baseline, room.policy).map((a) => [
            a.title,
            a.reach,
            a.lost,
            a.gained,
            a.operatingCost,
            JSON.stringify(a.patch),
          ]),
        ),
        'text/csv;charset=utf-8',
      );
    case 'sensitivity-export':
      return download(
        slug() + '-closing-time-sweep.csv',
        csv(
          [
            'closing_time',
            'reach_percent',
            'served',
            'lost',
            'gained',
            'operating_cost',
          ],
          sweep().map((s) => [
            clock(s.close),
            s.reach,
            s.served,
            s.lost,
            s.gained,
            s.operatingCost,
          ]),
        ),
        'text/csv;charset=utf-8',
      );
    case 'comparison-export': {
      const list = [
        { title: 'Live proposal', metrics: result().metrics },
        ...room.scenarios,
      ];
      return download(
        slug() + '-scenario-comparison.csv',
        csv(
          ['measure', ...list.map((s) => s.title)],
          Object.entries(metricLabels).map(([k, [l]]) => [
            l,
            ...list.map((s) => s.metrics[k]),
          ]),
        ),
        'text/csv;charset=utf-8',
      );
    }
    case 'comparison-json':
      return download(
        slug() + '-scenario-archive.json',
        JSON.stringify(room.scenarios, null, 2),
      );
    case 'evidence-export':
      return download(
        slug() + '-evidence-and-discussion.json',
        JSON.stringify({ evidence: room.evidence, notes: room.notes }, null, 2),
      );
    case 'policy-export':
      return download(
        slug() + '-conditions.json',
        JSON.stringify(
          { baseline: room.baseline, proposed: room.policy },
          null,
          2,
        ),
      );
    case 'preferences-export':
      return download(
        'ripple-room-preferences.json',
        JSON.stringify(prefs, null, 2),
      );
    case 'capabilities-export':
      return download(
        'ripple-room-capabilities.csv',
        csv(
          ['id', 'capability', 'category'],
          capabilities().map((c) => [c.id, c.label, c.category]),
        ),
        'text/csv;charset=utf-8',
      );
    case 'methods-export':
      return download(
        'ripple-room-method.txt',
        'RIPPLE ROOM / METHOD NOTES\n\n' +
          assumptions().join('\n\n') +
          '\n\n' +
          $('#dialogBody').innerText,
        'text/plain;charset=utf-8',
      );
    case 'chart-svg':
      return download(
        slug() + '-availability.svg',
        exportSVG(),
        'image/svg+xml',
      );
    case 'ripple-svg': {
      const svg = rippleMap(result())
        .match(/<svg[\s\S]*<\/svg>/)[0]
        .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
        .replaceAll('var(--ink)', '#183e3b')
        .replaceAll('var(--paper)', '#f4f1e9')
        .replaceAll('var(--panel)', '#fffdf8')
        .replaceAll('var(--soft)', '#e9ede1')
        .replaceAll('var(--line)', '#d8dcd0')
        .replaceAll('var(--good)', '#367767')
        .replaceAll('var(--accent)', '#e37c62')
        .replaceAll('class="dot-retained"', 'fill="#367767"')
        .replaceAll('class="dot-excluded"', 'fill="#e37c62"')
        .replaceAll('class="dot-unknown"', 'fill="#a5aa9a"')
        .replaceAll(
          'class="map-label"',
          'fill="#183e3b" stroke="none" font-size="10"',
        )
        .replaceAll(
          'class="map-caption"',
          'fill="#68736a" stroke="none" font-size="8"',
        );
      return download(slug() + '-relationship-map.svg', svg, 'image/svg+xml');
    }
    case 'chart-png': {
      const image = new Image(),
        blob = new Blob([exportSVG()], { type: 'image/svg+xml' }),
        url = URL.createObjectURL(blob);
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        canvas.toBlob((b) => {
          if (b) {
            const u = URL.createObjectURL(b),
              a = document.createElement('a');
            a.href = u;
            a.download = slug() + '-availability.png';
            a.click();
            setTimeout(() => URL.revokeObjectURL(u), 1000);
          }
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        toast('The image could not be exported. SVG export is available.');
      };
      image.src = url;
      return;
    }
    case 'print':
      view = 'report';
      render();
      let printStyle = $('#printOrientation');
      if (!printStyle) {
        printStyle = document.createElement('style');
        printStyle.id = 'printOrientation';
        document.head.appendChild(printStyle);
      }
      printStyle.textContent = `@page{size:A4 ${prefs.reportOrientation};margin:16mm}`;
      setTimeout(() => window.print(), 100);
      return;
    case 'report-html':
      return download(
        slug() + '-decision-brief.html',
        `<!doctype html><html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(room.title)} — Decision brief</title><style>body{font-family:Arial,sans-serif;background:#f1eee6;color:#24241f;line-height:1.7;max-width:950px;margin:40px auto;padding:25px}h2{font-size:36px}h3{margin-top:30px}p,li{font-size:14px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:10px;border:1px solid #c7d0bd;text-align:left}.stat-strip{display:flex;gap:15px;flex-wrap:wrap}.stat-card{padding:15px;border:1px solid #b6c3ae;flex:1}.stat-card strong{font-size:30px;display:block}.stat-card small{font-size:11px;display:block}.stat-label{font-size:12px}.notice,.report-summary{padding:20px;background:#e7e3d8}.group-row{padding:10px;border-bottom:1px solid #c7d0bd;display:flex;justify-content:space-between}.group-label{display:block;font-size:10px}.group-bar{display:none}.report-kicker,.report-footer{font-size:10px}.report-kicker{display:flex;justify-content:space-between}.report-footer{border-top:1px solid #c7d0bd;margin-top:30px;padding-top:15px}button{display:none}@media print{body{background:white;margin:0;padding:0}}</style>${reportMarkup()}</html>`,
        'text/html;charset=utf-8',
      );
    case 'report-markdown':
      return download(
        slug() + '-decision-brief.md',
        markdownReport(),
        'text/markdown;charset=utf-8',
      );
    case 'report-copy':
      return copyText(summary());
    case 'share':
      return shareDialog();
    case 'copy-link':
      return copyText($('#shareLink').value);
    case 'install':
      if (installPrompt) {
        await installPrompt.prompt();
        installPrompt = null;
      } else
        dialog(
          'Keep a little foresight close.',
          `<p>Use your browser’s “Install app” or “Add to Home Screen” option. On iPhone, open this site in Safari, choose Share, then Add to Home Screen. Saved device rooms remain in the browser where you created them.</p><div class="dialog-actions"><button class="btn dark" data-action="close-dialog">Done</button></div>`,
          'RIPPLE ROOM, ONE TAP AWAY',
        );
      return;
    default:
      return;
  }
}
let installPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});
document.addEventListener('click', (e) => {
  if (livingLab.click(e.target)) return;
  const v = e.target.closest('[data-view]');
  if (v) {
    switchView(v.dataset.view);
    return;
  }
  const a = e.target.closest('[data-action]');
  if (a && !a.disabled)
    Promise.resolve(performAction(a.dataset.action, a.dataset)).catch(
      reportError,
    );
});
document.addEventListener('keydown', (e) => {
  if (
    e.target.matches('[role=button][data-living]') &&
    (e.key === 'Enter' || e.key === ' ')
  ) {
    e.preventDefault();
    livingLab.click(e.target);
    return;
  }
  if (
    e.target.matches('[role=button][data-action]') &&
    (e.key === 'Enter' || e.key === ' ')
  ) {
    e.preventDefault();
    performAction(e.target.dataset.action, e.target.dataset).catch(reportError);
    return;
  }
  if (
    !prefs.keyboard ||
    e.target.matches('input,textarea,select,[contenteditable]')
  )
    return;
  if (e.altKey && /^[1-7]$/.test(e.key)) {
    e.preventDefault();
    switchView(
      [
        'lab',
        'people',
        'alternatives',
        'scenarios',
        'evidence',
        'insights',
        'report',
      ][Number(e.key) - 1],
    );
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    performAction('local-save');
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    performAction(e.shiftKey ? 'redo' : 'undo');
    return;
  }
  if (!$('#dialog').open && (e.key === '/' || e.key === '?')) {
    e.preventDefault();
    if (e.key === '/') capabilitiesDialog();
    else guideDialog();
  }
});
document.addEventListener('pointerdown', (e) => {
  if (e.target.matches('input[type=range][data-policy]')) {
    record();
    dragStarted = true;
  }
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'capSearch') {
    const value = t.value;
    const caps = capabilities().filter((c) =>
      (c.label + ' ' + c.category).toLowerCase().includes(value.toLowerCase()),
    );
    $('.cap-list').innerHTML = caps
      .map(
        (c) =>
          `<div class="cap-item"><span>${esc(c.label)}<small>${esc(c.category)}</small></span><button class="text-btn" data-action="open-capability" data-id="${c.id}">Open ↗</button></div>`,
      )
      .join('');
    return;
  }
  if (t.type === 'range' && t.dataset.policy) {
    if (!dragStarted) {
      record();
      dragStarted = true;
    }
    room.policy[t.dataset.policy] = Number(t.value);
    saveSoon();
    if ($('#closingValue'))
      $('#closingValue').textContent = clock(room.policy.close);
    if ($('#closingDelta')) {
      const delta = room.policy.close - room.baseline.close;
      $('#closingDelta').textContent =
        delta === 0
          ? 'Current time'
          : Math.abs(delta) + 'm ' + (delta < 0 ? 'earlier' : 'later');
    }
    if ($('#labMain')) $('#labMain').innerHTML = labMain();
    if ($('#closingInput')) $('#closingInput').value = room.policy.close;
    updateHero();
    if (view !== 'lab') render();
    return;
  }
  if (t.dataset.filter === 'search' || t.dataset.filter === 'metricSearch') {
    const pos = t.selectionStart;
    const selector = `[data-filter="${t.dataset.filter}"]`;
    if (t.dataset.filter === 'metricSearch') prefs.metricSearch = t.value;
    else filters.search = t.value;
    render();
    const replacement = $(selector);
    replacement?.focus();
    replacement?.setSelectionRange(pos, pos);
  }
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (livingLab.change(t)) return;
  try {
    if (t.dataset.policy || t.dataset.baseline) {
      if (t.type === 'range') {
        dragStarted = false;
        return;
      }
      const scope = t.dataset.baseline ? 'baseline' : 'policy',
        key = t.dataset[scope];
      let value =
        t.type === 'checkbox'
          ? t.checked
          : t.type === 'time'
            ? minutes(t.value)
            : ['priority'].includes(key)
              ? t.value
              : Number(t.value);
      if (typeof value === 'number' && !Number.isFinite(value))
        throw Error('Supply a valid number or time.');
      const candidate = { ...room[scope], [key]: value };
      if (candidate.open >= candidate.close) {
        t.value =
          t.type === 'time' ? clock(room[scope][key]) : room[scope][key];
        throw Error('Opening must be earlier than closing.');
      }
      if (
        t.type === 'number' &&
        (value < Number(t.min) || value > Number(t.max))
      ) {
        t.value = room[scope][key];
        throw Error(`Keep this value between ${t.min} and ${t.max}.`);
      }
      mutate(() => (room[scope][key] = value));
      return;
    }
    if (t.dataset.pref) {
      const key = t.dataset.pref;
      prefs[key] =
        t.type === 'checkbox'
          ? t.checked
          : ['fontSize', 'metricPrecision', 'chartHeight'].includes(key)
            ? Number(t.value)
            : t.value;
      await db.put('settings', { id: 'prefs', value: prefs });
      applyPrefs();
      render();
      return;
    }
    if (t.dataset.filter) {
      filters[t.dataset.filter] = t.value;
      render();
      return;
    }
    if (t.id === 'importFile' && t.files[0]) {
      await importFile(t.files[0]);
      return;
    }
  } catch (e) {
    reportError(e);
  }
});
document.addEventListener('submit', async (e) => {
  const form = e.target;
  if (!form.dataset.form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const errorBox = form.querySelector('#formError');
  const submit = form.querySelector('[type=submit]');
  if (submit) submit.disabled = true;
  try {
    switch (form.dataset.form) {
      case 'person': {
        if (!form.dataset.id && room.people.length >= 1000)
          throw Error('A room holds at most 1,000 profiles.');
        const p = validatePerson({
          id: form.dataset.id || uid(),
          ...Object.fromEntries(fd),
          arrive: fd.get('arrive') || null,
          leaveBy: fd.get('leaveBy') || null,
          duration: fd.get('duration') || null,
          days: fd.getAll('days'),
          ...Object.fromEntries(
            ['transit', 'computer', 'wifi', 'access', 'child', 'quiet'].map(
              (k) => [k, fd.has(k)],
            ),
          ),
        });
        mutate(() => {
          const i = room.people.findIndex((x) => x.id === p.id);
          if (i >= 0) room.people[i] = p;
          else room.people.push(p);
        });
        closeDialog();
        toast('Resident constraints saved.');
        break;
      }
      case 'metadata':
        mutate(() => {
          room.title = String(fd.get('title')).trim() || 'Untitled room';
          room.location = String(fd.get('location'));
          room.description = String(fd.get('description'));
          room.demo = fd.has('demo');
        });
        closeDialog();
        break;
      case 'snapshot': {
        const title = String(fd.get('title')).trim();
        if (!title) throw Error('Give the scenario a name.');
        if (form.dataset.id)
          mutate(
            () =>
              (room.scenarios.find((s) => s.id === form.dataset.id).title =
                title),
          );
        else {
          if (room.scenarios.length >= 30)
            throw Error(
              'This room holds 30 snapshots. Export or remove an older snapshot first.',
            );
          const r = result();
          mutate(() =>
            room.scenarios.push({
              id: uid(),
              title,
              createdAt: new Date().toISOString(),
              policy: clone(room.policy),
              baseline: clone(room.baseline),
              people: clone(room.people),
              metrics: clone(r.metrics),
              groups: clone(r.groups),
            }),
          );
        }
        closeDialog();
        toast('Scenario saved on this device.');
        break;
      }
      case 'evidence': {
        const x = { id: form.dataset.id || uid(), ...Object.fromEntries(fd) };
        if (x.url && !safeURL(x.url))
          throw Error('Use a complete http or https source link.');
        mutate(() => {
          const i = room.evidence.findIndex((e) => e.id === x.id);
          if (i >= 0) room.evidence[i] = x;
          else room.evidence.push(x);
        });
        closeDialog();
        break;
      }
      case 'note': {
        const x = {
          id: form.dataset.id || uid(),
          ...Object.fromEntries(fd),
          createdAt: new Date().toISOString(),
        };
        mutate(() => {
          const i = room.notes.findIndex((e) => e.id === x.id);
          if (i >= 0) {
            x.createdAt = room.notes[i].createdAt;
            room.notes[i] = x;
          } else room.notes.unshift(x);
        });
        closeDialog();
        break;
      }
      case 'bulk': {
        const key = String(fd.get('operation')),
          value = Number(fd.get('value')),
          g = fd.get('group'),
          boolean = [
            'transit',
            'computer',
            'wifi',
            'access',
            'child',
            'quiet',
          ].includes(key);
        if (boolean && ![0, 1].includes(value))
          throw Error('Use 0 for no or 1 for yes.');
        if (key === 'priority' && (value < 0 || value > 2))
          throw Error('Priority must be 0–2.');
        const updated = room.people.map((p) =>
          g === 'all' || p.group === g
            ? validatePerson({ ...p, [key]: boolean ? !!value : value })
            : p,
        );
        mutate(() => (room.people = updated));
        closeDialog();
        toast('Matching profiles updated.');
        break;
      }
      case 'auth': {
        const email = String(fd.get('email')),
          password = String(fd.get('password'));
        const data = await (form.dataset.mode === 'signup'
          ? cloud.signUp(email, password)
          : cloud.signIn(email, password));
        form.reset();
        if (data.session) {
          cloudUser = data.user;
          updateHeader();
          return accountDialog();
        }
        dialog(
          'Check your inbox to finish.',
          `<p>Confirm the email from the authentication service, then return to Ripple Room and sign in. Your device rooms remain here.</p><div class="dialog-actions"><button class="btn dark" data-action="auth-signin">Return to sign in</button></div>`,
        );
        break;
      }
    }
  } catch (error) {
    if (errorBox) {
      errorBox.className = 'form-error';
      errorBox.textContent = error.message;
    } else reportError(error);
  } finally {
    if (submit) submit.disabled = false;
  }
});
async function importFile(file) {
  if (file.size > 2000000) throw Error('Keep imports below 2 MB.');
  const text = await file.text();
  if (file.name.toLowerCase().endsWith('.csv')) {
    const raw = parseCSV(text);
    if (raw.length > 1000) throw Error('Import at most 1,000 profiles.');
    const truth = (v) => ['true', 'yes', '1'].includes(String(v).toLowerCase());
    const people = raw.map((p) =>
      validatePerson({
        ...p,
        id: uid(),
        arrive: p.arrive || null,
        leaveBy: p.leaveBy || null,
        duration: p.duration || null,
        days: p.days ? p.days.split(/[|;]/).map((s) => s.trim()) : ['Mon'],
        ...Object.fromEntries(
          ['transit', 'computer', 'wifi', 'access', 'child', 'quiet'].map(
            (k) => [k, truth(p[k])],
          ),
        ),
      }),
    );
    if (room.people.length + people.length > 1000)
      throw Error('A room holds at most 1,000 profiles.');
    mutate(() => room.people.push(...people));
    closeDialog();
    switchView('people');
    toast(people.length + ' profiles imported.');
    return;
  }
  const raw = JSON.parse(text);
  const incoming = validateWorkspace(raw.room || raw);
  incoming.id = uid();
  incoming.title = (incoming.title + ' · imported').slice(0, 120);
  await persist();
  room = incoming;
  history = [];
  future = [];
  await persist();
  view = 'lab';
  closeDialog();
  render();
  toast('Imported as a separate room. Your previous room is safe.');
}
async function init() {
  try {
    await db.openDB();
    const savedPrefs = await db.get('settings', 'prefs');
    prefs = { ...defaultPrefs, ...savedPrefs?.value };
    cloudVersion = (await db.get('settings', 'cloud-versions'))?.value || {};
    rooms = (await db.all('rooms')).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const active = (await db.get('settings', 'active'))?.value;
    const stored = rooms.find((r) => r.id === active) || rooms[0];
    room = stored ? validateWorkspace(stored) : createRoom('library');
    if (!stored) await persist();
    render();
    try {
      cloudUser = (await cloud.session())?.user || null;
      updateHeader();
    } catch {}
    readSharedSnapshot();
    if ('serviceWorker' in navigator && location.protocol === 'https:')
      navigator.serviceWorker.register('./sw.js').catch(() => {});
  } catch (e) {
    room = createRoom();
    render();
    toast(
      'Device storage is unavailable. Export a JSON backup before closing this page.',
    );
  }
}
window.addEventListener('hashchange', readSharedSnapshot);
window.addEventListener('beforeunload', (e) => {
  if (!prefs.autoSave && $('#saveStatus')?.textContent === 'Unsaved changes') {
    e.preventDefault();
    e.returnValue = '';
  }
});
window.addEventListener('online', () =>
  toast('You’re connected. Private cloud copies are available after sign-in.'),
);
window.addEventListener('offline', () =>
  toast('Working offline. Your device room is still available.'),
);
init();
