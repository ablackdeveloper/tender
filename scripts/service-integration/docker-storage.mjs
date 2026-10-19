// Real Supabase Storage/Edge integration. Never uses a hosted project or an
// existing local project. Windows needs Docker's Linux engine for this suite.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  existsSync,
  rmSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { once } from "node:events";
import { workspace } from "./harness.mjs";
import { reservePort } from "../run-native-postgres-integration.mjs";

assert.equal(process.versions.node.split(".")[0], "22");
const requireMobile = createRequire(
  path.join(workspace, "apps/mobile/package.json"),
);
const { createClient } = requireMobile("@supabase/supabase-js");
// The pinned CLI truncates project IDs at 40 characters. Keep the full UUID
// within that limit so startup, ownership checks, and stop use the same ID.
const id = `t-${randomUUID()}`;
assert.ok(id.length <= 40);
const output = path.join(
  workspace,
  "scripts/feature-integration/artifacts/storage-runs",
  id,
);
mkdirSync(output, { recursive: true });
const report = {
  runId: id,
  status: "running",
  results: [],
  cleanup: false,
  startedAt: new Date().toISOString(),
  runtime: "real-supabase-docker",
};
const save = () =>
  writeFileSync(
    path.join(output, "summary.json"),
    JSON.stringify(report, null, 2),
  );
save();
let root,
  attempted = false,
  networkCreated = false,
  functionProcess;
