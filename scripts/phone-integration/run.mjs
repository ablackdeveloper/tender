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
const adb = (...args) =>
  command("adb", ["-s", serial, ...args], {
    timeout: args[0] === "install" ? 120000 : 20000,
  });
async function execute(
  file,
  args,
  { env = process.env, cwd = workspace, log, timeout = 1800000 } = {},
) {
  const child = spawn(file, args, {
    env,
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  const chunks = [];
  child.stdout.on("data", (b) => {
    chunks.push(b);
    if (stage === "Android APK build") {
      for (const line of b.toString().split(/\r?\n/))
        if (/^> Task :[A-Za-z0-9:_-]+(?: [A-Z-]+)?$/.test(line))
          console.log(line);
    }
  });
  child.stderr.on("data", (b) => chunks.push(b));
  let timer;
  let code;
  try {
    [code] = await Promise.race([
      once(child, "close"),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          try {
            if (process.platform !== "win32")
              process.kill(-child.pid, "SIGKILL");
            else child.kill("SIGKILL");
          } catch (error) {
            if (error.code !== "ESRCH") child.kill("SIGKILL");
          }
          child.stdout.destroy();
          child.stderr.destroy();
          // Do not wait for a close event from a stalled descendant or device.
          reject(new Error(`${path.basename(file)} timed out during ${stage}`));
        }, timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (log) writeFileSync(log, Buffer.concat(chunks));
  }
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
          const category = req.url.startsWith("/storage/v1/object/")
            ? "storage-object"
            : req.url.startsWith("/rest/v1/documents")
              ? "documents"
              : null;
          if (category) {
            console.log(
              `Native ${stage}: ${req.method} ${category} -> ${response.statusCode}`,
            );
            if (response.statusCode >= 400) {
              const parts = [];
              let size = 0;
              response.on("data", (chunk) => {
                size += chunk.length;
                if (size <= 8192) parts.push(chunk);
              });
              response.on("end", () => {
                try {
                  const code = JSON.parse(Buffer.concat(parts).toString()).code;
                  if (
                    typeof code === "string" &&
                    /^(?:[0-9A-Z]{5}|PGRST\d{3}|[a-z_]{3,64})$/.test(code)
                  )
                    console.error(
                      `Native ${stage}: ${category} error code ${code}`,
                    );
                } catch {
                  /* Never expose raw response bodies, paths, or headers. */
                }
              });
            }
          }
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
    '<network-security-config><base-config cleartextTrafficPermitted="false"><trust-anchors><certificates src="system"/></trust-anchors></base-config><domain-config cleartextTrafficPermitted="false"><domain includeSubdomains="false">localhost</domain><trust-anchors><certificates src="@raw/tender_test_ca"/></trust-anchors></domain-config></network-security-config>',
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
  // The cold native build can stall the emulator's launcher. Stop that system
  // process before UI checks; never suppress an ANR from the application itself.
  adb("shell", "am", "force-stop", "com.google.android.apps.nexuslauncher");
  const secrets = new Set();
  const redact = (value) => {
    let text = value;
    for (const secret of [...secrets].sort((a, b) => b.length - a.length))
      text = text.split(secret).join("[REDACTED]");
    return text.replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[JWT]",
    );
  };
  let sequence = 0;
  async function ui(commands) {
    commands = commands.flatMap((entry) =>
      entry.launchApp
        ? [
            entry,
            {
              runFlow: {
                when: { visible: "Pixel Launcher isn't responding" },
                commands: [{ tapOn: "Close app" }],
              },
            },
          ]
        : [entry],
    );
    // Passwords go through Android's input service without entering a Maestro
    // file or driver log. The app still receives normal native keyboard input.
    if (commands.some((entry) => entry.inputSecret !== undefined)) {
      let batch = [];
      for (const entry of commands) {
        if (entry.inputSecret === undefined) {
          batch.push(entry);
          continue;
        }
        secrets.add(entry.inputSecret);
        if (batch.length) await ui(batch);
        batch = [];
        assert.match(
          entry.inputSecret,
          /^[A-Za-z0-9!@#$]+$/,
          "Unsupported disposable password characters",
        );
        try {
          adb("shell", "input", "text", `'${entry.inputSecret}'`);
        } catch {
          throw new Error("Native password input failed");
        }
      }
      if (batch.length) await ui(batch);
      return;
    }
    for (const entry of commands) {
      if (entry.launchApp) entry.launchApp.permissions ??= { all: "unset" };
      if (typeof entry.inputText === "string") secrets.add(entry.inputText);
      if (entry.openLink?.link) {
        secrets.add(entry.openLink.link);
        const url = new URL(entry.openLink.link);
        for (const params of [
          url.searchParams,
          new URLSearchParams(url.hash.slice(1)),
        ])
          for (const key of [
            "access_token",
            "refresh_token",
            "token_hash",
            "code",
          ]) {
            const value = params.get(key);
            if (value) secrets.add(value);
          }
      }
    }
    const file = path.join(stack.root, `flow-${++sequence}.yaml`);
    console.log(
      `Native ${stage} step ${sequence}: ${commands.map((entry) => Object.keys(entry)[0]).join(", ")}`,
    );
    writeFileSync(
      file,
      `appId: ${appId}\n---\n${JSON.stringify(commands, null, 2)}\n`,
      { mode: 0o600 },
    );
    try {
      await execute(
        maestro,
        [
          "--device",
          serial,
          "test",
          "--debug-output",
          path.join(stack.root, `maestro-debug-${sequence}`),
          "--test-output-dir",
          path.join(stack.root, `maestro-${sequence}`),
          file,
        ],
        {
          log: path.join(stack.root, `maestro-${sequence}.log`),
          timeout: 120000,
        },
      );
      console.log(`Native ${stage} step ${sequence}: complete`);
    } catch (error) {
      const diagnostic = redact(
        readFileSync(path.join(stack.root, `maestro-${sequence}.log`), "utf8"),
      );
      writeFileSync(path.join(output, `${stage}-maestro.log`), diagnostic);
      console.error(
        diagnostic
          .split(/\r?\n/)
          .filter((line) =>
            /FAILED|Assertion is false|Element not found/.test(line),
          )
          .slice(-4)
          .join("\n"),
      );
      try {
        command(
          "adb",
          [
            "-s",
            serial,
            "shell",
            "uiautomator",
            "dump",
            "/sdcard/tender-e2e.xml",
          ],
          { timeout: 15000 },
        );
        writeFileSync(
          path.join(output, `${stage}-hierarchy.xml`),
          redact(adb("shell", "cat", "/sdcard/tender-e2e.xml")),
        );
      } catch {
        console.error(`Native ${stage}: UI hierarchy was unavailable`);
      } finally {
        try {
          command(
            "adb",
            ["-s", serial, "shell", "rm", "-f", "/sdcard/tender-e2e.xml"],
            { timeout: 10000 },
          );
        } catch {
          /* Final app/device cleanup still runs. */
        }
      }
      throw error;
    }
  }
  const clear = () =>
    assert.equal(adb("shell", "pm", "clear", appId).trim(), "Success");
  async function scenario(name, fn) {
    stage = name;
    console.log(`Native case: ${name}`);
    const users = [];
    const deviceFiles = [];
    const fixture = (extension, bytes) => {
      assert.ok(["pdf", "png"].includes(extension));
      const name = `tender-${randomUUID()}.${extension}`;
      const local = path.join(stack.root, name);
      const remote = `/sdcard/Download/${name}`;
      writeFileSync(local, bytes);
      deviceFiles.push(remote);
      adb("push", local, remote);
      adb(
        "shell",
        "am",
        "broadcast",
        "-a",
        "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d",
        `file://${remote}`,
      );
      return name;
    };
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
      secrets.add(email);
      secrets.add(password);
      users.push(user);
      if (complete) {
        const bootstrap = stack.client();
        const signedIn = await bootstrap.auth.signInWithPassword({
          email,
          password,
        });
        assert.ifError(signedIn.error);
        user.bootstrapSignedInAt = signedIn.data.user.last_sign_in_at;
        assert.ifError(
          (
            await bootstrap.rpc("complete_onboarding", {
              p_pregnancy_id: user.pregnancy,
              p_lmp_date: null,
              p_estimated_due_date: null,
              p_due_date_source: null,
              p_clinician_confirmed_at: null,
              p_timezone: "UTC",
              p_pregnancy_type: "unspecified",
              p_display_name: "Synthetic phone test",
              p_theme_preference: "system",
              p_measurement_system: "metric",
              p_editorial_updates_enabled: false,
              p_appointment_reminders_enabled: false,
              p_planning_reminders_enabled: false,
            })
          ).error,
        );
        const profile = await bootstrap
          .from("profiles")
          .select("id,onboarding_completed_at")
          .eq("id", user.id)
          .single();
        assert.ifError(profile.error);
        assert.equal(profile.data.id, user.id);
        assert.ok(profile.data.onboarding_completed_at);
        assert.ifError(
          (await bootstrap.auth.signOut({ scope: "local" })).error,
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
      await fn({ user, fresh, ui, adb, stack, appId, fixture });
      result.status = "passed";
    } catch (error) {
      result.failure = redact(error.message);
      console.error(`Native ${name}: ${result.failure}`);
      // Preserve only the last screenshot. Secrets are never included in logs or reports.
      if (!name.includes("code")) {
        try {
          adb("shell", "screencap", "-p", "/sdcard/tender-e2e.png");
          adb(
            "pull",
            "/sdcard/tender-e2e.png",
            path.join(output, `${name}.png`),
          );
        } catch {
          console.error(`Native ${name}: screenshot was unavailable`);
        } finally {
          try {
            adb("shell", "rm", "-f", "/sdcard/tender-e2e.png");
          } catch {
            /* The final cleanup remains required. */
          }
        }
      }
    } finally {
      try {
        clear();
        for (const file of deviceFiles) {
          assert.match(
            file,
            /^\/sdcard\/Download\/tender-[a-f0-9-]+\.(pdf|png)$/,
          );
          adb("shell", "rm", file);
          adb("shell", "test", "!", "-e", file);
        }
        for (const user of users) {
          for (const table of ["documents", "media_assets"]) {
            const assets = await stack.admin
              .from(table)
              .select("storage_bucket,storage_path")
              .eq("owner_id", user.id);
            assert.ifError(assets.error);
            for (const asset of assets.data) {
              assert.ifError(
                (
                  await stack.admin.storage
                    .from(asset.storage_bucket)
                    .remove([asset.storage_path])
                ).error,
              );
              assert.ok(
                (
                  await stack.admin.storage
                    .from(asset.storage_bucket)
                    .download(asset.storage_path)
                ).error,
              );
            }
          }
          const existing = await stack.admin.auth.admin.getUserById(user.id);
          if (existing.error) assert.equal(existing.error.status, 404);
          if (existing.data.user)
            assert.ifError(
              (await stack.admin.auth.admin.deleteUser(user.id)).error,
            );
          assert.equal(
            (await stack.admin.auth.admin.getUserById(user.id)).error?.status,
            404,
          );
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
      secrets.clear();
      save();
      console.log(`${name}: ${result.status}; cleanup=${result.cleanup}`);
    }
    assert.ok(
      result.cleanup,
      "Stop after failed case cleanup; do not reuse uncertain state",
    );
    assert.equal(
      result.status,
      "passed",
      `Stop after failed native case: ${name}`,
    );
  }
  stage = "native-startup";
  console.log(stage);
  await ui([
    { launchApp: { clearState: true } },
    {
      extendedWaitUntil: { visible: "Welcome to Flutterings", timeout: 30000 },
    },
  ]);
  const flows = [];
  await runFlows({ scenario: async (name, fn) => flows.push({ name, fn }) });
  assert.equal(flows.length, scenarioCount);
  assert.equal(new Set(flows.map(({ name }) => name)).size, scenarioCount);
  // Run device-boundary cases first to expose native failures before repeating
  // the longer account sequence. Every passing run still requires all 19 cases.
  const deviceCases = new Set([
    "document-picker-cancel",
    "document-upload-native-picker",
    "export-native-share-sheet",
    "microphone-permission-denial",
  ]);
  flows.sort(
    (a, b) => Number(deviceCases.has(b.name)) - Number(deviceCases.has(a.name)),
  );
  for (const flow of flows) await scenario(flow.name, flow.fn);
} catch (error) {
  if (error.cleanupFailed) report.setupCleanupFailed = true;
  report.error = `${stage}: ${error.message}`;
  console.error(report.error);
  if (installed && stage === "native-startup") {
    try {
      adb("shell", "screencap", "-p", "/sdcard/tender-e2e.png");
      adb(
        "pull",
        "/sdcard/tender-e2e.png",
        path.join(output, "native-startup.png"),
      );
      adb("shell", "rm", "/sdcard/tender-e2e.png");
    } catch {
      /* The failed report already records startup failure. */
    }
  }
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
    report.cleanup = !report.setupCleanupFailed;
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
