# User flow integration harness

Run `pnpm test:flows` with Node 22.23.1 on Windows.

## First setup

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm exec playwright install chromium`.
3. Run `pwsh -File scripts/setup-native-api.ps1` for the local API tests.
4. Run `pnpm test:flows`.

Allow about 6 minutes with the tools already installed. The first database tools download takes additional time. `pnpm test:flows:browser` runs only browser checks and also works on Linux. CI installs Linux browser dependencies with `pnpm exec playwright install --with-deps chromium`.

Vite 8.0.3 and Playwright 1.62.1 are pinned in the root package and lockfile. The harness does not need the prototype installation or a Codex runtime. `PLAYWRIGHT_MODULE_PATH` and `PLAYWRIGHT_BROWSERS_PATH` remain optional overrides. No application credentials are required.

## Run and inspect results

| Command | Evidence |
| --- | --- |
| `pnpm test:flows` | App and website browser suites, harness checks, fresh database, and real repository/API checks |
| `pnpm test:flows:browser` | App and website browser suites and harness checks |
| `pnpm test:flows:expanded` | New route, form, error, and persistence scenarios |
| `pnpm test:api-integration:native` | Real repository, SDK, HTTP, PostgREST, and PostgreSQL |
| `node scripts/feature-integration/server.mjs --serve` | Manual preview at `http://127.0.0.1:5173/?screen=today` |

Open `artifacts/latest.json` after a full run. Each run also has a unique folder under `artifacts/runs/<runId>/`. It holds the summary, suite reports, logs, screenshots, and failure traces. Use `pnpm exec playwright show-trace <trace.zip>` to inspect a failed browser flow. The artifacts directory is ignored by Git.

For a focused check, set `SCENARIO_FILTER` to a name fragment and run one suite directly. Remove the variable before the full run. The full runner rejects filters. A filter that matches no tests fails. Partial runs do not update the full-run summary.

The legacy `test`, `test:coverage`, and `preflight` scripts still include Jest. They are not part of this harness. No unit tests are run by the commands above.

## Isolation and failure handling

1. Each browser case uses a new context with empty cookies and storage. The check runs before application startup, so automatic drafts are allowed. Reload and multiple-tab tests share state only inside that case.
2. Browser requests must use the exact test-server origin. Other local ports and external hosts are blocked. Service workers are blocked. WebSockets can reach only the test server. Production backend imports are also blocked by Vite.
3. Each scenario has a 60-second limit. Uncaught errors from every tab, server errors, and unexpected external requests fail the case. Failed cases keep screenshots and traces. The runner continues to collect other failures.
4. Reports begin in `running` state before setup. Passing requires completed tests and cleanup. Empty, partial, stale, failed, or missing reports cannot produce a full-suite pass. Harness integration probes deliberately fail cases to verify these rules; their expected `FAIL` log lines are separate from application failures.
5. Database runs create a new loopback PostgreSQL cluster and apply all migrations and synthetic seeds. SQL tests use transactions. The 24 added API cases use separate identities and pregnancies. The existing 10 API cases form one linked journey. The API processes stop, then the cluster stops and its validated temporary directory is removed. TAP plans must match the complete numbered assertion sequence.

The manual preview's browser data is not used or reset. PostgreSQL and PostgREST tools remain cached. A test run never targets a hosted project.

## Flow coverage

| Area | Browser checks | Database/API checks |
| --- | --- | --- |
| Setup, Today, Journey, and recovery | Setup drafts, skipped date, home focus, independent preferences, compassionate suppression, lifecycle settings | Undated setup, preferences, due-date changes, pause/loss/end/birth/archive and restore |
| Memories, journal, meals, and check-ins | Create, edit, reopen, tags, filters, capsules, draft recovery, invalid links, private notes | Save, reconnect, edit, stale-write conflicts, exact timestamp retention, owner isolation |
| Care and provider summaries | Visits, questions, timezone/calendar input, provider/contact/medication creation and confirmed deletion, summary review, failed and offline saves | Providers, contacts, medications, questions, answered/reopen status, private notes, deletion, owner isolation |
| Plans and Together | Templates, edits, completion, removal/restore, support requests, grants, invitation validation and revocation | Idempotent plan retry, task changes, support cancellation, invitation race, grants/revocation, rejected foreign writes |
| Privacy, notifications, health, and help | Sign-out confirmation, export limits, notification choices and time validation, disabled device features, safe navigation | Notification privacy and quiet hours in three timezones; existing authorization and privacy SQL tests |

