import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import net from "node:net";
import {
  ensurePostgres,
  executable,
  reservePort,
  run,
  runSqlFile,
  spawnSql,
  removeCluster,
} from "../run-native-postgres-integration.mjs";
import { startMailSink } from "./mail-sink.mjs";

export const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const tools = path.join(
  workspace,
  "scripts/feature-integration/artifacts/service-tools",
);
const requireMobile = createRequire(
  path.join(workspace, "apps/mobile/package.json"),
);
const { createClient } = requireMobile("@supabase/supabase-js");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createServiceHarness({
  passwords = false,
  plannedScenarios = 36,
} = {}) {
  assert.equal(
    process.versions.node.split(".")[0],
    "22",
    "Use the pinned Node 22 runtime",
  );
  const runId = process.env.FLOW_RUN_ID ?? randomUUID();
  const output = process.env.FLOW_RUN_DIR
    ? path.join(
        process.env.FLOW_RUN_DIR,
        passwords ? "native-passwords" : "native-services",
      )
    : path.join(
        workspace,
        passwords
          ? "scripts/feature-integration/artifacts/password-runs"
          : "scripts/feature-integration/artifacts/service-runs",
        runId,
      );
  mkdirSync(output, { recursive: true });
  const report = {
    runId,
    status: "running",
    runtime: "windows-native-auth-deno",
    startedAt: new Date().toISOString(),
    results: [],
    plannedScenarios,
    cleanup: false,
    storage: "unavailable",
    phone: "not-run",
    limits: [
      "No real Storage server; object-removal failures are injected as HTTP 503",
      "Deno runs the production account handler; hosted Edge gateway is not exercised",
      passwords
        ? "Password replacement uses the production service with real Auth; native form and keyboard are not exercised"
        : "Password replacement is covered by the separate password suite",
      "OAuth providers, native device storage and phone UI are not exercised",
    ],
  };
  const save = () =>
    writeFileSync(
      path.join(output, "summary.json"),
      JSON.stringify(report, null, 2),
    );
  save();
  const children = [];
  const clients = [];
  const ports = [];
  let cluster,
    dbStarted = false,
    mail,
    proxy,
    dbPort;
  let closing;
  const close = () => (closing ??= stop());
  async function stop() {
    const errors = [];
    for (const client of clients) client.auth.stopAutoRefresh();
    for (const child of children.reverse()) {
      try {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill();
          await Promise.race([
            once(child, "close"),
            pause(10000).then(() => {
              throw new Error("Service failed to stop");
            }),
          ]);
        }
      } catch (e) {
        errors.push(e.message);
      }
    }
    if (proxy) {
      proxy.closeAllConnections();
      await new Promise((resolve) => proxy.close(resolve));
    }
    if (mail) await mail.close().catch((e) => errors.push(e.message));
    if (dbStarted) {
      try {
        run(executable("pg_ctl"), [
          "-D",
          path.join(cluster, "data"),
          "-w",
          "-t",
          "30",
          "-m",
          "immediate",
          "stop",
        ]);
      } catch (e) {
        errors.push(e.message);
      }
    }
    if (cluster) {
      try {
        removeCluster(cluster);
      } catch (e) {
        errors.push(e.message);
      }
    }
    for (const port of ports) {
      try {
        await new Promise((resolve, reject) => {
          const socket = net.connect({ host: "127.0.0.1", port });
          socket.once("connect", () => {
            socket.destroy();
            reject(new Error(`Port ${port} remains open`));
          });
          socket.once("error", (error) =>
            error.code === "ECONNREFUSED" ? resolve() : reject(error),
          );
          socket.setTimeout(1000, () => {
            socket.destroy();
            reject(new Error(`Port ${port} cleanup check timed out`));
          });
        });
      } catch (error) {
        errors.push(error.message);
      }
    }
    report.cleanup = errors.length === 0;
    if (errors.length) report.cleanupErrors = errors;
    report.finishedAt = new Date().toISOString();
    report.status =
      report.cleanup &&
      report.results.length === report.plannedScenarios &&
      report.results.every((r) => r.status === "passed") &&
      !report.setupError
        ? "passed"
        : "failed";
    save();
    console.log(`Service report: ${path.join(output, "summary.json")}`);
    return report;
  }
  function service(exe, args, env, cwd) {
    // Exclude all application/provider credentials from child environments.
    const base = Object.fromEntries(
      Object.entries(process.env).filter(([k]) =>
        /^(systemroot|windir|temp|tmp|pathext|userprofile|localappdata|appdata)$/i.test(
          k,
        ),
      ),
    );
    base.PATH = process.env.PATH ?? process.env.Path ?? "";
    const child = spawn(exe, args, {
      cwd,
      env: { ...base, ...env },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.log = "";
    child.on("error", (e) => {
      child.log += e.message;
    });
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (c) => {
        child.log = (child.log + c).slice(-12000);
      });
    children.push(child);
    return child;
  }
  async function ready(url, child, name) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null)
        throw new Error(`${name} exited (${child.exitCode}): ${child.log}`);
      try {
        if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok)
          return;
      } catch {}
      await pause(150);
    }
    throw new Error(
      `${name} startup timed out after 120 seconds: ${child.log}`,
    );
  }
  try {
    for (const file of ["auth.exe", "deno.exe", "auth-2.197.0/migrations"])
      assert.ok(
        existsSync(path.join(tools, file)),
        `Run scripts/service-integration/setup.ps1 first: ${file}`,
      );
    await ensurePostgres();
    cluster = mkdtempSync(
      path.join(tmpdir(), "tender-postgres-integration-services-"),
    );
    dbPort = await reservePort();
    run(
      executable("initdb"),
      [
        "-D",
        path.join(cluster, "data"),
        "-U",
        "postgres",
        "--auth=trust",
        "--encoding=UTF8",
        "--locale=C",
      ],
      { capture: true },
    );
    run(executable("pg_ctl"), [
      "-D",
      path.join(cluster, "data"),
      "-l",
      path.join(cluster, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${dbPort} -F`,
      "-w",
      "-t",
      "60",
      "start",
    ]);
    dbStarted = true;
    ports.push(dbPort);
    const sql = async (source) => {
      const result = await spawnSql(source, dbPort);
      if (result.code !== 0) throw new Error(result.stderr);
      return result.stdout;
    };
    // Auth owns its REAL schema. The native path has only a Storage SQL contract;
    // it must never claim to test successful uploads or stored-object deletion.
    const bootstrap = readFileSync(
      path.join(
        workspace,
        "supabase/tests/integration/native-supabase-bootstrap.sql",
      ),
      "utf8",
    )
      .replace(/create table auth\.users \([\s\S]*?\n\);/, "")
      .replace("alter table auth.users enable row level security;", "")
      .replace("grant all on table auth.users to service_role;", "");
    await sql(bootstrap);
    await sql(
      "create role service_auth_admin login superuser; alter role service_auth_admin set search_path = auth, public, extensions;",
    );
    mail = await startMailSink();
    ports.push(mail.port);
    const authPort = await reservePort(),
      restPort = await reservePort(),
      functionPort = await reservePort();
    ports.push(authPort, restPort, functionPort);
    const secret = randomBytes(48).toString("base64url");
    function jwt(role) {
      const body = [
        Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
          "base64url",
        ),
        Buffer.from(
          JSON.stringify({
            role,
            iss: "supabase",
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ).toString("base64url"),
      ].join(".");
      return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
    }
    const anonKey = jwt("anon"),
      serviceKey = jwt("service_role");
    proxy = createServer((req, res) => {
      if (req.url === "/test-email-template") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          '<a href="{{ .ConfirmationURL }}">Continue</a><p>TEST_CODE:{{ .Token }}</p>',
        );
        return;
      }
      const route = [
        ["/auth/v1", authPort],
        ["/rest/v1", restPort],
        ["/functions/v1/account-data", functionPort],
      ].find(
        ([prefix]) =>
          req.url === prefix ||
          req.url.startsWith(`${prefix}/`) ||
          req.url.startsWith(`${prefix}?`),
      );
      if (!route) {
        res.writeHead(req.url.startsWith("/storage/v1/") ? 503 : 404);
        res.end('{"error":"service_unavailable_in_native_harness"}');
        return;
      }
      const upstream = request(
        {
          hostname: "127.0.0.1",
          port: route[1],
          method: req.method,
          path: req.url.slice(route[0].length) || "/",
          headers: { ...req.headers, host: `127.0.0.1:${route[1]}` },
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    });
    proxy.listen(0, "127.0.0.1");
    await once(proxy, "listening");
    const apiUrl = `http://127.0.0.1:${proxy.address().port}`;
    ports.push(proxy.address().port);
    const authEnv = {
      GOTRUE_API_HOST: "127.0.0.1",
      PORT: String(authPort),
      API_EXTERNAL_URL: `${apiUrl}/auth/v1`,
      GOTRUE_DB_DRIVER: "postgres",
      DATABASE_URL: `postgresql://service_auth_admin@127.0.0.1:${dbPort}/postgres?sslmode=disable`,
      GOTRUE_DB_NAMESPACE: "auth",
      GOTRUE_SITE_URL: `${apiUrl}/callback`,
      GOTRUE_URI_ALLOW_LIST: `${apiUrl}/callback,tender://auth/callback`,
      GOTRUE_JWT_SECRET: secret,
      GOTRUE_JWT_EXP: "3600",
      GOTRUE_JWT_AUD: "authenticated",
      GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
      GOTRUE_JWT_ADMIN_ROLES: "service_role",
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
      GOTRUE_EXTERNAL_PHONE_ENABLED: "false",
      GOTRUE_DISABLE_SIGNUP: "false",
      GOTRUE_MAILER_AUTOCONFIRM: "false",
      GOTRUE_PASSWORD_MIN_LENGTH: "12",
      GOTRUE_PASSWORD_REQUIRED_CHARACTERS:
        "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'/\"|<>?,.`~",
      GOTRUE_SMTP_HOST: "127.0.0.1",
      GOTRUE_SMTP_PORT: String(mail.port),
      GOTRUE_SMTP_ADMIN_EMAIL: "test@example.invalid",
      GOTRUE_SMTP_SENDER_NAME: "Isolated tests",
      GOTRUE_SMTP_MAX_FREQUENCY: "1ms",
      GOTRUE_RATE_LIMIT_EMAIL_SENT: "10000",
      GOTRUE_RATE_LIMIT_VERIFY: "10000",
      GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "10000",
      GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: "true",
      GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: "0",
      GOTRUE_MAILER_OTP_EXP: "3600",
      LOG_LEVEL: "error",
      ...Object.fromEntries(
        [
          "CONFIRMATION",
          "RECOVERY",
          "MAGIC_LINK",
          "EMAIL_CHANGE",
          "INVITE",
        ].map((k) => [
          `GOTRUE_MAILER_TEMPLATES_${k}`,
          `${apiUrl}/test-email-template`,
        ]),
      ),
      ...Object.fromEntries(
        [
          "CONFIRMATION",
          "RECOVERY",
          "MAGIC_LINK",
          "EMAIL_CHANGE",
          "INVITE",
        ].map((k) => [`GOTRUE_MAILER_URLPATHS_${k}`, "/auth/v1/verify"]),
      ),
    };
    console.log("Starting real Auth and applying its migrations...");
    const auth = service(
      path.join(tools, "auth.exe"),
      [],
      authEnv,
      path.join(tools, "auth-2.197.0"),
    );
    await ready(`${apiUrl}/auth/v1/health`, auth, "Auth");
    await sql("grant all on auth.users to service_role;");
    // Never load the SQL-only auth fixture seed into the real Auth schema.
    for (const name of readdirSync(path.join(workspace, "supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      runSqlFile(path.join(workspace, "supabase/migrations", name), dbPort, {
        capture: true,
      });
    await sql(
      "create role service_test_authenticator login noinherit; grant anon,authenticated,service_role to service_test_authenticator;",
    );
    console.log("Starting PostgREST for the isolated database...");
    const rest = service(
      path.join(
        workspace,
        "scripts/feature-integration/artifacts/native-api-tools/postgrest.exe",
      ),
      [],
      {
        PGRST_DB_URI: `postgresql://service_test_authenticator@127.0.0.1:${dbPort}/postgres?sslmode=disable`,
        PGRST_DB_SCHEMAS: "public",
        PGRST_DB_ANON_ROLE: "anon",
        PGRST_DB_EXTRA_SEARCH_PATH: "public,extensions",
        PGRST_SERVER_HOST: "127.0.0.1",
        PGRST_SERVER_PORT: String(restPort),
        PGRST_JWT_SECRET: secret,
        PGRST_DB_POOL: "4",
        PGRST_LOG_LEVEL: "warn",
        PATH: `${path.dirname(executable("postgres"))}${path.delimiter}${process.env.PATH ?? process.env.Path}`,
      },
      cluster,
    );
    await ready(`${apiUrl}/rest/v1/`, rest, "PostgREST");
    const edge = service(
      path.join(tools, "deno.exe"),
      [
        "run",
        "--no-config",
        "--cached-only",
        "--no-prompt",
        `--import-map=${path.join(workspace, "scripts/service-integration/import-map.json")}`,
        "--allow-env=SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,TEST_FUNCTION_PORT",
        "--allow-net=127.0.0.1",
        path.join(workspace, "scripts/service-integration/account-worker.ts"),
      ],
      {
        SUPABASE_URL: apiUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        TEST_FUNCTION_PORT: String(functionPort),
      },
      cluster,
    );
    for (let i = 0; i < 100; i++) {
      if (edge.exitCode !== null)
        throw new Error(`Account worker exited: ${edge.log}`);
      try {
        const r = await fetch(`${apiUrl}/functions/v1/account-data`, {
          method: "OPTIONS",
        });
        if (r.status === 204) break;
      } catch {}
      if (i === 99) throw new Error(`Account worker timeout: ${edge.log}`);
      await pause(100);
    }
    function client(options = {}) {
      const c = createClient(apiUrl, options.admin ? serviceKey : anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: Boolean(options.storage),
          detectSessionInUrl: false,
          flowType: options.pkce ? "pkce" : "implicit",
          storage: options.storage,
          storageKey: "isolated-auth",
        },
        global: {
          fetch: (url, init) => {
            assert.equal(
              new URL(url).origin,
              apiUrl,
              "Client request must stay in this test stack",
            );
            return fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
          },
        },
      });
      clients.push(c);
      return c;
    }
    const admin = client({ admin: true });
    const preflight = await admin.auth.admin.listUsers();
    if (preflight.error)
      throw new Error(`Auth database preflight failed: ${auth.log}`);
    report.services = {
      auth: "2.197.0 (Windows listener adapter)",
      deno: "2.9.7",
      sdk: "2.112.3",
      postgrest: "16.4",
    };
    save();
    console.log(
      "Fresh Auth + SMTP + PostgreSQL + PostgREST + production account handler are ready.",
    );
    return {
      apiUrl,
      anonKey,
      admin,
      client,
      mail,
      sql,
      report,
      output,
      storage: false,
      async scenario(name, fn) {
        const start = Date.now(),
          users = [];
        const fresh = async () => {
          const email = `flow-${randomUUID()}@example.invalid`;
          const c = client();
          assert.equal(
            (await c.auth.getSession()).data.session,
            null,
            "Each account starts without a session",
          );
          const { data, error } = await admin.auth.admin.createUser({
            email,
            email_confirm: true,
          });
          assert.ifError(error);
          users.push(data.user.id);
          return { email, id: data.user.id, client: c };
        };
        let failure;
        try {
          await fn({ fresh, users });
        } catch (e) {
          failure = e;
        } finally {
          for (const id of users) {
            const found = await admin.auth.admin.getUserById(id);
            if (found.data.user) {
              const removed = await admin.auth.admin.deleteUser(id);
              if (removed.error) failure ??= removed.error;
            }
            const check = await admin.auth.admin.getUserById(id);
            if (check.data.user || (check.error && check.error.status !== 404))
              failure ??= new Error(
                "Scenario user cleanup could not be verified",
              );
          }
          mail.messages.length = 0;
        }
        const result = {
          name,
          status: failure ? "failed" : "passed",
          durationMs: Date.now() - start,
          ...(failure
            ? {
                error: String(failure.message).replace(
                  /eyJ[\w.-]+/g,
                  "[token]",
                ),
              }
            : {}),
        };
        report.results.push(result);
        save();
        console.log(
          `${failure ? "FAIL" : "PASS"} ${name}${failure ? `: ${result.error}` : ""}`,
        );
      },
      close,
    };
  } catch (e) {
    report.setupError = String(e.message).replace(/eyJ[\w.-]+/g, "[token]");
    await close();
    throw e;
  }
}
