import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  cpSync,
} from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { once } from "node:events";
import { startStack, command, workspace } from "./stack.mjs";
import { reservePort } from "../run-native-postgres-integration.mjs";
import { runFlows, scenarioCount } from "./scenarios.mjs";

const appId = "com.tender.companion.e2e";
const runId = randomUUID();
const output = path.join(
  workspace,
  "scripts/feature-integration/artifacts/native-phone-runs",
  runId,
);
mkdirSync(output, { recursive: true });
const report = {
  runId,
  status: "running",
  kind: "android-native-e2e",
  plannedScenarios: scenarioCount,
  results: [],
  cleanup: false,
  startedAt: new Date().toISOString(),
  limits: [
    "Android emulator only; no physical device or iOS acceptance",
    "No live OAuth, push delivery, or enrolled biometrics",
  ],
};
const save = () =>
  writeFileSync(
    path.join(output, "summary.json"),
    JSON.stringify(report, null, 2),
  );
save();
let stack,
  server,
  serial,
  reversePort,
  installed = false;
let stage = "preflight";
const adb = (...args) => command("adb", ["-s", serial, ...args]);
async function execute(
  file,
  args,
  { env = process.env, cwd = workspace, log, timeout = 1800000 } = {},
) {
  const child = spawn(file, args, {
    env,
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
  const [code] = await once(child, "close");
  clearTimeout(timer);
  if (log) writeFileSync(log, Buffer.concat(chunks));
  assert.equal(
    code,
    0,
    `${path.basename(file)} failed during ${stage}; inspect the private diagnostic log`,
  );
}
try {
  assert.equal(process.versions.node.split(".")[0], "22");
  assert.equal(
    process.platform,
    "linux",
    "Use the Linux emulator CI job for now",
  );
  assert.equal(process.env.TENDER_TEST_PASSWORD_SOURCE, "disposable-generated");
  assert.equal(
    process.env.TENDER_NATIVE_E2E,
    "1",
    "Explicit native test opt-in required",
  );
  const devices = command("adb", ["devices"])
    .split(/\r?\n/)
    .filter((l) => /^emulator-\d+\s+device$/.test(l));
  assert.equal(
    devices.length,
    1,
    "Exactly one emulator is required; physical devices are never cleared",
  );
  serial = devices[0].split(/\s+/)[0];
  assert.equal(adb("shell", "getprop", "ro.kernel.qemu").trim(), "1");
  report.androidVersion = adb(
    "shell",
    "getprop",
    "ro.build.version.release",
  ).trim();
  const android = path.join(workspace, "apps/mobile/android");
  assert.ok(
    !existsSync(android),
    "Use a fresh checkout; existing native projects are preserved",
  );
  stage = "local backend setup";
  console.log(stage);
  stack = await startStack();
  reversePort = await reservePort();
  const key = path.join(stack.root, "tls.key"),
    cert = path.join(stack.root, "tls.pem");
  command("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "2",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ]);
  server = https.createServer(
    { key: readFileSync(key), cert: readFileSync(cert) },
    (req, res) => {
      // One owned backend only. No arbitrary destination or hosted fallback.
      const upstream = http.request(
        `${stack.apiUrl}${req.url}`,
        {
          method: req.method,
          headers: { ...req.headers, host: new URL(stack.apiUrl).host },
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.on("error", () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    },
  );
  server.listen(reversePort, "127.0.0.1");
  await once(server, "listening");
  adb("reverse", `tcp:${reversePort}`, `tcp:${reversePort}`);
  const env = {
    ...process.env,
    CI: "1",
    EXPO_NO_DOTENV: "1",
    TENDER_APP_ENV: "e2e",
    EXPO_PUBLIC_SUPABASE_URL: `https://localhost:${reversePort}`,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.anonKey,
    EXPO_PUBLIC_AUTH_APPLE_ENABLED: "false",
    EXPO_PUBLIC_AUTH_GOOGLE_ENABLED: "false",
    EXPO_PUBLIC_HEALTH_DATA_ENABLED: "false",
    EXPO_PUBLIC_REVIEWED_CONTENT_ENABLED: "false",
    EXPO_PUBLIC_VOICE_TRANSCRIPTION_ENABLED: "false",
  };
  for (const name of [
    "EXPO_PUBLIC_PRIVACY_POLICY_URL",
    "EXPO_PUBLIC_SUPPORT_URL",
  ])
    delete env[name];
  const app = path.join(workspace, "apps/mobile");
  stage = "Android prebuild";
  console.log(stage);
  await execute(
    "pnpm",
    ["exec", "expo", "prebuild", "--platform", "android", "--no-install"],
    { env, cwd: app, log: path.join(output, "prebuild.log") },
  );
  assert.match(
    readFileSync(path.join(android, "app/build.gradle"), "utf8"),
    /applicationId ['"]com\.tender\.companion\.e2e['"]/,
  );
  // Trust this run's certificate only in the generated E2E package. Never alter
  // the application URL validator, global device trust, or source manifest.
  const main = path.join(android, "app/src/main");
  mkdirSync(path.join(main, "res/raw"), { recursive: true });
  mkdirSync(path.join(main, "res/xml"), { recursive: true });
  cpSync(cert, path.join(main, "res/raw/tender_test_ca.pem"));
  writeFileSync(
    path.join(main, "res/xml/tender_test_network.xml"),
    '<network-security-config><base-config cleartextTrafficPermitted="false"><trust-anchors><certificates src="system"/></trust-anchors></base-config><domain-config cleartextTrafficPermitted="false"><domain>localhost</domain><trust-anchors><certificates src="@raw/tender_test_ca"/></trust-anchors></domain-config></network-security-config>',
  );
  const manifest = path.join(main, "AndroidManifest.xml");
  writeFileSync(
    manifest,
    readFileSync(manifest, "utf8").replace(
      "<application ",
      '<application android:networkSecurityConfig="@xml/tender_test_network" ',
    ),
  );
  stage = "Android APK build";
  console.log(stage);
  await execute(
    "bash",
    [
      "gradlew",
      ":app:assembleRelease",
      "-PreactNativeArchitectures=x86_64",
      "--no-daemon",
      "--max-workers=2",
    ],
    { env, cwd: android, log: path.join(output, "build.log") },
  );
  const apk = path.join(
    android,
    "app/build/outputs/apk/release/app-release.apk",
  );
  assert.ok(existsSync(apk));
  report.apkSha256 = createHash("sha256")
    .update(readFileSync(apk))
    .digest("hex");
  adb("install", "-r", apk);
  installed = true;
  assert.match(adb("shell", "pm", "path", appId), /^package:/);
  // No build artifacts or raw Maestro logs with test credentials are uploaded.
  const maestro = process.env.MAESTRO_BIN ?? "maestro";
  let sequence = 0;
  async function ui(commands) {
    const file = path.join(stack.root, `flow-${++sequence}.yaml`);
    writeFileSync(
      file,
      `appId: ${appId}\n---\n${JSON.stringify(commands, null, 2)}\n`,
      { mode: 0o600 },
    );
    await execute(
      maestro,
      [
        "--device",
        serial,
        "test",
        "--test-output-dir",
        path.join(stack.root, `maestro-${sequence}`),
        file,
      ],
      {
        log: path.join(stack.root, `maestro-${sequence}.log`),
        timeout: 240000,
      },
    );
  }
  const clear = () =>
    assert.equal(adb("shell", "pm", "clear", appId).trim(), "Success");
  async function scenario(name, fn) {
    stage = name;
    console.log(`Native case: ${name}`);
    const users = [];
    const result = { name, status: "failed", cleanup: false };
    const fresh = async ({ complete = true } = {}) => {
      const email = `phone-${randomUUID()}@example.invalid`,
        password = `Aa1!${randomBytes(24).toString("hex")}`;
      const created = await stack.admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ifError(created.error);
      const user = {
        id: created.data.user.id,
        email,
        password,
        pregnancy: randomUUID(),
      };
      users.push(user);
      if (complete) {
        assert.ifError(
          (
            await stack.admin
              .from("profiles")
              .update({
                onboarding_completed_at: new Date().toISOString(),
                display_name: "Synthetic phone test",
              })
              .eq("id", user.id)
          ).error,
        );
        assert.ifError(
          (
            await stack.admin
              .from("pregnancies")
              .insert({
                id: user.pregnancy,
                owner_id: user.id,
                timezone: "UTC",
                due_date_source: "unknown",
              })
          ).error,
        );
      }
      return user;
    };
    try {
      clear();
      const user = await fresh();
      await ui([
        { launchApp: { clearState: false } },
        {
          extendedWaitUntil: {
            visible: "Welcome to Flutterings",
            timeout: 30000,
          },
        },
      ]);
      await fn({ user, fresh, ui, adb, stack, appId });
      result.status = "passed";
    } catch (error) {
      result.failure =
        error.code === "ERR_ASSERTION"
          ? "UI or backend assertion failed"
          : "Native flow failed";
      // Preserve only the last screenshot. Secrets are never included in logs or reports.
      const shot = adb("exec-out", "screencap", "-p");
      // Binary screenshots are captured separately by adb below.
      void shot;
      command("adb", [
        "-s",
        serial,
        "shell",
        "screencap",
        "-p",
        "/sdcard/tender-e2e.png",
      ]);
      command("adb", [
        "-s",
        serial,
        "pull",
        "/sdcard/tender-e2e.png",
        path.join(output, `${name}.png`),
      ]);
      adb("shell", "rm", "/sdcard/tender-e2e.png");
    } finally {
      try {
        clear();
        for (const user of users) {
          const existing = await stack.admin.auth.admin.getUserById(user.id);
          if (existing.data.user)
            assert.ifError(
              (await stack.admin.auth.admin.deleteUser(user.id)).error,
            );
          assert.ok((await stack.admin.auth.admin.getUserById(user.id)).error);
          const rows = await stack.admin
            .from("profiles")
            .select("id")
            .eq("id", user.id);
          assert.ifError(rows.error);
          assert.equal(rows.data.length, 0);
        }
        result.cleanup = true;
      } catch {
        result.status = "failed";
        result.failure = "Case cleanup failed";
      }
      report.results.push(result);
      save();
      console.log(`${name}: ${result.status}; cleanup=${result.cleanup}`);
    }
  }
  await runFlows({ scenario });
} catch (error) {
  report.error = `${stage}: ${error.message}`;
  console.error(report.error);
} finally {
  try {
    if (installed) {
      adb("shell", "pm", "clear", appId);
      adb("uninstall", appId);
      assert.equal(adb("shell", "pm", "list", "packages", appId).trim(), "");
    }
    if (reversePort) adb("reverse", "--remove", `tcp:${reversePort}`);
    if (server) {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
    if (stack) await stack.close();
    report.cleanup = true;
  } catch {
    report.cleanup = false;
    report.cleanupError = "Owned test resources could not all be removed";
  }
  report.status =
    !report.error &&
    report.cleanup &&
    report.results.length === scenarioCount &&
    report.results.every((r) => r.status === "passed" && r.cleanup)
      ? "passed"
      : "failed";
  report.finishedAt = new Date().toISOString();
  save();
  console.log(`Native phone report: ${path.join(output, "summary.json")}`);
  if (report.status !== "passed") process.exitCode = 1;
}