All 20 preview screens have cold-link, refresh, and navigation checks at 320, 390, and 1280 pixels. Tests also check page overflow and uncaught browser errors. This is not a complete accessibility audit.

The website adds 18 browser scenarios for its seven pages, homepage tabs, mobile menu, keyboard access, footer links, FAQ, missing-page recovery, and absence of browser tracking storage. Each website run builds the current local source before starting its test server. Its policy and external deletion pages remain drafts.

`flow-catalog.mjs` accounts for every source route. A new route without a catalog entry fails the full runner. Entries state whether the route has browser evidence, is a redirect/internal page, or needs a missing runtime. The catalog does not treat blocked routes as passed tests.

## Evidence limits

The browser loads production route components, screens, hooks, forms, validation, theme, dialogs, and sheets. It adapts authentication, repositories, storage, Expo routing, safe areas, and device actions. Browser tests prove screen integration with synthetic services. They do not prove the full native application or backend behavior.

The API suite uses production repositories through the real Supabase SDK, local HTTP, PostgREST, and PostgreSQL. Its users and JWTs are synthetic. See `docs/database/native-api-testing.md` for details.

The service harness now covers real local Auth, email, and account functions. See [service setup and evidence limits](../service-integration/README.md). `pnpm test:flows` includes its 36 scenarios after the database/API suite; run the service setup script before the first full run.

These checks still need a supported isolated service stack or a physical device:

1. Native login/deep links, password replacement, external OAuth, and native sign-out cleanup. Local email codes, links, PKCE, recovery sessions, and refresh are now covered.
2. Invitation delivery and acceptance through the real Auth and Edge services.
3. Camera, microphone, document uploads, encrypted device files, and interrupted upload recovery.
4. Account export files, deletion with stored bytes, push delivery, app lock, calendar, and system sharing. Local export JSON and deletion without stored files are now covered.
5. Native navigation, phone accessibility, permissions, and background behavior.

Health integration remains disabled. Tests check that boundary; they do not claim health-provider access. Local test success is not store or production acceptance.

## Manual preview

The preview keeps synthetic records and drafts in `localStorage` under `flutterings.preview.v1`. It does not encrypt those records or sync them to an account. Use synthetic data only. Sharing and invitations are simulated.

The manual server uses port 5173 and fails if the port is busy. Use the app tabs and Add menu. The Demo stage control selects pregnancy or after-birth fixtures. Restart the server after source edits because file watching is disabled.

Use **Reset saved preview** under **Preview shortcuts and limits** to remove this preview key after confirmation. Other site storage is kept. Invalid snapshots are preserved until reset. A stale tab cannot overwrite a newer saved snapshot; it requires an explicit reload.

## CI

`.github/workflows/user-flows.yml` runs browser integration on Linux and database/API integration on Windows. Both jobs save evidence when a test fails. No hosted secrets or application accounts are required. Local runs do not prove that the GitHub jobs have run.

## Verified run: 18 October 2026

Run `0547f993-d981-4773-8f4f-e3404eaad075` passed in 5.2 minutes on Node 22.23.1.

| Check | Passed |
| --- | ---: |
| App browser scenarios | 127 |
| Website browser scenarios | 18 |
| Real local API scenarios | 34 |
| Database integration assertions | 252 |
| Harness integration checks | 8 |

The invitation race also passed. All browser/server cleanup checks passed. The
fresh PostgreSQL cluster was stopped and its temporary directory was removed.
Type checking, lint for the two changed route files, JavaScript syntax, and
formatting checks passed. CI YAML parsed; GitHub jobs were not run here.

This work added 77 browser cases and 24 API cases. It fixed invalid meal and
journal route IDs that could reach editor initialization. Six browser cases
check invalid or missing IDs and return navigation. No unit tests were added or run.

The full report is `artifacts/runs/0547f993-d981-4773-8f4f-e3404eaad075/summary.json`.
Native/Auth/Storage/Edge acceptance remains open. Docker's Linux engine was not
available, and Maestro and adb were not installed on this machine during this run.
