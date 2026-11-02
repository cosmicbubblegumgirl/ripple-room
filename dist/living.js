import { analyse, clock } from './engine.js';
import {
  multiverse,
  tinyChanges,
  stressCases,
  replayFrames,
  frameResult,
  storyFor,
  closingEdges,
} from './living-engine.js';
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const n = (v) =>
  new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 1 }).format(
    Number.isFinite(v) ? v : 0,
  );
const modes = [
  ['disappears', '01', 'Who disappears?', 'Find the lives hidden by a total.'],
  ['follow', '02', 'Follow one person', 'Read the same day twice.'],
  ['multiverse', '03', 'Decision multiverse', 'Try a different branch.'],
  ['tiny', '04', 'One tiny change', 'Look for a smaller intervention.'],
  ['break', '05', 'Break this decision', 'Find where the proposal gives way.'],
  [
    'constellation',
    '06',
    'Constraint constellations',
    'See the shape of a time squeeze.',
  ],
  ['replay', '07', 'Ripple Replay', 'Revisit a captured model run.'],
];
const button = (action, text, extra = '') =>
  `<button class="btn quiet" data-living="${action}" ${extra}>${text}</button>`;
const slot = (r) =>
  r.allocated
    ? `${clock(r.allocated.start)}—${clock(r.allocated.end)}`
    : r.status === 'unknown'
      ? 'NOT KNOWN'
      : 'NO SESSION';
