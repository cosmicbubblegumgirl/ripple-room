# Architecture and verification

## Application structure

| File                    | Responsibility                                             |
| ----------------------- | ---------------------------------------------------------- |
| `dist/index.html`       | Semantic shell, navigation and custom icon symbols         |
| `dist/styles.css`       | Responsive layout, themes, reduced motion and print styles |
| `dist/studio.css`       | Public life studio design and responsive refinements       |
| `dist/living.js`        | Living laboratory views and interaction state              |
| `dist/living-engine.js` | Bounded alternatives, perturbations and captured replays   |
| `dist/living.css`       | Responsive field-experiment visual language                |
| `dist/app.js`           | Views, accessible dialogs, workspace actions and exports   |
| `dist/engine.js`        | Pure modelling, validation and CSV parsing                 |
| `dist/data.js`          | Clearly labelled illustrative rooms and preferences        |
| `dist/db.js`            | IndexedDB transactions for device rooms and preferences    |
| `dist/cloud.js`         | Supabase Auth and owner-private, versioned cloud copies    |
| `dist/config.js`        | Public database endpoint and publishable key               |
| `dist/sw.js`            | Same-origin application cache for repeat offline use       |
| `scripts/inventory.mjs` | Capability documentation and command-handler audit         |
| `tests/engine.test.js`  | Simulation and import regression checks                    |

## Data flow

A device room contains anonymous profiles, current conditions, proposed conditions, evidence, notes and saved snapshots. Every run calculates both conditions against the same selected days and representation setting. Inputs are validated before importing a room or resident list. Imported snapshot metrics are recalculated from their captured inputs.

The model calculates an effective arrival and departure window, checks practical access requirements, and allocates uninterrupted 15-minute slots. The displayed timeline shows windows; the inspector separately shows the allocated slot. Alternative conditions and sensitivity runs use the same engine.

User-entered text is escaped before insertion into HTML. Imported identifiers are normalised to UUIDs. Source links accept HTTP and HTTPS only. Text cells that could become spreadsheet formulas are prefixed during CSV export.

## Persistence boundaries

IndexedDB stores device rooms and preferences. Local changes are debounced when autosave is enabled; explicit device saving is also available. A JSON backup is the portable recovery route. Browser storage is not a substitute for a backup and can be cleared by the user or browser.

Cloud copies are separate, explicit saves. Authentication uses the official vendored Supabase client, version 2.118.0. The owner ID comes from the authenticated session; database row-level policies enforce it independently of browser code. Updates additionally match the expected record version. A version mismatch leaves the other copy unchanged.

Shared snapshot links contain a bounded, encoded aggregate report. They do not contain individual profiles, notes or evidence bodies. Small aggregate groups can still be identifying, so the sharing dialog asks the author to review the contents.

## Verification performed

- Engine and validation regression tests with Node's test runner.
- Browser checks for live closing-time changes, scenario capture/comparison, resident creation/search, alternatives and decision brief rendering.
- Responsive checks across the core workspace views, plus all seven living-laboratory lenses at 320, 390 and 768 pixel frame widths and on desktop.

- The opening closing-time slider updates the workbench and individual consequence slips together.
- Duplicate DOM identifier check.
- Database transaction check: owner read succeeds, cross-owner read is denied, and the disposable test record is rolled back.
- Supabase advisors: no issue reported for the new `rr_workspaces` table. Existing project-level findings were left unchanged because they affect other applications.

Password-based sign-in and cloud saving are implemented with the connected provider. A complete browser sign-in/save round trip requires a real account and has not been impersonated during testing.

## Living laboratory checks

Ten additional regression tests cover proposal-relative stress losses, one-variable trials, resource bottlenecks, baseline comparability, immutable captured replays, unknown time margins, bounded closing-time studies, escaped aliases finite template outcomes and explicitly labelled fallback estimates. Laboratory interactions share the existing undo and persistence routes. Browser verification confirmed that a 17:00 captured frame remained at 17:00 while the live proposal moved to 17:15; Undo restored the proposal and removed the disposable snapshot. Private model receipts include captured profiles and are explicitly labelled before export.

### Timetable compromise search (2.2)

The eighth laboratory lens searches closing-time and last-departure shifts in 15-minute steps, bounded by 90 minutes per setting and midnight. It evaluates at most 49 distinct combinations. Access targets use the model's evaluable visit denominator; unknown and estimated observations are reported separately. Optional preservation checks each resident-day already served by the proposal, so a larger weighted total cannot hide a newly excluded visit. Ranked results omit alternatives that use at least as much room and bus time for no better access and no fewer lost visits. Options are ordered by total minutes changed, number of changed fields, then access. This is a timetable ordering rule, not an inferred cost or a global optimum. Applying an option uses the existing mutation and undo path. The search itself does not change the room or its saved scenarios.
Browser checks for this release covered target and time-limit changes, no-match messaging, applying a suggestion, and undo. The compromise view fits 320, 390 and 768 pixel frames and desktop. Seven new regression tests bring the suite to 42 passing tests.

## Known model limits

Scheduling is greedy rather than globally optimal. A representation weight is not expanded into simultaneous residents. A voluntary sample does not establish a population distribution. Cost inputs do not include unrecorded intervention expenses. The model does not infer diagnoses, predict attendance, judge who deserves access, or make a final decision for a community.
