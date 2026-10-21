import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { once } from "node:events";
import { reservePort } from "../run-native-postgres-integration.mjs";

export const workspace = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(workspace, "apps/mobile/package.json"));
const { createClient } = require("@supabase/supabase-js");
export function command(file, args, options = {}) {
  const r = spawnSync(file, args, {
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  // Never include arguments or raw output: both can contain disposable credentials.
  if (r.status !== 0) {
    const diagnostic = (r.stderr ?? "")
      .slice(-2000)
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[JWT]")
      .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[KEY]")
      .replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[DATABASE URL]");
    throw new Error(
      `${path.basename(file)} failed (${r.error?.code ?? r.status}): ${diagnostic}`,
    );
  }
  return r.stdout;
}
export async function startStack() {
  const id = `p-${randomUUID()}`;
  const root = mkdtempSync(path.join(tmpdir(), "tender-phone-"));
  const project = path.join(root, "supabase");
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) =>
        /^(PATH|HOME|TMPDIR|DOCKER_HOST|DOCKER_CONTEXT|DOCKER_CONFIG)$/i.test(
          key,
        ),
      ),
    ),
    SUPABASE_TELEMETRY_DISABLED: "true",
    SUPABASE_HOME: path.join(root, "cli-state"),
  };
  const cliRequire = createRequire(
    realpathSync(
      path.join(workspace, "node_modules/supabase/dist/supabase.js"),
    ),
  );
  const cli = path.join(
    path.dirname(
      cliRequire.resolve(
        `@supabase/cli-${process.platform}-${process.arch}/package.json`,
      ),
    ),
    "bin/supabase",
  );
  const supabase = (...args) =>
    command(cli, ["--workdir", root, ...args], {
      env,
      // The first macOS VM must pull and unpack the real service images.
      // Keep other commands bounded separately from this cold start.
      timeout:
        process.platform === "darwin" && args[0] === "start" ? 1200000 : 600000,
    });
  let started = false,
    network = false,
    edge;
  const clients = [];
  async function close() {
    const errors = [];
    const attempt = async (phase, action) => {
      try {
        await action();
      } catch (error) {
        errors.push(`${phase}: ${error.message}`);
      }
    };
    const edgeRunning = () =>
      edge?.pid && edge.exitCode === null && edge.signalCode === null;
    await attempt("Auth clients", async () => {
      await Promise.all(clients.map((c) => c.auth.stopAutoRefresh()));
    });
    await attempt("Edge process", async () => {
      if (!edgeRunning()) return;
      const exited = once(edge, "exit");
      const waitForExit = async () => {
        let timer;
        try {
          return await Promise.race([
            exited.then(() => true),
            new Promise((resolve) => {
              timer = setTimeout(() => resolve(false), 10000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      };
      edge.kill("SIGTERM");
      if (!(await waitForExit())) {
        // This is the exact CLI child created by this run, never a global PID
        // search. Forced termination is limited to the owned child process.
        edge.kill("SIGKILL");
        assert.ok(await waitForExit(), "Edge stop timed out after SIGKILL");
      }
      assert.ok(!edgeRunning(), "Edge process survived cleanup");
    });
    let backendRemoved = !started;
    if (started) {
      await attempt("Backend containers and volumes", () => {
        supabase("stop", "--project-id", id, "--no-backup");
        assert.equal(
          command("docker", [
            "ps",
            "-a",
            "--filter",
            `name=${id}`,
            "--format",
            "{{.Names}}",
          ]).trim(),
          "",
        );
        assert.equal(
          command("docker", [
            "volume",
            "ls",
            "--filter",
            `name=${id}`,
            "--format",
            "{{.Name}}",
          ]).trim(),
          "",
        );
        backendRemoved = true;
      });
    }
    if (network) {
      await attempt("Owned Docker network", () => {
        assert.equal(
          command("docker", [
            "network",
            "inspect",
            id,
            "--format",
            '{{index .Labels "com.tender.test.run"}}',
          ]).trim(),
          id,
        );
        command("docker", ["network", "rm", id]);
      });
    }
    await attempt("Owned temporary directory", () => {
      assert.ok(
        backendRemoved && !edgeRunning(),
        "Preserve files while owned services remain",
      );
      assert.equal(path.dirname(root), path.resolve(tmpdir()));
      assert.ok(path.basename(root).startsWith("tender-phone-"));
      rmSync(root, { recursive: true, force: true });
      assert.ok(!existsSync(root));
    });
    assert.equal(errors.length, 0, errors.join("; "));
  }
  try {
    assert.equal(
      command("docker", ["info", "--format", "{{.OSType}}"]).trim(),
      "linux",
    );
    mkdirSync(project);
    mkdirSync(path.join(project, "templates"));
    writeFileSync(
      path.join(project, "templates", "magic-link.html"),
      '<h2>Isolated phone sign-in</h2><p>TEST_CODE:{{ .Token }}</p><a href="{{ .ConfirmationURL }}">Sign in</a>',
    );
    for (const name of ["migrations", "functions/account-data"])
      cpSync(path.join(workspace, "supabase", name), path.join(project, name), {
        recursive: true,
      });
    cpSync(
      path.join(workspace, "scripts/service-integration/import-map.json"),
      path.join(project, "functions/import_map.json"),
    );
    const api = await reservePort(),
      db = await reservePort(),
      shadow = await reservePort(),
      mail = await reservePort(),
      inspector = await reservePort();
    writeFileSync(
      path.join(project, "config.toml"),
      `project_id = "${id}"
[api]
enabled = true
port = ${api}
schemas = ["public"]
extra_search_path = ["public", "extensions"]
[db]
port = ${db}
shadow_port = ${shadow}
major_version = 17
[db.seed]
enabled = false
[studio]
enabled = false
[realtime]
enabled = false
[local_smtp]
enabled = true
port = ${mail}
[storage]
enabled = true
file_size_limit = "50MiB"
[auth]
enabled = true
site_url = "tender://auth/callback"
additional_redirect_urls = ["tender://**"]
enable_signup = true
minimum_password_length = 12
password_requirements = "lower_upper_letters_digits_symbols"
[auth.rate_limit]
email_sent = 10000
token_verifications = 10000
sign_in_sign_ups = 10000
[auth.email]
enable_signup = true
enable_confirmations = true
max_frequency = "1s"
[auth.email.template.magic_link]
subject = "Isolated phone sign-in"
content_path = "./supabase/templates/magic-link.html"
[edge_runtime]
enabled = true
policy = "per_worker"
inspector_port = ${inspector}
[analytics]
enabled = false
[functions.account-data]
verify_jwt = true
`,
    );
    command("docker", [
      "network",
      "create",
      "--label",
      `com.tender.test.run=${id}`,
      "-o",
      "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
      id,
    ]);
    network = true;
    started = true;
    supabase(
      "start",
      "--yes",
      "--network-id",
      id,
      // Keep the slow Mac VM running past the CLI's short startup deadline.
      // The bounded checks below still require actual container and API health.
      ...(process.platform === "darwin" ? ["--ignore-health-check"] : []),
    );
    const ids = command("docker", ["ps", "-a", "-q", "--filter", `name=${id}`])
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    assert.ok(ids.length);
    const healthDeadline = Date.now() + 300000;
    for (;;) {
      const containers = JSON.parse(command("docker", ["inspect", ...ids]));
      const stopped = containers.filter(
        (container) => !container.State.Running || container.State.OOMKilled,
      );
      assert.equal(
        stopped.length,
        0,
        "An owned backend container stopped or ran out of memory",
      );
      const pending = containers.filter(
        (container) =>
          container.State.Health && container.State.Health.Status !== "healthy",
      );
      if (!pending.length) break;
      assert.ok(
        Date.now() < healthDeadline,
        `Backend health timed out: ${pending.map((container) => container.Name.replace(`_${id}`, "")).join(", ")}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    for (const c of JSON.parse(command("docker", ["inspect", ...ids])))
      for (const bindings of Object.values(c.NetworkSettings.Ports ?? {}))
        for (const b of bindings ?? [])
          assert.ok(["127.0.0.1", "::1"].includes(b.HostIp));
    const status = JSON.parse(supabase("status", "--output", "json"));
    const apiUrl = status.API_URL;
    assert.ok(["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname));
    const client = (key = status.ANON_KEY) => {
      const c = createClient(apiUrl, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (url, init) => {
            assert.equal(new URL(url).origin, new URL(apiUrl).origin);
            return fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
          },
        },
      });
      clients.push(c);
      return c;
    };
    const admin = client(status.SERVICE_ROLE_KEY);
    const apiDeadline = Date.now() + 300000;
    for (;;) {
      const [users, profiles, buckets] = await Promise.all([
        admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
        admin.from("profiles").select("id").limit(1),
        admin.storage.listBuckets(),
      ]);
      if (!users.error && !profiles.error && !buckets.error) {
        assert.equal(
          users.data.users.length,
          0,
          "The owned backend must start without accounts",
        );
        assert.equal(
          profiles.data.length,
          0,
          "The owned backend must start without profiles",
        );
        for (const bucket of ["tender-documents", "tender-media"])
          assert.equal(
            buckets.data.find((entry) => entry.id === bucket)?.public,
            false,
            "Required bucket must exist and be private",
          );
        break;
      }
      assert.ok(
        Date.now() < apiDeadline,
        "Auth, database, or Storage API readiness timed out",
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(
      "Local backend: containers healthy; Auth, database, and Storage ready; no accounts or profiles",
    );
    edge = spawn(
      cli,
      [
        "--workdir",
        root,
        "functions",
        "serve",
        "--import-map",
        path.join(project, "functions/import_map.json"),
        "--network-id",
        id,
      ],
      { cwd: root, env, stdio: "ignore" },
    );
    let edgeError;
    edge.on("error", (error) => {
      edgeError = error;
    });
    const edgeDeadline = Date.now() + 180000;
    for (;;) {
      if (edgeError) throw edgeError;
      assert.equal(edge.exitCode, null, "Edge server exited during startup");
      assert.ok(Date.now() < edgeDeadline, "Edge startup timed out");
      const ready = await fetch(`${apiUrl}/functions/v1/account-data`, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(3000),
      }).catch(() => null);
      if (ready?.status === 204) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    // This inbox is part of this run's owned backend, never a supplied endpoint.
    const mailUrl = `http://127.0.0.1:${mail}`;
    const mailRequest = async (options = {}) => {
      const response = await fetch(`${mailUrl}/api/v1/messages`, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      assert.equal(response.status, 200, "Owned test inbox API failed");
      return response;
    };
    const assertMailEmpty = async () => {
      const inbox = await (await mailRequest()).json();
      assert.equal(inbox.total, 0, "Test emails survived case cleanup");
      assert.deepEqual(inbox.messages, []);
    };
    const flushMail = async () => {
      // Mailpit deletes all messages when IDs is empty. The server is run-owned.
      await mailRequest({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ IDs: [] }),
      });
      await assertMailEmpty();
    };
    await assertMailEmpty();
    return {
      id,
      root,
      apiUrl,
      anonKey: status.ANON_KEY,
      admin,
      client,
      mailUrl,
      assertMailEmpty,
      flushMail,
      close,
    };
  } catch (error) {
    try {
      await close();
    } catch {
      error.cleanupFailed = true;
    }
    throw error;
  }
}