export function createLivingLab({
  getRoom,
  onRender,
  onApply,
  onInspect,
  onCapture,
  onDownload,
  canUndo = () => false,
}) {
  const state = {
    mode: 'disappears',
    person: '',
    day: '',
    filter: 'lost',
    replay: 0,
    roomId: '',
    choices: [],
  };
  let r;
  const refresh = (focus) => {
    onRender();
    if (focus)
      document.querySelector(`[data-living-focus="${focus}"]`)?.focus();
  };
  function open(mode = 'disappears') {
    state.mode = modes.some((m) => m[0] === mode) ? mode : 'disappears';
  }
  function peoplePicker(room, rows) {
    const ids = [...new Map(rows.map((p) => [p.id, p])).values()];
    if (!ids.some((p) => p.id === state.person))
      state.person =
        rows.find((p) => p.change === 'lost')?.id || ids[0]?.id || '';
    const days = rows.filter((p) => p.id === state.person).map((p) => p.day);
    if (!days.includes(state.day)) state.day = days[0] || '';
    return `<div class="living-pickers"><label>Follow a resident<select data-living-change="person" data-living-focus="person">${ids.map((p) => `<option value="${esc(p.id)}" ${state.person === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(p.group)}</option>`).join('')}</select></label><label>Modelled day<select data-living-change="day" data-living-focus="day">${days.map((d) => `<option ${state.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label></div>`;
  }
  function disappeared(room) {
    const selected = r.rows.filter((p) => p.change === state.filter);
    const total = selected.reduce((v, p) => v + p.weight, 0);
    return `<div class="living-chapter"><span class="living-kicker">THE EMPTY SPACE IS THE FINDING</span><h3>Who is missing<br>from the room?</h3><p>Changing one condition can erase a whole visit. Start with the individual constraints, then read the totals.</p></div><div class="living-filter" aria-label="Outcome lens">${[
      ['lost', 'Newly losing access'],
      ['excluded', 'Already excluded'],
      ['unknown', 'Still unknown'],
      ['gained', 'Newly gaining access'],
    ]
      .map(
        ([v, t]) =>
          `<button data-living="filter" data-value="${v}" data-living-focus="filter-${v}" aria-pressed="${state.filter === v}">${t}</button>`,
      )
      .join(
        '',
      )}</div><div class="absence-count"><strong>${n(total)}</strong><span>${room.policy.weighting ? 'weighted' : 'unweighted'} visits<br>across ${selected.length} resident-day observations</span><i aria-hidden="true">↘</i></div><div class="absence-register">${selected.map((p, i) => `<button class="absence-row" data-living="person" data-id="${esc(p.id)}" data-day="${p.day}"><span class="absence-serial">${String(i + 1).padStart(2, '0')}</span><span><b>${esc(p.name)}</b><small>${esc(p.group)} · ${p.day}</small></span><span class="absence-reason">${esc(p.reason || 'A complete session now fits')}</span><span class="absence-window">${slot(p.before)}<br><b>${slot(p)}</b></span><span aria-hidden="true">↗</span></button>`).join('') || '<div class="living-empty">No observations in this lens. That is a model result, not evidence that every community need has been represented.</div>'}</div>`;
  }
  function follow(room) {
    const picker = peoplePicker(room, r.rows),
      p = r.rows.find((p) => p.id === state.person && p.day === state.day);
    if (!p)
      return `<div class="living-empty">Add resident constraints to follow a day through the model.</div>`;
    const story = storyFor(p);
    const points = [
      ['Available from', p.arrive],
      ['Travel to the room', p.travelIn || 0],
      ['Required session', p.needed],
      ['Travel home', p.travelOut || 0],
      ['Supplied deadline', p.leaveBy],
    ];
    return `${picker}<div class="living-chapter"><span class="living-kicker">SAME PERSON. TWO VERSIONS OF THE DAY.</span><h3>${esc(p.name)}’s<br>${{ Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }[p.day]} ripple.</h3><p>${esc(p.group)} · One supplied profile, representing ${n(p.weight)} ${p.weight === 1 ? 'visit' : 'visits'} on this day.</p></div><div class="day-ribbon">${points.map(([label, val], i) => `<div><span>${String(i + 1).padStart(2, '0')} / ${label}</span><strong>${val === null || val === undefined ? 'Unknown' : i === 0 || i === 4 ? clock(val) : n(val) + 'm'}</strong></div>`).join('')}</div><div class="story-spread"><article><span class="living-kicker">CURRENT SITUATION / ${clock(room.baseline.close)}</span><h4>${p.before.status === 'retained' ? 'There is room.' : p.before.status === 'unknown' ? 'We do not know yet.' : 'A barrier already exists.'}</h4><p>${esc(story.before)}</p><strong class="story-slot">${slot(p.before)}</strong></article><article class="story-proposal ${p.change === 'lost' ? 'story-lost' : ''}"><span class="living-kicker">PROPOSAL / ${clock(room.policy.close)}</span><h4>${p.status === 'retained' ? 'The visit still fits.' : p.status === 'unknown' ? 'The gap stays a gap.' : 'The visit falls away.'}</h4><p>${esc(story.after)}</p><strong class="story-slot">${slot(p)}</strong></article></div><div class="living-footnote"><b>${story.margin === null ? 'A missing input prevents a time-margin calculation.' : `${n(story.margin)} minutes of time margin before capacity allocation.`}</b><span>${story.lostMinutes ? `${story.lostMinutes} allocated minutes disappear in this model run. ` : ''}Time margin alone does not guarantee a seat, a computer or practical access.</span>${button('inspect', 'Inspect the supplied constraints ↗', `data-id="${esc(p.id)}"`)}</div>`;
  }
  function choiceCards(room, kind) {
    state.choices =
      kind === 'multiverse'
        ? multiverse(room)
        : kind === 'tiny'
          ? tinyChanges(room)
          : stressCases(room);
    const intro =
      kind === 'multiverse'
        ? [
            'SEVERAL FUTURES. THE SAME SUPPLIED LIVES.',
            'A decision is<br>a fork in the day.',
            'Each branch changes the stated conditions. Compare access and costs before choosing a proposal.',
          ]
        : kind === 'tiny'
          ? [
              'SMALL CHANGES. VISIBLE CONSEQUENCES.',
              'What if the answer<br>is one small thing?',
              'These bounded, one-variable trials are ordered by net additional access. They are not a global optimum or a cost ranking.',
            ]
          : [
              'A STRESS TEST, NOT A PREDICTION.',
              'Find the fragile bit.',
              'Each disruption is tested separately against your proposal. A red number counts access lost from that proposal, not a forecast or a failure probability.',
            ];
    return `<div class="living-chapter"><span class="living-kicker">${intro[0]}</span><h3>${intro[1]}</h3><p>${intro[2]}</p></div>${kind === 'break' ? '<div class="break-stamp" aria-hidden="true">HANDLE WITH<br>REALITY</div>' : ''}<div class="branch-canvas ${kind === 'break' ? 'stress-canvas' : ''}"><div class="branch-origin"><span>YOUR PROPOSAL</span><b>${clock(room.policy.close)}</b><small>${n(r.metrics.served)} represented visits served</small></div><div class="branch-grid">${state.choices.map((c, i) => `<article class="branch-note"><span class="living-kicker">${kind === 'break' ? 'DISRUPTION' : 'POSSIBILITY'} / ${String(i + 1).padStart(2, '0')}</span><h4>${esc(c.title)}</h4><p>${esc(c.detail)}</p><div class="branch-impact"><strong>${kind === 'break' ? '−' + n(c.delta.metrics.lost) : (c.result.metrics.served - r.metrics.served >= 0 ? '+' : '') + n(c.result.metrics.served - r.metrics.served)}</strong><span>${kind === 'break' ? 'visits lose access<br>from this proposal' : 'net represented visits<br>versus this proposal'}</span></div><dl><div><dt>Access gained / lost</dt><dd>+${n(c.delta.metrics.gained)} / −${n(c.delta.metrics.lost)}</dd></div><div><dt>Total proposed access</dt><dd>${n(c.result.metrics.served)} / ${n(c.result.metrics.population)}</dd></div><div><dt>Unknown outcomes</dt><dd>${n(c.result.metrics.unknown)}</dd></div><div><dt>Operating cost Δ</dt><dd>R ${n(c.result.metrics.operatingCost - r.metrics.operatingCost)}</dd></div></dl>${button('apply', kind === 'break' ? 'Try this disruption ↗' : 'Try this branch ↗', `data-id="${c.id}"`)}</article>`).join('') || '<p>No further changes are available within the model’s input limits.</p>'}</div></div><p class="living-caveat">Operating costs use the supplied hourly estimate. New equipment, transport interventions and other unrecorded costs are excluded. Nothing changes in your live proposal until you choose a branch. Undo remains available.</p>`;
  }
  function constellation(room) {
    const rows = r.rows.slice(0, 80);
    const complete = rows.filter((p) => p.complete),
      incomplete = rows.filter((p) => !p.complete);
    const min = Math.min(480, ...complete.map((p) => p.start)),
      max = Math.max(1200, ...complete.map((p) => p.start));
    const x = (p) =>
      p.complete
        ? 66 + ((p.start - min) / Math.max(1, max - min)) * 620
        : 66 + ((incomplete.indexOf(p) + 1) / (incomplete.length + 1)) * 620;
    const y = (p) =>
      !p.complete
        ? 425
        : 210 - Math.max(-150, Math.min(150, p.available - p.needed));
    return `<div class="living-chapter"><span class="living-kicker">A MAP OF TIME. NOT A MAP OF WHERE PEOPLE LIVE.</span><h3>Every dot has<br>somewhere to be.</h3><p>Move right for later effective arrivals. Move up for more spare time after a complete session. Select a dot to follow that resident.</p></div><div class="constellation-legend"><span>● Access retained</span><span>◆ Lost / excluded</span><span>○ Incomplete availability</span></div><div class="sky-scroll"><svg class="constraint-sky" viewBox="0 0 760 ${incomplete.length ? 470 : 410}" role="group" aria-label="Resident arrival and available time margin"><path d="M66 55V360H700M66 210H700"/><text x="10" y="53">+150m</text><text x="10" y="214">0m</text><text x="10" y="357">−150m</text><text x="66" y="390">${clock(min)}</text><text x="630" y="390">${clock(max)}</text><text x="270" y="402">EFFECTIVE ARRIVAL →</text><text x="76" y="198">SESSION LENGTH MET · CAPACITY STILL APPLIES</text>${incomplete.length ? '<text x="66" y="450">INCOMPLETE AVAILABILITY / X-POSITION IS NOT ARRIVAL TIME</text>' : ''}${rows.map((p, i) => `<g class="sky-node ${p.complete ? p.status : 'unknown'}" role="button" tabindex="0" data-living="person" data-id="${esc(p.id)}" data-day="${p.day}" aria-label="${esc(p.name)}, ${p.day}: ${!p.complete ? 'unknown time margin' : n(p.available - p.needed) + ' minute time margin'}, ${esc(p.change)}"><title>${esc(p.name)} · ${p.day} · ${esc(p.reason || 'Session fits')}</title>${p.complete && p.status === 'excluded' ? `<path d="M${x(p)} ${y(p) - 7}l7 7-7 7-7-7Z"/>` : `<circle cx="${x(p)}" cy="${y(p) + ((i % 3) - 1) * 3}" r="5"/>`}</g>`).join('')}</svg></div><p class="living-caveat">${r.rows.length > 80 ? 'Showing the first 80 observations. ' : ''}Incomplete observations sit on a separate lower row rather than receiving invented margins or arrival positions. Explicit fallback estimates, when enabled, are labelled in each resident’s story. Very large margins are clamped at ±150 minutes for display. Dots may overlap; the resident selector below includes every observation.</p>${peoplePicker(room, r.rows)}${button('follow-selected', 'Follow the selected resident ↗')}`;
  }
  function replay(room) {
    const frames = replayFrames(room);
    state.replay = Math.max(0, Math.min(state.replay, frames.length - 1));
    const f = frames[state.replay],
      a = frameResult(f),
      edges = closingEdges({
        ...room,
        people: f.people,
        baseline: f.baseline,
        policy: f.policy,
      });
    return `<div class="living-chapter"><span class="living-kicker">THE PAST IS AN INPUT YOU CAN INSPECT.</span><h3>Rewind the room.</h3><p>Saved scenarios keep their original people and assumptions. Replay a captured model run without overwriting today’s proposal.</p></div><div class="replay-rail" aria-label="Saved model runs">${frames.map((v, i) => `<button data-living="frame" data-index="${i}" aria-current="${state.replay === i ? 'step' : 'false'}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(v.title)}<small>${v.live ? 'LIVE PROPOSAL' : new Date(v.date).toLocaleDateString('en-ZA')}</small></button>`).join('')}</div><article class="replay-poster"><div><span class="living-kicker">FRAME ${state.replay + 1} / ${frames.length} · ${f.live ? 'LIVE' : 'CAPTURED MODEL RUN'}</span><h4>${esc(f.title)}</h4><p>${f.people.length} profiles · ${esc(f.policy.days.join(', '))} · closing ${clock(f.baseline.close)} → ${clock(f.policy.close)}</p></div><strong>${n(a.metrics.reach)}<small>% access</small></strong><div class="replay-totals"><span>${n(a.metrics.served)} represented visits served</span><span>${n(a.metrics.lost)} lose access</span><span>${n(a.metrics.unknown)} unknown outcomes</span></div></article><div class="replay-controls">${button('previous', '← Previous', state.replay === 0 ? 'disabled' : '')}${button('capture', 'Capture today’s proposal +')}${button('next', 'Next →', state.replay === frames.length - 1 ? 'disabled' : '')}</div><div class="edge-study"><span class="living-kicker">BUTTERFLY EFFECT / CLOSING TIME ONLY</span><h4>Where does this version tip?</h4><div class="edge-bars">${edges.map((e) => `<div><span>${n(e.result.metrics.served)}</span><i style="height:${12 + e.result.metrics.reach * 1.1}px" class="${e.close === f.policy.close ? 'edge-selected' : ''}"></i><small>${clock(e.close)}</small></div>`).join('')}</div><p>Each bar reruns this frame’s captured cohort at a different closing time. All other conditions are held fixed. These are model comparisons, not changes observed after implementation.</p></div>${button('export', 'Download this frame’s model receipt ↓')}<p class="living-caveat">This private receipt contains the captured resident profiles. Review before sharing.</p>`;
  }
  function render() {
    const room = getRoom();
    if (state.roomId !== room.id) {
      state.roomId = room.id;
      state.person = '';
      state.day = '';
      state.replay = 0;
    }
    r = analyse(room.people, room.baseline, room.policy);
    const meta = modes.find((m) => m[0] === state.mode),
      body =
        state.mode === 'disappears'
          ? disappeared(room)
          : state.mode === 'follow'
            ? follow(room)
            : state.mode === 'constellation'
              ? constellation(room)
              : state.mode === 'replay'
                ? replay(room)
                : choiceCards(room, state.mode);
    return `<section class="living-lab" aria-label="Living decision laboratory"><header class="living-masthead"><div><span>RIPPLE ROOM / FIELD EXPERIMENTS</span><h2>The part a timetable<br>doesn’t tell you.</h2></div><div class="living-seal">PEOPLE<br>BEFORE<br>POLICY <span>↳</span></div></header><div class="living-shell"><nav class="living-nav" aria-label="Laboratory lenses">${modes.map(([id, index, title, description]) => `<button data-living="mode" data-mode="${id}" data-living-focus="mode-${id}" aria-pressed="${state.mode === id}"><span>${index}</span><b>${title}</b><small>${description}</small></button>`).join('')}<p>Same inputs.<br>Different ways to notice.</p></nav><div class="living-stage" aria-label="${esc(meta[2])}">${body}</div></div><footer class="living-method"><span>${room.demo ? 'ILLUSTRATIVE PROFILES' : 'SUPPLIED CONSTRAINTS'} / DETERMINISTIC MODEL</span><p>No attendance forecasts, invented probabilities or inferred personal details. A missing input remains visible. Results describe the supplied sample.</p><button class="btn quiet" data-action="undo" ${canUndo() ? '' : 'disabled'}>Undo last change</button></footer></section>`;
  }
  function click(target) {
    const t = target.closest('[data-living]');
    if (!t || t.disabled) return false;
    const d = t.dataset;
    if (d.living === 'mode') {
      open(d.mode);
      refresh('mode-' + d.mode);
    }
    if (d.living === 'filter') {
      state.filter = d.value;
      refresh('filter-' + d.value);
    }
    if (d.living === 'person') {
      state.person = d.id;
      state.day = d.day;
      state.mode = 'follow';
      refresh('person');
    }
    if (d.living === 'follow-selected') {
      state.mode = 'follow';
      refresh('person');
    }
    if (d.living === 'apply') {
      const c = state.choices.find((c) => c.id === d.id);
      if (c) onApply(copyPatch(c.patch));
    }
    if (d.living === 'inspect') onInspect(d.id, state.day);
    if (d.living === 'frame') {
      state.replay = Number(d.index);
      refresh();
    }
    if (d.living === 'previous') {
      state.replay--;
      refresh();
    }
    if (d.living === 'next') {
      state.replay++;
      refresh();
    }
    if (d.living === 'capture') onCapture();
    if (d.living === 'export') {
      const frame = replayFrames(getRoom())[state.replay];
      onDownload({
        format: 'Ripple Room model receipt / 1',
        ...frame,
        result: frameResult(frame),
        interpretation:
          'Captured model inputs and outcomes. Not observed implementation results. Contains resident profiles; keep private.',
      });
    }
    return true;
  }
  function change(target) {
    const key = target.dataset.livingChange;
    if (!key) return false;
    if (key === 'person') state.person = target.value;
    if (key === 'day') state.day = target.value;
    refresh(key);
    return true;
  }
  const copyPatch = (p) => JSON.parse(JSON.stringify(p));
  return { render, click, change, open };
}
