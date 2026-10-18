# Flutterings website preview

Open `http://127.0.0.1:5190/` while the local server is running.

This is a static website for review. It is not published. It includes the home,
features, Memories, privacy, support, account deletion, and app preview pages.
The separate working app preview runs on port 5173.

## Build and run

From the repository root, use Node 22.23.1:

```powershell
node sites/flutterings/build.mjs
node sites/flutterings/server.mjs --serve
```

The build uses fonts already installed in `apps/mobile/node_modules`. It copies
their font licenses into `dist/assets`. No external font service is used.
Generated files are in `dist/`; edit `build.mjs`, `site.css`, and `site.js`.

## Browser integration harness

The harness was constructed before the website implementation. It starts a
temporary local server and uses an empty browser context for each scenario.
It blocks external requests and closes its server and browser after the run.
There are no unit tests.

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
node sites/flutterings/test.mjs
```

The test now uses the shared user flow harness and builds the current website
source before each suite run. It is also included in `pnpm test:flows` and
`pnpm test:flows:browser`. Test dependencies are pinned in the root lockfile.

The 18 scenarios check the homepage at phone, tablet, and desktop sizes;
all other pages at phone and desktop sizes; navigation and footer links;
keyboard access and the mobile menu; FAQ expansion; local storage and cookies.
Each scenario also checks browser errors and horizontal overflow. For a direct
website run, screenshots and the result report are written to the ignored
`scripts/feature-integration/artifacts/website/` directory. Full runs keep them in
their unique run folder. Failed cases also keep a Playwright trace.

These checks establish local website behaviour. They do not establish native
device behaviour, hosted accounts, production deletion, or legal compliance.

## App screen images

`assets/app-*.png` show actual app components with isolated sample records.
Run this command with the same Playwright environment to refresh them:

```powershell
node sites/flutterings/capture-app.mjs
node sites/flutterings/build.mjs
```

The capture uses a new browser context, not the user's saved preview records.
The handwritten-style notes and plan cards are labelled as illustrative content.

## Content sources

- `docs/flutterings-feature-expansion.md`: implemented feature scope.
- `docs/adr/0013-account-privacy-and-device-lock.md`: export and deletion limits.
- `apps/mobile/src/features/account/privacy-data-screen.tsx`: current control labels.
- `apps/mobile/src/theme/tokens.ts`: fonts and colour direction.

Flutterings is the requested website name. The underlying application source
still contains the Tender name. This work does not rename the native app.

## Before publication

1. Confirm the legal operator, address, privacy contact, support contact, and regions.
2. Confirm providers, retention, deletion timing, age eligibility, and applicable notices.
3. Add a verified external deletion request route and working support contact.
4. Replace the local app preview link with the approved public destination or store links.
5. Review the final policy, then configure public HTTPS URLs and app/store links.

The site has no analytics integration, sign-up form, tracking cookies, or remote
fonts. It has preview notices, `noindex` metadata, and a disallow-all robots file.
The privacy text is a source-based draft with explicit unknown facts. Do not
present it as a final policy or as a working external deletion service.

Official release references:
[Apple privacy guidance](https://developer.apple.com/app-store/review/guidelines/#privacy)
and [Google account deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
