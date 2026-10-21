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

`setup-native-api.ps1` also installs a private gettext 0.26 / iconv 1.17 runtime beside PostgREST. The EDB archive contains gettext 0.19.8, which has a [documented Windows threading crash](https://github.com/diesel-rs/diesel/discussions/2947). Archive and DLL hashes are pinned and checked. The system PostgreSQL installation is unchanged. Startup readiness has a 120-second deadline so fresh Auth migrations can finish on CI. This does not change test assertions or HTTP request timeouts.

## What the 36 service scenarios prove

| Area                   | Checks                                                                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login and email        | New signup, returning login, normalization, wrong code/email, consumed code, resend, expiry, delivered magic links, token-hash callbacks, and rejected link reuse                                                                        |
| PKCE and sessions      | Code exchange, missing verifier, reused code, refresh rotation, revoked refresh after sign-out, new-client session restore, and cleared session storage                                                                                  |
| Recovery and isolation | Recovery email/session, single-use recovery link, generic response for unknown email, invalid email, local SMTP rejection of external recipients, and real JWT database owner isolation                                                  |
| Account export         | Anonymous and invalid-token rejection, current-user-only records, audit record, and `Cache-Control: no-store`                                                                                                                            |
| Account deletion       | Five invalid confirmations, four invalid request bodies, exact confirmation, Auth removal, database cascades, revoked sessions, repeat deletion, preserved second user, and failure when either document or media removal is unavailable |

The app's production auth service and callback parser make real HTTP calls through the real Supabase SDK to Auth. The harness supplies the native redirect/browser boundaries and disables analytics. Deno runs the unchanged production account function. PostgreSQL runs every application migration. The SQL-only Auth fixture seed is deliberately excluded: all accounts are created through real Auth APIs.

The local SMTP inbox accepts only `@example.invalid`. It cannot relay mail. Delivered messages stay in memory and are cleared after each scenario. A test-only email template includes the real generated link and code. Rate limits are raised only for this disposable test server; these tests do not prove production rate-limit settings.

## Fresh data and cleanup

Each run starts a new PostgreSQL cluster, random loopback ports, and a new JWT signing key. Each scenario starts new users and clients. User deletion is checked through Auth. The inbox is cleared after every scenario. The final cleanup stops owned processes, removes the temporary database, and checks that every service port is closed. Only a complete set of 36 passing cases with verified cleanup can produce a passing service report.

Reports contain a run ID, each result, planned count, runtime limits, and cleanup status. They do not contain email contents, login codes, session tokens, or signing keys. A standalone report is in `../feature-integration/artifacts/service-runs/<run-id>/summary.json`. A full regression report includes `native-services/summary.json` under its own run directory. Failed and blocked runs are retained as evidence; they do not count as passes.

## Storage and full deletion

Run `pnpm test:flows:storage` on a host with a working Docker Linux engine. The runner creates a unique Supabase project in a temporary directory. It copies current migrations and the account function, disables fixture seeds, and uses only local API addresses. It never resets `tender-local` or reads application `.env` files. It removes that unique project's containers, volumes, users, and objects after the run.

The runner creates a separate Docker network with ports bound to loopback. It checks the port bindings before tests. The network, CLI state, and function process belong only to that run and are removed during cleanup. See the [Supabase local network setup](https://supabase.com/docs/guides/local-development).

The 15 scenarios cover both private buckets: upload/download bytes, replacement upload, denied unregistered upload, denied foreign reads/writes/deletes, pending-file privacy, owner removal, anonymous access, and full account deletion with files in both buckets. Two cases start with pending metadata, upload with create-only permission, reject a duplicate without changing the stored bytes, and verify owner access after the status becomes ready. They check durable object and account state, not just HTTP success. A second user's file must remain after deletion.

Storage scenarios have **not run on this computer**. Firmware virtualization is off and Docker's Linux engine is unavailable. The original 13 passed in [CI run 39174985847](https://github.com/ablackdeveloper/tender/actions/runs/39174985847), with cleanup verified. The two new pending-upload cases reproduced the native upload failure in run 39195145725 before the create-only fix. Current 15-case results must be read from the matching CI report. A local readiness failure remains separate from that CI result. See [Supabase runtime support](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes).

The native service suite does not have a real Storage HTTP server. It returns an explicit HTTP 503 for Storage requests to prove that the account function stops safely and preserves Auth and metadata. That result does not prove successful uploads or deletion of stored bytes.

## Phone checks

Run `pnpm test:flows:phone:check`. It checks installed tools and authorized Android devices without clearing or opening an app. A readiness result is not an E2E pass. This machine has Java, adb, and Maestro, but no connected Android device. Hardware virtualization is off, so an emulator is not available. iOS device tests need a macOS runner.

`pnpm test:flows:phone` runs the native harness in `scripts/phone-integration`. The `Native phone E2E` workflow provides a fresh Android 14 emulator, Java 21, verified Maestro 2.11.0, and Docker. The runner requires Node 22, `TENDER_NATIVE_E2E=1`, and the approved `TENDER_TEST_PASSWORD_SOURCE=disposable-generated` setting. It refuses physical devices and existing generated Android projects. Use a fresh Linux checkout. No cloud device service, hosted project, or store signing account is required.

The runner starts a new Supabase project with current migrations and no fixture seed. It creates an HTTPS proxy on loopback and a temporary certificate. Only the generated `com.tender.companion.e2e` package trusts that certificate for `localhost`. Production URL validation and device-wide trust are unchanged. The APK contains the production UI, services, native modules, and routing. No Metro service or mocked repository is used.

The local email inbox receives real Auth emails. Its test-only sign-in template includes the Auth-generated code with a fixed label, so code extraction cannot match a number in a URL. Password replacement follows the recovery email's real verification URL and opens the returned native redirect. This does not verify hosted email templates or external mail delivery.

The 19 cases cover first-use setup, empty/invalid email, email code login and rejection, recovery navigation/email/deep-link errors, recovery guards, password validation/replacement, session restart, sign-out confirmation/cancel, account deletion, document picker cancel/upload, the system export share sheet, and microphone permission denial. These are planned cases until a complete native run reports success. The older standalone Maestro files are not part of this runner.

Each case clears only the test package and creates new `.invalid` accounts through real Auth. Uploaded fixture files have unique names. Backend checks verify password behavior, persisted setup, stored document bytes, foreign-account denial, and account deletion. Case cleanup removes owned uploads/accounts/files, clears the app, and empties the run's local Mailpit inbox. The report records verified email cleanup, and the next case checks the inbox is still empty before creating an account. Final cleanup uninstalls the test package, removes the adb tunnel, closes HTTPS, and removes the run's containers, volumes, network, and temporary directory. A missing case or failed cleanup prevents a passing report.

Cases that start after setup use a separate client to call the production `complete_onboarding` function, verify the saved profile, and sign out that fixture session. The Android app must then authenticate itself. The first-use case completes setup through the native UI. This avoids marking a nonexistent profile as complete with an update that affects zero rows.

Each Android Maestro batch has a two-minute deadline. iOS batches have five minutes to include JVM startup and the three-minute XCTest driver startup window. The first iOS startup batch has eight minutes: a measured cold run spent almost five minutes starting the JVM and driver before its first UI assertion. UI assertion deadlines are unchanged. Routine device commands have a 20-second deadline; APK installation has two minutes. Failure diagnostics include a redacted log from the isolated iOS app process when available. Diagnostic capture cannot replace the original failure. A failed case cleanup stops the suite instead of allowing the next case to inherit uncertain state. Allow about 15–20 minutes for a cold Android CI build and another 15–20 minutes for the native cases. A cold iOS build and simulator setup can take 50 minutes before UI cases start.

Reports are stored in `scripts/feature-integration/artifacts/native-phone-runs/<run-id>/summary.json`. Disposable passwords remain in memory and enter the native form through Android's input service; they never enter Maestro files or logs. Raw Maestro files with one-time links/codes remain private and are removed with the temporary directory. Uploaded evidence contains build diagnostics, redacted failure logs, and selected failure screenshots. Screens with email codes are excluded. The public workflow does not upload the APK, private TLS key, or raw session data. Permissions start unset so the harness cannot silently grant a permission that a case is meant to test.

Still separate from emulator evidence: physical camera/microphone quality, interrupted media upload retry, inspection of encrypted device files, push delivery, enrolled biometrics, screen-reader and large-text acceptance, iOS, and external OAuth providers. Do not infer physical-device or store readiness from an emulator pass. No personal stored password or passkey is used.

## iOS simulator and physical phones

`pnpm test:flows:ios` uses the same 19 integration/E2E cases on macOS. The `iOS phone E2E` workflow uses a standard Intel macOS 26 runner, Xcode 26.6, Maestro 2.11.0, and an owned Colima Linux VM for local Supabase. No hosted backend, Apple account, signing certificate, or unit test is used. The simulator build includes the production app UI and services.

The workflow initializes Xcode before starting Docker and boots the simulator after compilation. On macOS, the CLI's short service-health deadline is replaced by a five-minute harness gate: every owned container must be healthy, and real Auth, database, and Storage API reads must succeed. The backend must contain no accounts or profiles, and both storage buckets must be private. No test starts before these checks pass. Cleanup deletes the owned Colima data disk as well as the VM and checks that both are gone. Pre-existing VM paths are refused and never claimed for cleanup.

The adapter creates and later deletes its own simulator. Before each case it reinstalls the test app, resets the simulator keychain, restores the run-only localhost certificate, resets permissions, and verifies empty app documents/cache directories. A separate small fixture app supplies synthetic documents to the real Files picker. It does not enable file sharing in the production app. Disposable passwords enter through the simulator clipboard and the native Paste action; the clipboard is cleared immediately. Password values never enter Maestro flow files.

Read the matching iOS CI report before claiming a pass. Syntax checks, an iOS build, or an Android pass do not prove iOS runtime behavior. A missing case or failed cleanup prevents success. The report includes the iOS runtime, Xcode version, app executable hash, individual case results, and cleanup result.

On 20 October 2026, the user confirmed that no physical phone is available. `pnpm test:flows:phone:check` is a read-only readiness check with zero tests executed. The execution adapters still refuse physical devices. Physical Android work requires an authorized dedicated test phone and a device adapter that clears only the test package. Physical iPhone work requires a Mac, a signed isolated app, and a physical-device driver; the pinned Maestro release supports iOS simulators only. Do not point the existing staging IPA at these tests: its backend is not isolated.

Physical camera/microphone quality, secure storage inspection, background recovery, push, biometrics, and accessibility acceptance remain blocked until a test phone is available. No phone installation or physical acceptance is claimed by simulator results.

## CI

`.github/workflows/user-flows.yml` runs browser integration on Linux, native database/API/Auth/password integration on Windows, and Storage/account integration on Linux with Docker. Jobs upload available reports even on failure. No hosted account or project secret is required. See the run-specific evidence below; a local pass alone does not prove a GitHub run.

The regression jobs passed again in [CI run 39190367905](https://github.com/ablackdeveloper/tender/actions/runs/39190367905) at commit `7b04b85`. The downloaded reports confirm 36 service cases, 20 password cases, and 13 Storage cases, with cleanup verified. The browser and database/API jobs also passed. These results do not replace the separate Android E2E result.

## Password and Storage follow-up: 18 October 2026

Password run `8535fc1e-9196-4b4e-8a3f-a6fb6b6bb98a` passed all 20 cases in a fresh native service stack. Cleanup passed. Service run `5d2862a6-4f91-4812-9a9d-6859275bae03` also passed all 36 cases after the password-policy and explicit local database connection updates.

The real Storage job in [CI run 39172929482](https://github.com/ablackdeveloper/tender/actions/runs/39172929482) passed all 13 cases with cleanup verified. The run ID is `t-b7a37487-3d6b-4a6e-addd-19928fbfce6d`. An earlier CI attempt failed before any Storage case because Supabase truncates project IDs at 40 characters. IDs now retain a full UUID within that limit, so start, ownership checks, and cleanup use the same value. The failed attempt is not counted as evidence of passing tests or cleanup.

Fresh Windows CI also exposed a pgTAP setup error hidden by the local tool cache. Archive extraction now passes file paths directly to `tar`, without a PowerShell command-string argument boundary.

### Earlier complete local run

Run `91fbe625-92c1-47cb-b038-6731c3aa8fd1` passed in 6.1 minutes on Node 22.23.1: 145 browser scenarios, 34 database/API scenarios, 36 real Auth/email/account scenarios, 252 database assertions, and 8 harness checks. The invitation race passed. Service cleanup verified closed ports and removed the temporary database. Browser and earlier database/API cleanup also passed.

The report is `../feature-integration/artifacts/runs/91fbe625-92c1-47cb-b038-6731c3aa8fd1/summary.json`. TypeScript, the changed app-config lint check, Deno type checking, JavaScript syntax, formatting, and CI/phone YAML parsing passed. The setup script passed a repeat run. Storage and phone readiness checks returned blocked, with zero tests executed. No unit tests were added or run.
