# Service and phone integration tests

Use Node 22 from `.nvmrc`. These are integration tests. No unit tests run.

## Run the local tests

1. Run `./scripts/setup-native-api.ps1`.
2. Run `./scripts/service-integration/setup.ps1 -WithPhone` on Windows.
3. Run `pnpm test:flows:services` for Auth, email, and account functions. Run `pnpm test:flows` for the full local regression suite.

For password replacement, set `TENDER_TEST_PASSWORD_SOURCE=disposable-generated` in the test process, then run `pnpm test:flows:passwords`. The user approved generated passwords for isolated tests only on 18 October 2026. Each case creates new values in memory. These values are never stored in source, reports, or environment variables. The same setting is required by `pnpm test:flows`. CI sets it for the password test step only.

The separate password suite has 20 integration cases. It checks first-password setup, replacement, rejection of old passwords, minimum length and all four character classes, same-password rejection, missing and signed-out sessions, expired and used recovery links, separation between accounts, repeated replacement, email-code login after replacement, retry after validation failure, revocation of other refresh sessions, and deleted accounts. It uses the real Auth server and the production password service. It does not test the native password form or keyboard.

The first setup downloads and builds tools. Allow 10–20 minutes on a new machine. A cached service run takes about 3 minutes. Tools stay in the ignored `scripts/feature-integration/artifacts/service-tools` directory. Setup does not replace system Java, change PATH, or install a Windows service.

The setup pins Go 1.27.2, Supabase Auth 2.197.0, Deno 2.9.7, the Supabase SDK 2.112.3, Android platform tools 37.0.1, Java 21.0.12.1, and Maestro 2.11.0. Download checksums are in `setup.ps1`. PostgreSQL and PostgREST reuse the existing verified installers. Auth has one test-only Windows adapter: `prepare-auth.mjs` removes the Unix `SO_REUSEPORT` listener option from the downloaded source. Its authentication logic is unchanged. This is a custom native test runtime, not the supported Supabase CLI native runtime.

## What the 36 service scenarios prove

| Area | Checks |
| --- | --- |
| Login and email | New signup, returning login, normalization, wrong code/email, consumed code, resend, expiry, delivered magic links, token-hash callbacks, and rejected link reuse |
| PKCE and sessions | Code exchange, missing verifier, reused code, refresh rotation, revoked refresh after sign-out, new-client session restore, and cleared session storage |
| Recovery and isolation | Recovery email/session, single-use recovery link, generic response for unknown email, invalid email, local SMTP rejection of external recipients, and real JWT database owner isolation |
| Account export | Anonymous and invalid-token rejection, current-user-only records, audit record, and `Cache-Control: no-store` |
| Account deletion | Five invalid confirmations, four invalid request bodies, exact confirmation, Auth removal, database cascades, revoked sessions, repeat deletion, preserved second user, and failure when either document or media removal is unavailable |

The app's production auth service and callback parser make real HTTP calls through the real Supabase SDK to Auth. The harness supplies the native redirect/browser boundaries and disables analytics. Deno runs the unchanged production account function. PostgreSQL runs every application migration. The SQL-only Auth fixture seed is deliberately excluded: all accounts are created through real Auth APIs.

The local SMTP inbox accepts only `@example.invalid`. It cannot relay mail. Delivered messages stay in memory and are cleared after each scenario. A test-only email template includes the real generated link and code. Rate limits are raised only for this disposable test server; these tests do not prove production rate-limit settings.

## Fresh data and cleanup

Each run starts a new PostgreSQL cluster, random loopback ports, and a new JWT signing key. Each scenario starts new users and clients. User deletion is checked through Auth. The inbox is cleared after every scenario. The final cleanup stops owned processes, removes the temporary database, and checks that every service port is closed. Only a complete set of 36 passing cases with verified cleanup can produce a passing service report.

Reports contain a run ID, each result, planned count, runtime limits, and cleanup status. They do not contain email contents, login codes, session tokens, or signing keys. A standalone report is in `../feature-integration/artifacts/service-runs/<run-id>/summary.json`. A full regression report includes `native-services/summary.json` under its own run directory. Failed and blocked runs are retained as evidence; they do not count as passes.

## Storage and full deletion

Run `pnpm test:flows:storage` on a host with a working Docker Linux engine. The runner creates a unique Supabase project in a temporary directory. It copies current migrations and the account function, disables fixture seeds, and uses only local API addresses. It never resets `tender-local` or reads application `.env` files. It removes that unique project's containers, volumes, users, and objects after the run.