let cli;
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(path|pathext|systemroot|windir|home|userprofile|localappdata|appdata|temp|tmp|docker_host|docker_context|docker_config)$/i.test(
      key,
    ),
  ),
);
env.SUPABASE_TELEMETRY_DISABLED = "true";
function command(exe, args, options = {}) {
  const r = spawnSync(exe, args, {
    cwd: root ?? workspace,
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeout ?? 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.error || r.status !== 0)
    throw new Error(
      `${path.basename(exe)} ${args[0]} failed: ${r.error?.message ?? r.stderr?.slice(-2000) ?? r.status}`,
    );
  return r.stdout;
}
const supabase = (...args) =>
  command(cli, ["--workdir", root, ...args], {
    timeout: 20 * 60 * 1000,
  });
try {
  try {
    command("docker", ["info", "--format", "{{.OSType}}"]);
  } catch {
    report.status = "blocked";
    throw new Error(
      "Docker Linux engine is unavailable. No Storage tests ran.",
    );
  }
  assert.equal(
    command("docker", ["info", "--format", "{{.OSType}}"]).trim(),
    "linux",
  );
  // Own the actual process, rather than a Node wrapper with an orphan child.
  const cliRequire = createRequire(
    realpathSync(
      path.join(workspace, "node_modules/supabase/dist/supabase.js"),
    ),
  );
  const platform = process.platform === "win32" ? "windows" : process.platform;
  cli = path.join(
    path.dirname(
      cliRequire.resolve(
        `@supabase/cli-${platform}-${process.arch}/package.json`,
      ),
    ),
    "bin",
    process.platform === "win32" ? "supabase.exe" : "supabase",
  );
  root = mkdtempSync(path.join(tmpdir(), "tender-storage-flow-"));
  env.SUPABASE_HOME = path.join(root, "cli-state");
  const project = path.join(root, "supabase");
  mkdirSync(project);
  cpSync(
    path.join(workspace, "supabase/migrations"),
    path.join(project, "migrations"),
    { recursive: true },
  );
  cpSync(
    path.join(workspace, "supabase/functions/account-data"),
    path.join(project, "functions/account-data"),
    { recursive: true },
  );
  cpSync(
    path.join(workspace, "scripts/service-integration/import-map.json"),
    path.join(project, "functions/import_map.json"),
  );
  const api = await reservePort(),
    db = await reservePort(),
    shadow = await reservePort(),
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
enabled = false
[storage]
enabled = true
file_size_limit = "50MiB"
[auth]
enabled = true
site_url = "http://127.0.0.1:${api}"
enable_signup = true
[auth.email]
enable_signup = true
enable_confirmations = true
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
  networkCreated = true;
  attempted = true;
  supabase("start", "--yes", "--network-id", id);
  const ownedContainers = command("docker", [
    "ps",
    "-q",
    "--filter",
    `name=${id}`,
  ])
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  assert.ok(
    ownedContainers.length > 0,
    "The new local project must own containers",
  );
  for (const container of JSON.parse(
    command("docker", ["inspect", ...ownedContainers]),
  )) {
    for (const bindings of Object.values(
      container.NetworkSettings.Ports ?? {},
    )) {
      for (const binding of bindings ?? [])
        assert.ok(
          ["127.0.0.1", "::1"].includes(binding.HostIp),
          "Published test ports must bind only to loopback",
        );
    }
  }
  const status = JSON.parse(supabase("status", "--output", "json"));
  const apiUrl = status.API_URL;
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname));
  const clients = [];
  const client = (key) => {
    const c = createClient(apiUrl, key ?? status.ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
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
  functionProcess = spawn(
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
    { cwd: root, env, windowsHide: true, stdio: "ignore" },
  );
  let functionError;
  functionProcess.on("error", (error) => {
    functionError = error;
  });
  let functionReady = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (functionError) throw functionError;
    if (functionProcess.exitCode !== null)
      throw new Error("Function server exited during startup");
    try {
      const result = await fetch(`${apiUrl}/functions/v1/account-data`, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(1000),
      });
      if (result.status === 204) {
        functionReady = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(functionReady, "Production account function must be ready");
  const payload = Buffer.from(
    "%PDF-1.4\nSynthetic integration bytes only\n%%EOF",
  );
  async function scenario(name, fn) {
    const users = [],
      objects = [];
    let failure;
    const fresh = async () => {
      const email = `storage-${randomUUID()}@example.invalid`;
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      assert.ifError(created.error);
      users.push(created.data.user.id);
      const c = client();
      const link = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      assert.ifError(link.error);
      const verified = await c.auth.verifyOtp({
        token_hash: link.data.properties.hashed_token,
        type: "magiclink",
      });
      assert.ifError(verified.error);
      const pregnancy = randomUUID();
      const inserted = await c.from("pregnancies").insert({
        id: pregnancy,
        owner_id: created.data.user.id,
        timezone: "UTC",
        due_date_source: "unknown",
      });
      assert.ifError(inserted.error);
      return { id: created.data.user.id, client: c, pregnancy };
    };
    const register = async (user, bucket, status = "ready") => {
      const asset = randomUUID(),
        key = `${asset}/${randomUUID()}.${bucket === "tender-media" ? "jpg" : "pdf"}`;
      const row = {
        id: asset,
        owner_id: user.id,
        pregnancy_id: user.pregnancy,
        storage_bucket: bucket,
        storage_path: key,
        mime_type: bucket === "tender-media" ? "image/jpeg" : "application/pdf",
        byte_size: payload.length,
        upload_status: status,
      };
      const table = bucket === "tender-media" ? "media_assets" : "documents";
      if (table === "documents")
        Object.assign(row, {
          title: "Synthetic document",
          document_type: "other",
        });
      else {
        row.journal_entry_id = randomUUID();
        const entry = await user.client.from("journal_entries").insert({
          id: row.journal_entry_id,
          owner_id: user.id,
          pregnancy_id: user.pregnancy,
          body: "Synthetic memory",
          privacy_level: "private",
        });
        assert.ifError(entry.error);
      }
      const inserted = await user.client.from(table).insert(row);
      assert.ifError(inserted.error);
      objects.push({ bucket, key });
      return { key, table, id: asset, mime: row.mime_type };
    };
    try {
      await fn({ fresh, register });
    } catch (e) {
      failure = e;
    } finally {
      for (const object of objects) {
        const r = await admin.storage.from(object.bucket).remove([object.key]);
        if (r.error) failure ??= r.error;
        const gone = await admin.storage
          .from(object.bucket)
          .download(object.key);
        if (!gone.error) failure ??= new Error("Object remains after cleanup");
      }
      for (const user of users) {
        const found = await admin.auth.admin.getUserById(user);
        if (found.data.user) {
          const r = await admin.auth.admin.deleteUser(user);
          if (r.error) failure ??= r.error;
        }
        const check = await admin.auth.admin.getUserById(user);
        if (check.data.user || (check.error && check.error.status !== 404))
          failure ??= new Error("User cleanup not verified");
      }
    }
    report.results.push({
      name,
      status: failure ? "failed" : "passed",
      ...(failure ? { error: failure.message } : {}),
    });
    save();
    console.log(`${failure ? "FAIL" : "PASS"} ${name}`);
  }
  for (const bucket of ["tender-documents", "tender-media"]) {
    await scenario(
      `${bucket}-pending-first-upload-and-ready`,
      async ({ fresh, register }) => {
        const user = await fresh();
        const object = await register(user, bucket, "pending");
        const storage = user.client.storage.from(bucket);
        // Match the native upload request while the record is still pending.
        assert.ifError(
          (
            await storage.upload(object.key, payload, {
              contentType: object.mime,
              upsert: false,
            })
          ).error,
        );
        assert.ok((await storage.download(object.key)).error);
        const stored = await admin.storage.from(bucket).download(object.key);
        assert.ifError(stored.error);
        assert.deepEqual(Buffer.from(await stored.data.arrayBuffer()), payload);
        // An uncertain retry cannot overwrite an unreadable pending object.
        const repeated = await storage.upload(
          object.key,
          Buffer.from("different bytes"),
          {
            contentType: object.mime,
            upsert: false,
          },
        );
        assert.ok(repeated.error);
        const preserved = await admin.storage.from(bucket).download(object.key);
        assert.ifError(preserved.error);
        assert.deepEqual(
          Buffer.from(await preserved.data.arrayBuffer()),
          payload,
        );
        assert.ifError(
          (
            await user.client
              .from(object.table)
              .update({ upload_status: "ready" })
              .eq("id", object.id)
          ).error,
        );
        const ready = await storage.download(object.key);
        assert.ifError(ready.error);
        assert.deepEqual(Buffer.from(await ready.data.arrayBuffer()), payload);
      },
    );
    await scenario(
      `${bucket}-upload-download-and-upsert`,
      async ({ fresh, register }) => {
        const u = await fresh(),
          o = await register(u, bucket);
        const s = u.client.storage.from(bucket);
        assert.ifError(
          (await s.upload(o.key, payload, { contentType: o.mime })).error,
        );
        assert.deepEqual(
          Buffer.from(await (await s.download(o.key)).data.arrayBuffer()),
          payload,
        );
        const replacement = Buffer.concat([payload, Buffer.from("retry")]);
        assert.ifError(
          (
            await s.upload(o.key, replacement, {
              contentType: o.mime,
              upsert: true,
            })
          ).error,
        );
        assert.deepEqual(
          Buffer.from(await (await s.download(o.key)).data.arrayBuffer()),
          replacement,
        );
      },
    );
    await scenario(
      `${bucket}-rejects-unregistered-upload`,
      async ({ fresh }) => {
        const u = await fresh();
        assert.ok(
          (
            await u.client.storage
              .from(bucket)
              .upload(
                `${randomUUID()}/${randomUUID()}.${bucket === "tender-media" ? "jpg" : "pdf"}`,
                payload,
                {
                  contentType:
                    bucket === "tender-media"
                      ? "image/jpeg"
                      : "application/pdf",
                },
              )
          ).error,
        );
      },
    );
    await scenario(
      `${bucket}-blocks-other-user-read-write-delete`,
      async ({ fresh, register }) => {
        const owner = await fresh(),
          stranger = await fresh(),
          o = await register(owner, bucket);
        assert.ifError(
          (
            await owner.client.storage
              .from(bucket)
              .upload(o.key, payload, { contentType: o.mime })
          ).error,
        );
        assert.ok(
          (await stranger.client.storage.from(bucket).download(o.key)).error,
        );
        assert.ok(
          (
            await stranger.client.storage
              .from(bucket)
              .upload(o.key, Buffer.from("foreign"), {
                upsert: true,
                contentType: o.mime,
              })
          ).error,
        );
        await stranger.client.storage.from(bucket).remove([o.key]);
        assert.deepEqual(
          Buffer.from(
            await (
              await owner.client.storage.from(bucket).download(o.key)
            ).data.arrayBuffer(),
          ),
          payload,
        );
      },
    );
    await scenario(
      `${bucket}-pending-object-remains-private`,
      async ({ fresh, register }) => {
        const u = await fresh(),
          o = await register(u, bucket);
        assert.ifError(
          (
            await u.client.storage
              .from(bucket)
              .upload(o.key, payload, { contentType: o.mime })
          ).error,
        );
        assert.ifError(
          (
            await u.client
              .from(o.table)
              .update({ upload_status: "pending" })
              .eq("id", o.id)
          ).error,
        );
        assert.ok((await u.client.storage.from(bucket).download(o.key)).error);
        assert.ifError(
          (
            await u.client
              .from(o.table)
              .update({ upload_status: "ready" })
              .eq("id", o.id)
          ).error,
        );
        assert.ifError(
          (await u.client.storage.from(bucket).download(o.key)).error,
        );
      },
    );
    await scenario(
      `${bucket}-owner-can-remove-object`,
      async ({ fresh, register }) => {
        const u = await fresh(),
          o = await register(u, bucket);
        assert.ifError(
          (
            await u.client.storage
              .from(bucket)
              .upload(o.key, payload, { contentType: o.mime })
          ).error,
        );
        assert.ifError(
          (await u.client.storage.from(bucket).remove([o.key])).error,
        );
        assert.ok((await admin.storage.from(bucket).download(o.key)).error);
      },
    );
    await scenario(
      `${bucket}-anonymous-download-is-denied`,
      async ({ fresh, register }) => {
        const u = await fresh(),
          o = await register(u, bucket);
        assert.ifError(
          (
            await u.client.storage
              .from(bucket)
              .upload(o.key, payload, { contentType: o.mime })
          ).error,
        );
        assert.ok((await client().storage.from(bucket).download(o.key)).error);
        const publicUrl = u.client.storage.from(bucket).getPublicUrl(o.key)
          .data.publicUrl;
        assert.equal(new URL(publicUrl).origin, new URL(apiUrl).origin);
        assert.ok(!(await fetch(publicUrl)).ok);
      },
    );
  }
  await scenario(
    "account-deletion-removes-both-buckets-and-auth",
    async ({ fresh, register }) => {
      const owner = await fresh(),
        stranger = await fresh(),
        objects = [];
      for (const bucket of ["tender-media", "tender-documents"]) {
        const o = await register(owner, bucket);
        assert.ifError(
          (
            await owner.client.storage
              .from(bucket)
              .upload(o.key, payload, { contentType: o.mime })
          ).error,
        );
        objects.push({ bucket, ...o });
      }
      const preserved = await register(stranger, "tender-documents");
      assert.ifError(
        (
          await stranger.client.storage
            .from("tender-documents")
            .upload(preserved.key, payload, { contentType: preserved.mime })
        ).error,
      );
      const result = await owner.client.functions.invoke("account-data", {
        body: { action: "deleteAccount", confirmation: "DELETE" },
      });
      assert.ifError(result.error);
      assert.equal(result.data.status, "deleted");
      for (const o of objects) {
        assert.ok((await admin.storage.from(o.bucket).download(o.key)).error);
        const rows = await admin.from(o.table).select("id").eq("id", o.id);
        assert.ifError(rows.error);
        assert.equal(rows.data.length, 0);
      }
      assert.ok((await admin.auth.admin.getUserById(owner.id)).error);
      assert.ifError(
        (
          await stranger.client.storage
            .from("tender-documents")
            .download(preserved.key)
        ).error,
      );
    },
  );
  for (const c of clients) c.auth.stopAutoRefresh();
  report.status =
    report.results.length === 15 &&
    report.results.every((r) => r.status === "passed")
      ? "passed"
      : "failed";
} catch (e) {
  report.error = e.message;
  if (report.status !== "blocked") report.status = "failed";
  console.error(e.message);
} finally {
  try {
    if (functionProcess && functionProcess.exitCode === null) {
      functionProcess.kill();
      await Promise.race([
        once(functionProcess, "close"),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Function process did not stop")),
            10000,
          ),
        ),
      ]);
    }
    if (attempted) {
      supabase("stop", "--project-id", id, "--no-backup");
      const containers = command("docker", [
        "ps",
        "-a",
        "--filter",
        `name=${id}`,
        "--format",
        "{{.Names}}",
      ]);
      const volumes = command("docker", [
        "volume",
        "ls",
        "--filter",
        `name=${id}`,
        "--format",
        "{{.Name}}",
      ]);
      assert.equal(containers.trim(), "");
      assert.equal(volumes.trim(), "");
    }
    if (networkCreated) {
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
      assert.equal(
        command("docker", [
          "network",
          "ls",
          "--filter",
          `name=${id}`,
          "--format",
          "{{.Name}}",
        ]).trim(),
        "",
      );
    }
    if (root) {
      assert.equal(path.dirname(root), path.resolve(tmpdir()));
      assert.ok(path.basename(root).startsWith("tender-storage-flow-"));
      rmSync(root, { recursive: true, force: true });
      assert.ok(!existsSync(root));
    }
    report.cleanup = true;
  } catch (e) {
    report.cleanupError = e.message;
    report.status = "failed";
  }
  report.finishedAt = new Date().toISOString();
  save();
  console.log(`Storage report: ${path.join(output, "summary.json")}`);
  if (report.status !== "passed")
    process.exitCode = report.status === "blocked" ? 2 : 1;
}
