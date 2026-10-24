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
import { androidScenarioCount } from "./android-user-flows.mjs";
import { createIosDevice } from "./ios-device.mjs";
import { saveMaestroDiagnostics } from "./maestro-diagnostics.mjs";

const appId = "com.tender.companion.e2e";
const runId = randomUUID();
const platform = process.argv.includes("--ios")
  ? "ios"
  : (process.env.TENDER_NATIVE_PLATFORM ?? "android");
assert.ok(
  ["android", "ios"].includes(platform),
  "Unsupported native test platform",
);
const iosDevice = platform === "ios" ? createIosDevice({ runId, appId }) : null;
const maestro = process.env.MAESTRO_BIN ?? "maestro";
const shardValue = process.env.TENDER_ANDROID_SHARD;
assert.ok(
  !shardValue || (platform === "android" && /^[1-3]\/3$/.test(shardValue)),
);
const shard = shardValue ? Number(shardValue[0]) : null;
const output = path.join(
  workspace,
  "scripts/feature-integration/artifacts/native-phone-runs",
  runId,
);
mkdirSync(output, { recursive: true });
const report = {
  runId,
  status: "running",
  kind: `${platform}-native-e2e`,
  sourceSha: process.env.GITHUB_SHA ?? null,
  shard: shard ? { index: shard, count: 3 } : null,
  catalogScenarios:
    scenarioCount + (platform === "android" ? androidScenarioCount : 0),
  plannedScenarios:
    scenarioCount + (platform === "android" ? androidScenarioCount : 0),
  results: [],
  cleanup: false,
  startedAt: new Date().toISOString(),
  limits: [
    `${platform === "ios" ? "iOS simulator" : "Android emulator"} only; no physical device acceptance`,
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
  androidLaunchActivity,
  reversePort,
  installed = false;
let stage = "preflight";
const secrets = new Set();
const redact = (value) => {
  let text = value;
  for (const secret of [...secrets]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length))
    text = text.split(secret).join("[REDACTED]");
  return text
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[JWT]")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[KEY]");
};
const adb = (...args) =>
  command("adb", ["-s", serial, ...args], {
    timeout: args[0] === "install" ? 120000 : 20000,
  });
