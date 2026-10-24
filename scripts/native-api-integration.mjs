// Real Windows PostgREST + PostgreSQL + production repository integration.
// Auth identities/JWTs are synthetic. No GoTrue, Storage HTTP, or Edge runtime is claimed.
import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { verifyPostgrestRuntime } from "./postgrest-runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const version = "16.4";
const archiveHash =
  "29a5b56e5a09b7168bb552ef14aa7ade40bf0a81dd0687cffa86610187b89d78";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

// Transpile the actual repository modules. Only the client connection and native UUID
// implementation are supplied by the harness; queries and business rules are unchanged.
function repositories(workspace, client) {
  const requireMobile = createRequire(
    path.join(workspace, "apps/mobile/package.json"),
  );
  const ts = requireMobile("typescript");
  const cache = new Map();
  const src = path.join(workspace, "apps/mobile/src");
  function load(file) {
    file = path.resolve(file);
    if (!path.extname(file))
      file = existsSync(`${file}.ts`)
        ? `${file}.ts`
        : path.join(file, "index.ts");
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const localRequire = (name) => {
      if (name === "@/services/supabase/client") return { supabase: client };
      // This run has no approved editorial service; the live HTTPS-only app config
      // is not relaxed to accept a loopback HTTP test server.
      if (name === "@/config/env")
        return {
          getClientEnv: () => ({ EXPO_PUBLIC_REVIEWED_CONTENT_ENABLED: false }),
        };
      if (name === "expo-crypto") return { randomUUID };
      if (name.startsWith("@/")) return load(path.join(src, name.slice(2)));
      if (name === "@tender/domain")
        return load(path.join(workspace, "packages/domain/src/index.ts"));
      if (name.startsWith("."))
        return load(path.resolve(path.dirname(file), name));
      return createRequire(file)(name);
    };
    const result = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: file,
    });
    new vm.Script(
      `(function(require,module,exports){${result.outputText}\n})`,
      { filename: file },
    ).runInThisContext()(localRequire, module, module.exports);
    return module.exports;
  }
  return Object.assign(
    {},
    ...[
      "care",
      "journal",
      "home-preferences",
      "today-journey",
      "pregnancy-lifecycle",
      "meal",
      "check-in",
      "planning",
      "notification-preferences",
    ].map((name) => load(path.join(src, `repositories/${name}-repository.ts`))),
    ...["journal", "meal", "check-in"].map((name) =>
      load(path.join(src, `schemas/${name}.ts`)),
    ),
    load(path.join(src, "features/meals/draft-state.ts")),
    load(path.join(src, "features/check-in/draft-state.ts")),
  );
}