The runner creates a separate Docker network with ports bound to loopback. It checks the port bindings before tests. The network, CLI state, and function process belong only to that run and are removed during cleanup. See the [Supabase local network setup](https://supabase.com/docs/guides/local-development).

The 13 prepared scenarios cover both private buckets: upload/download bytes, replacement upload, denied unregistered upload, denied foreign reads/writes/deletes, pending-file privacy, owner removal, anonymous access, and full account deletion with files in both buckets. They check durable object and account state, not just HTTP success. A second user's file must remain after deletion.

These 13 scenarios have **not run on this computer**. Firmware virtualization is off and Docker's Linux engine is unavailable. The runner returns a blocked report with zero passing scenarios. The Linux CI job is configured but has not been executed here. See [Supabase runtime support](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes).

The native service suite does not have a real Storage HTTP server. It returns an explicit HTTP 503 for Storage requests to prove that the account function stops safely and preserves Auth and metadata. That result does not prove successful uploads or deletion of stored bytes.

## Phone checks

Run `pnpm test:flows:phone:check`. It checks installed tools and authorized Android devices without clearing or opening an app. A readiness result is not an E2E pass. This machine has Java, adb, and Maestro, but no connected Android device. Hardware virtualization is off, so an emulator is not available. iOS device tests need a macOS runner.

`TENDER_APP_ENV=e2e` selects `com.tender.companion.e2e`, a separate app package. The three prepared Maestro flows in `apps/mobile/.maestro/isolated` clear only this test package. They cover empty email, invalid email, and recovery navigation with local validation. They have not run on a phone. The existing older Maestro flows target the development package and are not part of this isolated suite.

Before phone execution, build and install the separate E2E package with synthetic configuration. Do not use production credentials or data. The current application requires HTTPS; full native login/upload tests still need a local HTTPS backend that the test device trusts. Do not weaken the production URL validation. A connected test device and a built APK are required before running the isolated Maestro folder. Portable Java is under `service-tools/jdk-21.0.12.1+1`; Maestro is under `service-tools/maestro/bin`.

Still open: physical camera/microphone/file picker, native upload cancellation/retry, encrypted files, phone sign-out cleanup, export/share sheets, phone account deletion, permissions, background behavior, push, biometrics, accessibility, native deep links, and external OAuth providers. Password replacement has a separate real-service integration suite. No personal stored password or passkey is used by either suite.

## CI

`.github/workflows/user-flows.yml` runs browser integration on Linux, native database/API/Auth integration on Windows, and Storage/account integration on Linux with Docker. Every job saves evidence even on failure. No hosted account or project secret is required. CI configuration is prepared; local evidence does not prove a GitHub run.

## Verified local run: 18 October 2026

## Password and Storage follow-up: 18 October 2026

Password run `8535fc1e-9196-4b4e-8a3f-a6fb6b6bb98a` passed all 20 cases in a fresh native service stack. Cleanup passed. Service run `5d2862a6-4f91-4812-9a9d-6859275bae03` also passed all 36 cases after the password-policy and explicit local database connection updates.

The real Storage job in [CI run 39172929482](https://github.com/ablackdeveloper/tender/actions/runs/39172929482) passed all 13 cases with cleanup verified. The run ID is `t-b7a37487-3d6b-4a6e-addd-19928fbfce6d`. An earlier CI attempt failed before any Storage case because Supabase truncates project IDs at 40 characters. IDs now retain a full UUID within that limit, so start, ownership checks, and cleanup use the same value. The failed attempt is not counted as evidence of passing tests or cleanup.

Fresh Windows CI also exposed a pgTAP setup error hidden by the local tool cache. Archive extraction now passes file paths directly to `tar`, without a PowerShell command-string argument boundary.

### Earlier complete local run

Run `91fbe625-92c1-47cb-b038-6731c3aa8fd1` passed in 6.1 minutes on Node 22.23.1: 145 browser scenarios, 34 database/API scenarios, 36 real Auth/email/account scenarios, 252 database assertions, and 8 harness checks. The invitation race passed. Service cleanup verified closed ports and removed the temporary database. Browser and earlier database/API cleanup also passed.

The report is `../feature-integration/artifacts/runs/91fbe625-92c1-47cb-b038-6731c3aa8fd1/summary.json`. TypeScript, the changed app-config lint check, Deno type checking, JavaScript syntax, formatting, and CI/phone YAML parsing passed. The setup script passed a repeat run. Storage and phone readiness checks returned blocked, with zero tests executed. No unit tests were added or run.