function saveAndroidCrash() {
  try {
    writeFileSync(
      path.join(output, `${stage}-android-crash.log`),
      redact(adb("logcat", "-d", "-b", "crash", "-v", "brief")),
    );
  } catch {
    console.error(`Native ${stage}: crash diagnostics were unavailable`);
  }
}
function saveIosDiagnostics() {
  try {
    writeFileSync(
      path.join(output, `${stage}-ios-app.log`),
      redact(iosDevice.diagnostics()).slice(-131072),
    );
  } catch {
    console.error(`Native ${stage}: iOS app diagnostics were unavailable`);
  }
}
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
    if (log) writeFileSync(log, redact(Buffer.concat(chunks).toString()));
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
    platform === "ios" ? "darwin" : "linux",
    "Use the matching isolated native CI job",
  );
  assert.equal(process.env.TENDER_TEST_PASSWORD_SOURCE, "disposable-generated");
  assert.equal(
    process.env.TENDER_NATIVE_E2E,
    "1",
    "Explicit native test opt-in required",
  );
  if (iosDevice) {
    iosDevice.prepare(report);
    serial = iosDevice.serial;
    // First boot performs OS data migration. Finish it before the local
    // backend and native compilation compete for this runner's resources.
    stage = "iOS runtime initialization";
    await iosDevice.boot({
      report,
      execute,
      output,
      label: "simulator-initialization",
    });
    stage = "iOS driver readiness";
    await iosDevice.checkDriver({ maestro, execute, output, report, redact });
    iosDevice.shutdown();
  } else {
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
  }
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
  if (!iosDevice) adb("reverse", `tcp:${reversePort}`, `tcp:${reversePort}`);
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
  if (iosDevice) {
    stage = "iOS simulator build";
    console.log(stage);
    await iosDevice.build({
      app,
      env,
      root: stack.root,
      cert,
      output,
      execute,
      report,
    });
    installed = true;
  } else {
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
    androidLaunchActivity = adb(
      "shell",
      "cmd",
      "package",
      "resolve-activity",
      "--components",
      "--user",
      "current",
      "-a",
      "android.intent.action.MAIN",
      "-c",
      "android.intent.category.LAUNCHER",
      "-p",
      appId,
    ).trim();
    assert.match(
      androidLaunchActivity,
      /^com\.tender\.companion\.e2e\/[.A-Za-z0-9_$]+$/,
      "Resolve exactly one launch activity from the installed test app",
    );
    report.androidLaunchActivity = androidLaunchActivity;
  }
  // No build artifacts or raw Maestro logs with test credentials are uploaded.
  // The cold native build can stall the emulator's launcher. Stop that system
  // process before UI checks; never suppress an ANR from the application itself.
  if (!iosDevice)
    adb("shell", "am", "force-stop", "com.google.android.apps.nexuslauncher");
  let sequence = 0;
  let focusedPasswordField;
  async function ui(commands) {
    if (!iosDevice && commands.some((entry) => entry.androidOpenLink)) {
      let batch = [];
      for (const entry of commands) {
        if (!entry.androidOpenLink) {
          batch.push(entry);
          continue;
        }
        if (batch.length) await ui(batch);
        batch = [];
        const url = entry.androidOpenLink;
        assert.match(url, /^tender:\/\/[a-z0-9/-]*$/);
        secrets.add(url);
        const log = path.join(
          output,
          `${stage}-android-link-${++sequence}.log`,
        );
        await execute(
          "adb",
          [
            "-s",
            serial,
            "shell",
            "am",
            "start",
            "-W",
            "-a",
            "android.intent.action.VIEW",
            "-d",
            url,
            "-p",
            appId,
          ],
          { log, timeout: 30000 },
        );
        assert.match(readFileSync(log, "utf8"), /^Status: ok\r?$/m);
      }
      if (batch.length) await ui(batch);
      return;
    }
    if (!iosDevice && commands.some((entry) => entry.launchApp)) {
      let batch = [];
      for (const entry of commands) {
        if (!entry.launchApp) {
          batch.push(entry);
          continue;
        }
        if (batch.length) await ui(batch);
        batch = [];
        assert.ok(
          Object.keys(entry.launchApp).every((key) => key === "clearState"),
          "Android launch options must not silently grant permissions",
        );
        if (entry.launchApp.clearState)
          assert.equal(adb("shell", "pm", "clear", appId).trim(), "Success");
        console.log(`Native ${stage}: Android activity launch`);
        const launchLog = path.join(output, `${stage}-android-launch.log`);
        // Keep the HTTPS proxy responsive while Android waits for the first frame.
        await execute(
          "adb",
          [
            "-s",
            serial,
            "shell",
            "am",
            "start",
            "-W",
            "-S",
            "-a",
            "android.intent.action.MAIN",
            "-c",
            "android.intent.category.LAUNCHER",
            "-n",
            androidLaunchActivity,
          ],
          { log: launchLog, timeout: 30000 },
        );
        const launched = readFileSync(launchLog, "utf8");
        assert.match(launched, /^Status: ok\r?$/m);
        assert.match(launched, /^Activity: com\.tender\.companion\.e2e\//m);
        // pm clear resets permissions for each fresh case. Launching through
        // Android leaves them unset and does not invoke driver permission grants.
        batch.push({
          runFlow: {
            when: { visible: "Pixel Launcher isn't responding" },
            commands: [{ tapOn: "Close app" }],
          },
        });
      }
      if (batch.length) await ui(batch);
      return;
    }
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
          if (iosDevice) {
            assert.match(focusedPasswordField ?? "", /^field-.*password$/);
            iosDevice.copySecret(entry.inputSecret);
            try {
              await ui([
                { longPressOn: { id: focusedPasswordField } },
                { tapOn: "Paste" },
              ]);
            } finally {
              iosDevice.copySecret("");
            }
          } else adb("shell", "input", "text", `'${entry.inputSecret}'`);
        } catch {
          throw new Error("Native password input failed");
        }
      }
      if (batch.length) await ui(batch);
      return;
    }
    for (const entry of commands) {
      if (entry.tapOn?.id?.includes("password"))
        focusedPasswordField = entry.tapOn.id;
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
      if (!iosDevice) {
        // A killed CLI can leave Android instrumentation registered. Stop only
        // the two test-driver packages before creating the next UI session.
        adb("shell", "am", "force-stop", "dev.mobile.maestro.test");
        adb("shell", "am", "force-stop", "dev.mobile.maestro");
      }
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
          env: iosDevice
            ? process.env
            : { ...process.env, MAESTRO_DRIVER_STARTUP_TIMEOUT: "60000" },
          log: path.join(stack.root, `maestro-${sequence}.log`),
          // A cold CI run needed almost five minutes before its first assertion.
          // Keep that startup budget separate; UI assertion deadlines stay fixed.
          timeout: iosDevice
            ? stage === "native-startup"
              ? 480000
              : 300000
            : 120000,
        },
      );
      console.log(`Native ${stage} step ${sequence}: complete`);
    } catch (error) {
      const diagnostic = redact(
        readFileSync(path.join(stack.root, `maestro-${sequence}.log`), "utf8"),
      );
      writeFileSync(path.join(output, `${stage}-maestro.log`), diagnostic);
      // Driver logs distinguish a failed assertion from a stalled app launch.
      // Copy text only, redact before truncating, and keep raw debug data private.
      try {
        saveMaestroDiagnostics({
          roots: [
            path.join(stack.root, `maestro-debug-${sequence}`),
            path.join(stack.root, `maestro-${sequence}`),
          ],
          output,
          prefix: `${stage}-driver`,
          redact,
        });
      } catch {
        console.error(`Native ${stage}: driver diagnostics were unavailable`);
      }
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
        if (iosDevice) {
          // A new Maestro session can launch its own driver app and change the
          // foreground screen. Capture the failed UI without starting a driver.
          if (!stage.includes("code"))
            iosDevice.screenshot(path.join(output, `${stage}.png`));
        } else {
          adb("shell", "am", "force-stop", "dev.mobile.maestro.test");
          adb("shell", "am", "force-stop", "dev.mobile.maestro");
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
        }
      } catch {
        console.error(`Native ${stage}: UI hierarchy was unavailable`);
      } finally {
        try {
          if (!iosDevice) {
            command(
              "adb",
              ["-s", serial, "shell", "rm", "-f", "/sdcard/tender-e2e.xml"],
              { timeout: 10000 },
            );
          }
        } catch {
          /* Final app/device cleanup still runs. */
        }
      }
      throw error;
    }
  }
  const clear = () =>
    iosDevice
      ? iosDevice.clear()
      : assert.equal(adb("shell", "pm", "clear", appId).trim(), "Success");
  async function scenario(name, fn) {
    stage = name;
    console.log(`Native case: ${name}`);
    const users = [];
    const deviceFiles = [];
    const fixture = (extension, bytes) => {
      if (iosDevice) return iosDevice.fixture(extension, bytes);
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
      await stack.assertMailEmpty();
      focusedPasswordField = undefined;
      if (!iosDevice) adb("logcat", "-c", "-b", "crash");
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
      if (iosDevice) saveIosDiagnostics();
      else saveAndroidCrash();
      // Preserve only the last screenshot. Secrets are never included in logs or reports.
      if (!name.includes("code")) {
        try {
          if (iosDevice) iosDevice.screenshot(path.join(output, `${name}.png`));
          else {
            adb("shell", "screencap", "-p", "/sdcard/tender-e2e.png");
            adb(
              "pull",
              "/sdcard/tender-e2e.png",
              path.join(output, `${name}.png`),
            );
          }
        } catch {
          console.error(`Native ${name}: screenshot was unavailable`);
        } finally {
          try {
            if (!iosDevice) {
              adb("shell", "rm", "-f", "/sdcard/tender-e2e.png");
            }
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
        await stack.flushMail();
        result.mailCleanup = true;
        result.cleanup = true;
      } catch {
        result.status = "failed";
        result.failure = "Case cleanup failed";
      }
      report.results.push(result);
      secrets.clear();
      save();
      console.log(`${name}: ${result.status}; cleanup=${result.cleanup}`);
      if (platform === "android" && process.env.GITHUB_ACTIONS === "true")
        console.log(
          `::notice title=Android E2E::${name}: ${result.status}; cleanup=${result.cleanup}`,
        );
    }
    assert.ok(
      result.cleanup,
      "Stop after failed case cleanup; do not reuse uncertain state",
    );
    if (platform === "ios")
      assert.equal(
        result.status,
        "passed",
        `Stop after failed native case: ${name}`,
      );
    // Android failures remain failed in the final report. Continue only after
    // verified cleanup so one selector failure does not hide later flow defects.
  }
  stage = "native-startup";
  console.log(stage);
  await ui([
    { launchApp: { clearState: !iosDevice } },
    {
      extendedWaitUntil: { visible: "Welcome to Flutterings", timeout: 30000 },
    },
  ]);
  const flows = [];
  await runFlows({
    platform,
    scenario: async (name, fn) => flows.push({ name, fn }),
  });
  assert.equal(flows.length, report.plannedScenarios);
  assert.equal(
    new Set(flows.map(({ name }) => name)).size,
    report.plannedScenarios,
  );
  // Run device-boundary cases first to expose native failures before repeating
  // the longer account sequence. Every passing run requires the full catalog.
  const deviceCases = new Set([
    "document-picker-cancel",
    "document-upload-native-picker",
    "export-native-share-sheet",
    "microphone-permission-denial",
  ]);
  flows.sort(
    (a, b) =>
      Number(b.name.startsWith("android-")) -
        Number(a.name.startsWith("android-")) ||
      Number(deviceCases.has(b.name)) - Number(deviceCases.has(a.name)),
  );
  const selected = shard
    ? flows.filter((_, index) => index % 3 === shard - 1)
    : flows;
  report.plannedScenarios = selected.length;
  report.selectedScenarios = selected.map(({ name }) => name);
  save();
  for (const flow of selected) await scenario(flow.name, flow.fn);
} catch (error) {
  if (error.cleanupFailed) report.setupCleanupFailed = true;
  report.error = `${stage}: ${error.message}`;
  console.error(report.error);
  if (installed && stage === "native-startup") {
    if (iosDevice) saveIosDiagnostics();
    else saveAndroidCrash();
    try {
      if (iosDevice)
        iosDevice.screenshot(path.join(output, "native-startup.png"));
      else {
        adb("shell", "screencap", "-p", "/sdcard/tender-e2e.png");
        adb(
          "pull",
          "/sdcard/tender-e2e.png",
          path.join(output, "native-startup.png"),
        );
        adb("shell", "rm", "/sdcard/tender-e2e.png");
      }
    } catch {
      /* The failed report already records startup failure. */
    }
  }
} finally {
  const cleanupErrors = [];
  const cleanup = async (phase, action) => {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push({ phase, error: redact(error.message) });
      console.error(`Native cleanup failed: ${phase}`);
    }
  };
  if (iosDevice) await cleanup("owned iOS simulator", () => iosDevice.close());
  else {
    if (installed)
      await cleanup("isolated Android app", () => {
        adb("shell", "pm", "clear", appId);
        adb("uninstall", appId);
        assert.equal(adb("shell", "pm", "list", "packages", appId).trim(), "");
      });
    if (reversePort)
      await cleanup("Android port forwarding", () =>
        adb("reverse", "--remove", `tcp:${reversePort}`),
      );
  }
  if (server)
    await cleanup("local HTTPS proxy", async () => {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    });
  if (stack) await cleanup("owned local backend", () => stack.close());
  report.cleanup =
    !report.setupCleanupFailed &&
    report.driverReadiness?.cleanup !== false &&
    cleanupErrors.length === 0;
  if (!report.cleanup) {
    report.cleanupError = "Owned test resources could not all be removed";
    report.cleanupFailures = cleanupErrors;
  }
  report.status =
    !report.error &&
    report.cleanup &&
    report.results.length === report.plannedScenarios &&
    report.results.every((r) => r.status === "passed" && r.cleanup)
      ? "passed"
      : "failed";
  report.finishedAt = new Date().toISOString();
  save();
  console.log(`Native phone report: ${path.join(output, "summary.json")}`);
  if (report.status !== "passed") process.exitCode = 1;
}
