# Ripple Room

**The human side of what if.**

Ripple Room is a decision lab for exploring how changes to shared spaces affect the people who use them. A closing time, a bus departure or a missing computer can change whether someone has enough time to finish what they came to do.

Designed and developed by **Simoné Govender** · A Quantum Cupcake Creation.

## What you can do

- Explore 12 starting points, including libraries, study spaces, transport and digital access.
- Add anonymous resident profiles with availability, travel, session length and access needs.
- Change current and proposed conditions and follow outcomes through timelines, ripple diagrams and group comparisons.
- Compare named snapshots with their original cohorts and assumptions preserved.
- Test alternatives, disruptions and closing-time sensitivity.
- Record sources, assumptions, disagreements and next steps.
- Export decision briefs, CSV tables, JSON backups, SVG and PNG charts, Markdown and standalone HTML.
- Share a frozen aggregate snapshot that excludes individual records and discussion text.
- Work with a device database and optionally save explicit private cloud copies.
- Customise colour, motion, contrast, reading scale, tables, charts and report sections.

The in-app **Inside the room** inventory documents more than 240 working tools, controls and analytic measures. See [CAPABILITIES.md](CAPABILITIES.md) for the exact inventory and how it is counted.

## The living laboratory

Eight connected lenses use the same inspectable scheduling engine:

- **Who disappears?** separates newly lost access, existing exclusions, unknowns and gains.
- **Follow one person** reads current and proposed versions of the same supplied day.
- **Decision multiverse** compares six bounded alternatives; trying a branch is reversible.
- **One tiny change** tests individual time, resource and access adjustments, ordered by net additional access.
- **Break this decision** compares explicit disruptions against the proposal without counting its existing losses twice.
- **Constraint constellations** plots effective arrival against session time margin, with keyboard and list access to the underlying residents.
- **Ripple Replay** revisits captured cohorts and assumptions, studies nearby closing-time thresholds and exports a private model receipt.
- **Find a compromise** searches combined closing-time and last-bus shifts in 15-minute steps. Set an access target and time limits, preserve every resident-day already served by the proposal, and try an alternative with undo. Ranking uses total minutes changed rather than an inferred monetary cost. Missing availability remains visible.

These are deterministic comparisons, not attendance forecasts or observed post-implementation outcomes. Trials use supplied operating costs and do not infer equipment or intervention costs. The 900-item expansion brief is a roadmap, not a claim about implemented features.

## Run locally

This is a buildless application. Serve `dist/` using any static HTTP server. For example:

```sh
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. HTTPS or localhost is required for service workers. UUID creation also supports ordinary HTTP previews through the browser's random-value API.

## Checks

Use Node.js 24 or later:

```sh
npm run check
npm test
node scripts/inventory.mjs --check
```

The engine tests cover transport deadlines, uninterrupted shared-resource allocation, access requirements, unknown values, representation weights, multiple days, CSV parsing, import validation and backup round trips.

## Hosting on GitHub Pages

Before preparing a release, bump `package.json` and run `npm run version-assets`, then run the checks. The entry page, module imports, styles and offline cache use the same release version so cached files from an older release cannot be mixed into the new module graph.

The `gh-pages` branch contains the contents of `dist/` at its root. In the repository settings, choose **Pages → Source → Deploy from a branch → gh-pages → / (root)**. Release updates must copy the verified `dist/` files to that branch. GitHub Pages serves the frontend; the database is hosted separately. The optional workflow can publish directly from `main` if Pages is later configured for GitHub Actions.

All application assets use relative paths so the same build works at a project path such as `/ripple-room/`. There is no frontend build step, package installation or runtime server required.

## Data and authentication

Device rooms and preferences live in IndexedDB. Private cloud copies use Supabase Auth and the dedicated `public.rr_workspaces` table. The browser configuration contains a publishable API key only. Row-level security restricts access to the signed-in owner. Device copies are uploaded only when the user explicitly saves a cloud copy.

The schema is documented in [database/schema.sql](database/schema.sql). It has already been applied to the connected database. To use a separate Supabase project, apply that schema and replace the URL and publishable key in `dist/config.js`. Never put a secret or service-role key in browser files.

Cloud saves use version checks to reject an update if another device has changed the same cloud record. Sign-up confirmation and email delivery depend on the authentication provider's settings; the complete device workflow needs no account.

## Model boundaries

This is a deterministic, inspectable scenario model. It is not a forecast, a booking service or an eligibility decision. The sample rooms use fictional residents and are labelled throughout.

- Sessions are allocated in uninterrupted 15-minute slots using a chosen greedy ordering.
- Representation weights affect reported visit totals, not the number of capacity reservations.
- Missing availability stays unknown unless the user explicitly enables documented fallback estimates.
- Group comparisons describe the supplied sample and do not establish population fairness or causation.
- Operating costs and potential trip exposure are estimates from supplied assumptions.

See [ARCHITECTURE.md](ARCHITECTURE.md) for implementation and verification details.
