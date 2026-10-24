# Tender isolated user-flow tests

This branch contains the app source and integration harness required for the user-flow CI jobs. It excludes local environment files, credentials, generated builds, personal documents, and test output.

Use Node 22 and pnpm 11.19.0. Run `pnpm install --frozen-lockfile`.

1. Browser flows: `pnpm test:flows:browser`.
2. Real Auth and account functions on Windows: follow `scripts/service-integration/README.md`.
3. Real Storage and account deletion on a Docker Linux runner: `pnpm test:flows:storage`.

Each run creates fresh data and verifies cleanup. No hosted Supabase project is used. The workflow does not run unit tests. Test reports are uploaded as short-lived CI artifacts.