export async function runNativeApiIntegration({
  workspace,
  port,
  postgresBin,
  sql,
}) {
  const output = process.env.FLOW_RUN_DIR
    ? path.join(process.env.FLOW_RUN_DIR, "native-api")
    : path.join(workspace, "scripts/feature-integration/artifacts/native-api");
  const tools = path.join(
    workspace,
    "scripts/feature-integration/artifacts/native-api-tools",
  );
  const archive = path.join(tools, `postgrest-v${version}-windows-x86-64.zip`);
  const exe = path.join(tools, "postgrest.exe");
  verifyPostgrestRuntime(workspace);
  if (!existsSync(archive) || !existsSync(exe))
    throw new Error(
      "Install the pinned Windows PostgREST archive using scripts/setup-native-api.ps1 first.",
    );
  assert.equal(
    createHash("sha256").update(readFileSync(archive)).digest("hex"),
    archiveHash,
    "official archive checksum",
  );
  assert.equal(
    createHash("sha256").update(readFileSync(exe)).digest("hex"),
    "c4155000dfb0befb59215b65d61a621bbaea1515f36a6e758fc504c7ca0dcbee",
    "executable extracted from verified archive",
  );
  await mkdir(output, { recursive: true });
  const results = [];
  let rest,
    proxy,
    restExit,
    cleaned = false;
  const apiPort = await freePort();
  const secret = randomBytes(48).toString("base64url");
  const owner = randomUUID(),
    partner = randomUUID(),
    stranger = randomUUID();
  const pregnancy = randomUUID();
  const sign = (
    id,
    role = "authenticated",
    expires = Math.floor(Date.now() / 1000) + 300,
  ) => {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: id, role, exp: expires }),
    ).toString("base64url");
    const data = `${header}.${payload}`;
    return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
  };
  let logs = "";
  try {
    await sql(`create role native_api_authenticator login noinherit;
      grant anon, authenticated, service_role to native_api_authenticator;
      insert into auth.users(id,email,role,aud,email_confirmed_at) values
      ('${owner}','native-owner@example.invalid','authenticated','authenticated',now()),
      ('${partner}','native-partner@example.invalid','authenticated','authenticated',now()),
      ('${stranger}','native-stranger@example.invalid','authenticated','authenticated',now());`);
    rest = spawn(exe, [], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => key.toLowerCase() !== "path",
          ),
        ),
        PATH: `${postgresBin}${path.delimiter}${process.env.PATH ?? process.env.Path ?? ""}`,
        PGRST_DB_URI: `postgresql://native_api_authenticator@127.0.0.1:${port}/postgres?sslmode=disable`,
        PGRST_DB_SCHEMAS: "public",
        PGRST_DB_ANON_ROLE: "anon",
        PGRST_DB_EXTRA_SEARCH_PATH: "public,extensions",
        PGRST_SERVER_HOST: "127.0.0.1",
        PGRST_SERVER_PORT: String(apiPort),
        PGRST_JWT_SECRET: secret,
        PGRST_LOG_LEVEL: "warn",
        PGRST_DB_POOL: "4",
      },
    });
    restExit = once(rest, "exit");
    rest.stdout.on("data", (chunk) => {
      logs += chunk.toString();
    });
    rest.stderr.on("data", (chunk) => {
      logs += chunk.toString();
    });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (rest.exitCode !== null)
        throw new Error(
          `PostgREST exited before readiness (code ${rest.exitCode}, signal ${rest.signalCode}).`,
        );
      try {
        const response = await fetch(`http://127.0.0.1:${apiPort}/`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Start-up readiness only. */
      }
      await sleep(250);
    }
    assert.ok(ready, "PostgREST ready on loopback");
    // Supabase SDK uses /rest/v1. This proxy only removes that prefix; all requests
    // reach the real PostgREST process. Unsupported services return 404, never mocks.
    proxy = createServer(async (req, res) => {
      if (!req.url?.startsWith("/rest/v1/")) {
        res.writeHead(404).end();
        return;
      }
      try {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const headers = { ...req.headers };
        delete headers.host;
        const response = await fetch(
          `http://127.0.0.1:${apiPort}${req.url.slice(8)}`,
          {
            method: req.method,
            headers,
            body: ["GET", "HEAD"].includes(req.method)
              ? undefined
              : Buffer.concat(buffers),
            redirect: "manual",
            signal: AbortSignal.timeout(10000),
          },
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        res.writeHead(502).end();
      }
    });
    proxy.listen(0, "127.0.0.1");
    await once(proxy, "listening");
    const url = `http://127.0.0.1:${proxy.address().port}`;
    const requireMobile = createRequire(
      path.join(workspace, "apps/mobile/package.json"),
    );
    const { createClient } = requireMobile("@supabase/supabase-js");
    const client = (token) =>
      createClient(url, "native-test-only", {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          fetch: async (input, init) => {
            assert.equal(
              new URL(typeof input === "string" ? input : (input.url ?? input))
                .origin,
              url,
              "network is loopback-only",
            );
            return fetch(input, {
              ...init,
              signal: AbortSignal.timeout(10000),
            });
          },
        },
      });
    const ownerClient = client(sign(owner)),
      partnerClient = client(sign(partner)),
      strangerClient = client(sign(stranger));
    const service = client(sign(owner, "service_role"));
    const ownerRepo = repositories(workspace, ownerClient);
    const otherRepo = repositories(workspace, strangerClient);
    const ok = (result) => {
      assert.equal(result.error, null, result.error?.message);
      return result.data;
    };
    async function scenario(name, run) {
      try {
        await run();
        results.push({ name, passed: true });
        console.log(`PASS API ${name}`);
      } catch (error) {
        results.push({
          name,
          passed: false,
          error: error.message ?? error.code,
        });
        throw error;
      }
    }
    await scenario("jwt-signature-expiry-and-anonymous-denial", async () => {
      const token = sign(owner);
      for (const invalid of [
        token.slice(0, -8) + "invalid!",
        sign(owner, "authenticated", 1),
      ]) {
        const result = await client(invalid)
          .from("user_preferences")
          .select("owner_id");
        assert.equal(result.status, 401);
      }
      const response = await fetch(
        `http://127.0.0.1:${apiPort}/user_preferences?select=owner_id`,
      );
      assert.ok([401, 403].includes(response.status));
    });
    await scenario("undated-setup-through-http-rpc", async () => {
      ok(
        await ownerClient.rpc("complete_onboarding", {
          p_pregnancy_id: pregnancy,
          p_lmp_date: null,
          p_estimated_due_date: null,
          p_due_date_source: null,
          p_clinician_confirmed_at: null,
          p_timezone: "UTC",
          p_pregnancy_type: "unspecified",
          p_display_name: "",
          p_theme_preference: "system",
          p_measurement_system: "metric",
          p_editorial_updates_enabled: false,
          p_appointment_reminders_enabled: false,
          p_planning_reminders_enabled: false,
        }),
      );
      const today = await ownerRepo.todayJourneyRepository.getToday(owner);
      assert.equal(today.pregnancy.id, pregnancy);
      assert.equal(today.pregnancy.estimatedDueDate, null);
      assert.equal(today.pregnancy.dueDateSource, "unknown");
    });
    await scenario(
      "actual-repository-preferences-reconnect-and-owner-isolation",
      async () => {
        const choices = {
          focus: "memories",
          showWeeklyContent: false,
          showDueDate: false,
          showProgressCounts: true,
          showSizeComparisons: false,
        };
        await ownerRepo.homePreferencesRepository.save(owner, choices);
        const reconnected = repositories(workspace, client(sign(owner)));
        assert.deepEqual(
          await reconnected.homePreferencesRepository.get(owner),
          choices,
        );
        assert.deepEqual(
          ok(
            await strangerClient
              .from("user_preferences")
              .select("owner_id")
              .eq("owner_id", owner),
          ),
          [],
        );
        await assert.rejects(() =>
          otherRepo.homePreferencesRepository.save(owner, {
            ...choices,
            focus: "support",
          }),
        );
        await ownerRepo.homePreferencesRepository.setInitialFocus(
          owner,
          "care",
        );
        assert.deepEqual(await ownerRepo.homePreferencesRepository.get(owner), {
          ...choices,
          focus: "care",
        });
      },
    );
    let appointmentId;
    await scenario(
      "actual-care-repository-appointment-and-question",
      async () => {
        await ownerRepo.careRepository.addAppointment(owner, pregnancy, {
          title: "Native API visit",
          startsAt: new Date(Date.now() + 3600000).toISOString(),
          endsAt: null,
          timezone: "UTC",
          location: "Local fixture",
          providerId: null,
          reason: "",
        });
        const context = await ownerRepo.careRepository.getContext(
          owner,
          pregnancy,
        );
        assert.equal(context.appointments.length, 1);
        appointmentId = context.appointments[0].id;
        await ownerRepo.careRepository.addQuestion(
          owner,
          appointmentId,
          "A synthetic question",
          0,
          2,
        );
        const reconnected = repositories(workspace, client(sign(owner)));
        const result = await reconnected.careRepository.getContext(
          owner,
          pregnancy,
        );
        assert.equal(result.appointments[0].questions[0].priority, 2);
        assert.equal(
          (await otherRepo.careRepository.getContext(owner, pregnancy))
            .appointments.length,
          0,
        );
      },
    );
    let memory, memorySaved;
    await scenario(
      "actual-memory-repository-save-search-conflict",
      async () => {
        memory = {
          entryId: randomUUID(),
          pregnancyId: pregnancy,
          title: "Native API memory",
          body: "Synthetic keepsake",
          entryAt: new Date().toISOString(),
          baseServerUpdatedAt: null,
          isFavorite: false,
          privacy: "private",
          resurfaceAllowed: true,
          tagIds: [],
        };
        memorySaved = await ownerRepo.journalRepository.save(memory);
        assert.equal(memorySaved.status, "saved");
        const entries = await ownerRepo.journalRepository.listEntries(
          owner,
          pregnancy,
          { query: "keepsake", privacy: "private" },
        );
        assert.equal(entries.length, 1);
        const restored = ownerRepo.journalDraftSchema.parse(
          JSON.parse(JSON.stringify(ownerRepo.entryToDraft(entries[0]))),
        );
        assert.equal(restored.baseServerUpdatedAt, memorySaved.updatedAt);
        await ownerRepo.journalRepository.save({
          ...restored,
          body: "New synthetic text",
          baseServerUpdatedAt: memorySaved.updatedAt,
        });
        const stale = await ownerRepo.journalRepository.save({
          ...memory,
          body: "Stale synthetic text",
          baseServerUpdatedAt: memorySaved.updatedAt,
        });
        assert.equal(stale.status, "conflict");
        assert.equal(
          (await otherRepo.journalRepository.listEntries(owner, pregnancy))
            .length,
          0,
        );
      },
    );
    await scenario("meal-save-reopen-edit-and-conflict", async () => {
      const now = new Date().toISOString();
      let draft = ownerRepo.createMealDraft(
        pregnancy,
        randomUUID(),
        randomUUID(),
        now,
      );
      draft = ownerRepo.updateMealDraft(
        draft,
        {
          freeText: "Synthetic lunch",
          mealType: "lunch",
          occurredAt: now,
          ingredients: ["Synthetic ingredient"],
        },
        randomUUID(),
        now,
      );
      const saved = await ownerRepo.mealRepository.save(draft);
      assert.equal(saved.status, "saved");
      const fresh = repositories(workspace, client(sign(owner)));
      const filter = {
        mealType: null,
        appetiteResponse: null,
        wouldEatAgain: null,
      };
      const meals = await fresh.mealRepository.list(pregnancy, filter);
      assert.equal(meals.length, 1);
      const restored = fresh.mealDraftSchema.parse(
        JSON.parse(
          JSON.stringify({
            ...draft,
            baseServerUpdatedAt: meals[0].updatedAt,
            updatedAt: meals[0].updatedAt,
            values: meals[0],
          }),
        ),
      );
      assert.equal(restored.baseServerUpdatedAt, saved.updatedAt);
      const edited = fresh.updateMealDraft(
        restored,
        { freeText: "Updated lunch" },
        randomUUID(),
        now,
      );
      assert.equal((await fresh.mealRepository.save(edited)).status, "saved");
      assert.equal(
        (
          await fresh.mealRepository.save({
            ...edited,
            mutationId: randomUUID(),
          })
        ).status,
        "conflict",
      );
      assert.equal(
        (await fresh.mealRepository.list(pregnancy, filter))[0].freeText,
        "Updated lunch",
      );
      assert.equal(
        (await otherRepo.mealRepository.list(pregnancy, filter)).length,
        0,
      );
    });
    await scenario("check-in-complete-reopen-edit-and-conflict", async () => {
      const now = new Date().toISOString(),
        day = now.slice(0, 10);
      let draft = ownerRepo.createCheckInDraft(
        pregnancy,
        day,
        randomUUID(),
        now,
      );
      draft = ownerRepo.updateCheckInValues(
        draft,
        {
          ...draft.values,
          note: "Synthetic check-in",
          overallFeeling: "okay",
        },
        randomUUID(),
        now,
      );
      const saved = await ownerRepo.checkInRepository.sync(draft, true);
      assert.equal(saved.status, "applied");
      const local = ownerRepo.applyCheckInSyncResult(draft, saved, now);
      assert.equal(local.baseServerUpdatedAt, saved.updatedAt);
      assert.ok(local.completedAt);
      const fresh = repositories(workspace, client(sign(owner)));
      const restored = (await fresh.checkInRepository.getContext(owner, day))
        .serverDraft;
      assert.equal(restored.baseServerUpdatedAt, saved.updatedAt);
      assert.equal(restored.values.note, "Synthetic check-in");
      const edited = fresh.updateCheckInValues(
        restored,
        { ...restored.values, note: "Updated check-in" },
        randomUUID(),
        now,
      );
      assert.equal(
        (await fresh.checkInRepository.sync(edited, true)).status,
        "applied",
      );
      assert.equal(
        (
          await fresh.checkInRepository.sync(
            { ...edited, mutationId: randomUUID() },
            true,
          )
        ).status,
        "conflict",
      );
      assert.equal(
        (await fresh.checkInRepository.getContext(owner, day)).serverDraft
          .values.note,
        "Updated check-in",
      );
      assert.equal(
        await otherRepo.checkInRepository.getContext(owner, day),
        null,
      );
    });
    await scenario("partner-grant-and-revocation-over-real-api", async () => {
      assert.equal(
        ok(
          await partnerClient
            .from("appointments")
            .select("id")
            .eq("id", appointmentId),
        ).length,
        0,
      );
      const token = randomBytes(32).toString("base64url");
      const input = {
        p_actor_id: owner,
        p_pregnancy_id: pregnancy,
        p_email: "native-partner@example.invalid",
        p_role: "support_person",
        p_token_hash: createHash("sha256").update(token).digest("hex"),
        p_permissions: ["appointments.read"],
        p_expires_at: new Date(Date.now() + 86400000).toISOString(),
        p_email_hash: "a".repeat(64),
        p_ip_hash: "b".repeat(64),
        p_request_id: randomUUID(),
      };
      assert.ok(
        (await ownerClient.rpc("create_partner_invitation", input)).error,
        "client cannot call service invitation RPC",
      );
      assert.equal(
        ok(await service.rpc("create_partner_invitation", input)).accepted,
        true,
      );
      ok(
        await service.rpc("accept_partner_invitation", {
          p_actor_id: partner,
          p_raw_token: token,
          p_request_id: randomUUID(),
          p_ip_hash: "c".repeat(64),
        }),
      );
      assert.equal(
        ok(
          await partnerClient
            .from("appointments")
            .select("id")
            .eq("id", appointmentId),
        ).length,
        1,
      );
      assert.equal(
        ok(
          await partnerClient
            .from("journal_entries")
            .select("id")
            .eq("id", memory.entryId),
        ).length,
        0,
      );
      ok(
        await service.rpc("revoke_partner_access", {
          p_actor_id: owner,
          p_pregnancy_id: pregnancy,
          p_grantee_user_id: partner,
          p_request_id: randomUUID(),
          p_ip_hash: "d".repeat(64),
        }),
      );
      assert.equal(
        ok(
          await partnerClient
            .from("appointments")
            .select("id")
            .eq("id", appointmentId),
        ).length,
        0,
      );
    });
    await scenario(
      "compassionate-rules-through-repository-and-database",
      async () => {
        await ownerRepo.pregnancyLifecycleRepository.transition({
          pregnancyId: pregnancy,
          status: "active",
          compassionateMode: true,
          postpartumMode: false,
        });
        const today = await ownerRepo.todayJourneyRepository.getToday(owner);
        assert.equal(today.pregnancy.compassionateMode, true);
        assert.equal(today.experience.showWeeklyContent, false);
        assert.equal(today.experience.showCountdown, false);
        assert.equal(today.experience.showGestationalProgress, false);
        await assert.rejects(() =>
          ownerRepo.journalRepository.saveWeeklyCapsule({
            entryIds: [memory.entryId],
            ownerId: owner,
            pregnancyId: pregnancy,
            title: "Synthetic capsule",
            weekStart: "2026-10-12",
          }),
        );
      },
    );
    await scenario("appointment-delete-cascades-question", async () => {
      await ownerRepo.careRepository.remove(
        owner,
        "appointments",
        appointmentId,
      );
      assert.equal(
        (await ownerRepo.careRepository.getContext(owner, pregnancy))
          .appointments.length,
        0,
      );
      assert.equal(
        ok(
          await ownerClient
            .from("appointment_questions")
            .select("id")
            .eq("appointment_id", appointmentId),
        ).length,
        0,
      );
    });
    const { runApiUserFlows } = await import("./api-user-flows.mjs");
    await runApiUserFlows({
      scenario,
      sql,
      client,
      sign,
      repositories,
      workspace,
      ok,
    });
  } finally {
    if (proxy) {
      proxy.closeAllConnections();
      await new Promise((resolve) => proxy.close(resolve));
    }
    if (rest && rest.exitCode === null) {
      rest.kill();
      await restExit;
    }
    cleaned = true;
    await writeFile(path.join(output, "postgrest.log"), logs);
    await writeFile(
      path.join(output, "results.json"),
      JSON.stringify(
        {
          runId: process.env.FLOW_RUN_ID ?? null,
          postgrestVersion: version,
          boundary:
            "Real repository + SDK + HTTP + PostgREST + PostgreSQL; synthetic identities/JWTs; no Auth/Storage/Edge services",
          cleaned,
          results,
        },
        null,
        2,
      ),
    );
  }
}
