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
      `${path.basename(file)} failed (${r.status ?? r.error?.code}): ${diagnostic}`,
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
      cliRequire.resolve(`@supabase/cli-linux-${process.arch}/package.json`),
    ),
    "bin/supabase",
  );
  const supabase = (...args) =>
    command(cli, ["--workdir", root, ...args], { env, timeout: 600000 });
  let started = false,
    network = false,
    edge;
  const clients = [];
  async function close() {
    for (const c of clients) c.auth.stopAutoRefresh();
    if (edge && edge.exitCode === null) {
      edge.kill();
      await Promise.race([
        once(edge, "close"),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Edge stop timed out")),
            10000,
          ).unref(),
        ),
      ]);
    }
    if (started) {
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
    }
    if (network) {
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
    }
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("tender-phone-"));
    rmSync(root, { recursive: true, force: true });
    assert.ok(!existsSync(root));
  }
  try {
    assert.equal(
      command("docker", ["info", "--format", "{{.OSType}}"]).trim(),
      "linux",
    );
    mkdirSync(project);
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
    supabase("start", "--yes", "--network-id", id);
    const ids = command("docker", ["ps", "-q", "--filter", `name=${id}`])
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    assert.ok(ids.length);
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
    for (let i = 0; ; i++) {
      assert.ok(i < 120, "Edge startup timed out");
      const ready = await fetch(`${apiUrl}/functions/v1/account-data`, {
        method: "OPTIONS",
      }).catch(() => null);
      if (ready?.status === 204) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    return {
      id,
      root,
      apiUrl,
      anonKey: status.ANON_KEY,
      admin: client(status.SERVICE_ROLE_KEY),
      client,
      mailUrl: `http://127.0.0.1:${mail}`,
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
