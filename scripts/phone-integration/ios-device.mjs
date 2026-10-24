import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { command as nativeCommand } from "./stack.mjs";
import { saveMaestroDiagnostics } from "./maestro-diagnostics.mjs";

// simctl can keep waiting after SIGTERM during a cold boot. Every synchronous
// command here belongs to this adapter and must honor its configured deadline.
const command = (file, args, options = {}) =>
  nativeCommand(file, args, { killSignal: "SIGKILL", ...options });

// This adapter owns a simulator it creates itself. It never accepts a device UDID.
export function createIosDevice({ runId, appId }) {
  let serial, appBundle, certificate, helperBundle, appExecutable;
  let creationAttempted = false;
  const simulatorName = `Tender E2E ${runId}`;
  const helperId = "com.tender.fixtures.e2e";
  const sim = (...args) => {
    try {
      return command("xcrun", ["simctl", ...args], { timeout: 120000 });
    } catch (error) {
      // Add only the fixed command verb, never its arguments or input.
      const action = args[0] === "keychain" ? ` ${args[2]}` : "";
      throw new Error(`simctl ${args[0]}${action}: ${error.message}`);
    }
  };
  const installedApps = () =>
    JSON.parse(
      command("plutil", ["-convert", "json", "-o", "-", "-"], {
        input: sim("listapps", serial),
      }),
    );
  return {
    get serial() {
      return serial;
    },
    prepare(report) {
      assert.equal(
        process.platform,
        "darwin",
        "iOS E2E requires a Mac with Xcode",
      );
      report.xcodeVersion = command("xcodebuild", ["-version"]).trim();
      const version = report.xcodeVersion.match(/^Xcode (\d+)\.(\d+)/);
      assert.ok(
        version &&
          (Number(version[1]) > 26 ||
            (Number(version[1]) === 26 && Number(version[2]) >= 4)),
        "Expo SDK 57 requires Xcode 26.4 or later",
      );
      let inventory;
      try {
        inventory = command("xcrun", ["simctl", "list", "runtimes", "--json"], {
          timeout: 300000,
        });
      } catch (error) {
        throw new Error(`iOS runtime inventory: ${error.message}`);
      }
      const requestedRuntime = process.env.TENDER_IOS_VERSION;
      if (requestedRuntime)
        assert.match(requestedRuntime, /^\d+\.\d+(?:\.\d+)?$/);
      const runtimes = JSON.parse(inventory)
        .runtimes.filter(
          (r) =>
            r.isAvailable &&
            r.identifier.includes(".iOS-") &&
            (!requestedRuntime ||
              r.version === requestedRuntime ||
              r.version.startsWith(`${requestedRuntime}.`)),
        )
        .sort((a, b) =>
          b.version.localeCompare(a.version, undefined, { numeric: true }),
        );
      assert.ok(
        runtimes.length,
        "Requested iOS Simulator runtime is unavailable",
      );
      report.requestedIosVersion = requestedRuntime ?? "latest available";
      report.iosVersion = runtimes[0].version;
      creationAttempted = true;
      let created;
      try {
        created = command(
          "xcrun",
          [
            "simctl",
            "create",
            simulatorName,
            "com.apple.CoreSimulator.SimDeviceType.iPhone-16",
            runtimes[0].identifier,
          ],
          { timeout: 300000 },
        ).trim();
      } catch (error) {
        throw new Error(`iOS simulator creation: ${error.message}`);
      }
      assert.match(created, /^[0-9A-F-]{36}$/i);
      serial = created;
    },
    async boot({ report, execute, output, label = "simulator" }) {
      // A new runtime on a cold CI Mac must initialize its data before the
      // simulator can accept UI commands. Record the phase without device data.
      for (const [phase, args, timeout] of [
        ["boot", ["boot", serial], 300000],
        ["boot readiness", ["bootstatus", serial, "-b"], 600000],
      ]) {
        console.log(`iOS ${label}: ${phase}`);
        const started = Date.now();
        try {
          // The asynchronous runner kills the owned process group and closes
          // its pipes on timeout. Keep the boot output for simulator diagnostics.
          await execute("xcrun", ["simctl", ...args], {
            timeout,
            log: path.join(
              output,
              `${label}-${phase.replaceAll(" ", "-")}.log`,
            ),
          });
        } catch (error) {
          throw new Error(`iOS simulator ${phase}: ${error.message}`);
        } finally {
          (report.simulatorSetup ??= []).push({
            label,
            phase,
            elapsedMs: Date.now() - started,
          });
        }
      }
    },
    shutdown() {
      sim("shutdown", serial);
    },
    async checkDriver({ maestro, execute, output, report, redact }) {
      // Readiness only: a new simulator has no test accounts or app data yet.
      // This must not count as one of the 19 production-app user flows.
      const root = mkdtempSync(path.join(tmpdir(), "tender-ios-driver-"));
      const debug = path.join(root, "debug");
      const results = path.join(root, "results");
      const flow = path.join(root, "readiness.yaml");
      const started = Date.now();
      report.driverReadiness = {
        status: "running",
        cleanup: false,
        setupTimeoutMs: 720000,
      };
      writeFileSync(
        flow,
        'appId: com.apple.Preferences\n---\n- launchApp:\n    permissions: {}\n- extendedWaitUntil:\n    visible: "Settings"\n    timeout: 30000\n',
      );
      console.log("iOS driver readiness: launch Settings on owned simulator");
      try {
        await execute(
          maestro,
          [
            "--device",
            serial,
            "test",
            "--debug-output",
            debug,
            "--test-output-dir",
            results,
            flow,
          ],
          {
            log: path.join(output, "driver-readiness.log"),
            // Cold CLI/device discovery took over five minutes before XCTest
            // started. Keep its setup budget separate from the 30s UI check.
            timeout: 720000,
          },
        );
        report.driverReadiness.status = "passed";
        console.log("iOS driver readiness: passed (not a user-flow case)");
      } catch (error) {
        report.driverReadiness.status = "failed";
        throw error;
      } finally {
        try {
          saveMaestroDiagnostics({
            roots: [debug, results],
            output,
            prefix: "driver-readiness",
            redact,
          });
        } finally {
          assert.equal(path.dirname(root), path.resolve(tmpdir()));
          assert.ok(path.basename(root).startsWith("tender-ios-driver-"));
          rmSync(root, { recursive: true, force: true });
          assert.ok(!existsSync(root));
          report.driverReadiness.cleanup = true;
          report.driverReadiness.elapsedMs = Date.now() - started;
          if (
            report.driverReadiness.status === "passed" &&
            process.env.GITHUB_ACTIONS === "true"
          )
            console.log(
              "::notice title=iOS XCTest readiness::Settings UI passed; readiness files removed",
            );
        }
      }
    },
    async build({ app, env, root, cert, output, execute, report }) {
      const ios = path.join(app, "ios");
      assert.ok(
        !existsSync(ios),
        "Use a fresh checkout; existing iOS projects are preserved",
      );
      certificate = cert;
      console.log("iOS build: generate native project");
      await execute(
        "pnpm",
        ["exec", "expo", "prebuild", "--platform", "ios", "--no-install"],
        { cwd: app, env, log: path.join(output, "prebuild.log") },
      );
      console.log("iOS build: install native dependencies");
      await execute("pod", ["install"], {
        cwd: ios,
        env,
        log: path.join(output, "pods.log"),
      });
      const workspaces = readdirSync(ios).filter((name) =>
        name.endsWith(".xcworkspace"),
      );
      assert.equal(workspaces.length, 1);
      const scheme = workspaces[0].replace(/\.xcworkspace$/, "");
      const derived = path.join(root, "ios-build");
      console.log("iOS build: compile and sign simulator app");
      await execute(
        "xcodebuild",
        [
          "-workspace",
          workspaces[0],
          "-scheme",
          scheme,
          "-configuration",
          "Release",
          "-sdk",
          "iphonesimulator",
          "-destination",
          `id=${serial}`,
          "-derivedDataPath",
          derived,
          // Simulator ad-hoc signing needs no Apple account. Disabling signing
          // removes the base entitlements that SecureStore needs for Keychain.
          "CODE_SIGNING_ALLOWED=YES",
          "CODE_SIGN_IDENTITY=-",
          "CODE_SIGN_INJECT_BASE_ENTITLEMENTS=YES",
          "ONLY_ACTIVE_ARCH=YES",
          "build",
        ],
        {
          cwd: ios,
          env,
          log: path.join(output, "build.log"),
          timeout: 3600000,
        },
      );
      const products = path.join(
        derived,
        "Build/Products/Release-iphonesimulator",
      );
      const bundles = readdirSync(products).filter((name) =>
        name.endsWith(".app"),
      );
      assert.equal(bundles.length, 1);
      appBundle = path.join(products, bundles[0]);
      const plist = JSON.parse(
        command("plutil", [
          "-convert",
          "json",
          "-o",
          "-",
          path.join(appBundle, "Info.plist"),
        ]),
      );
      assert.equal(plist.CFBundleIdentifier, appId);
      appExecutable = plist.CFBundleExecutable;
      console.log("iOS build: verify app signature");
      await execute("codesign", ["--verify", "--strict", appBundle], {
        log: path.join(output, "simulator-signing.log"),
        timeout: 30000,
      });
      report.simulatorSigning = "ad-hoc; signature verified";
      if (process.env.GITHUB_ACTIONS === "true")
        console.log(
          "::notice title=iOS app build::Isolated simulator app compiled; ad-hoc signature verified",
        );
      report.appExecutableSha256 = createHash("sha256")
        .update(readFileSync(path.join(appBundle, plist.CFBundleExecutable)))
        .digest("hex");
      // A separate fixture app supplies files through the real system picker.
      // The production app's file-sharing or security settings are not changed.
      helperBundle = path.join(root, "TenderFixtures.app");
      mkdirSync(helperBundle);
      const source = path.join(root, "fixture-provider.swift");
      writeFileSync(
        source,
        `import UIKit
import Foundation
import Darwin
@main class FixtureApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  var handledClipboard = false
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = UIViewController()
    window?.makeKeyAndVisible()
    return true
  }
  func applicationDidBecomeActive(_ application: UIApplication) {
    guard !handledClipboard,
      let mode = ProcessInfo.processInfo.environment["TENDER_E2E_CLIPBOARD_MODE"] else { return }
    handledClipboard = true
    let board = UIPasteboard.general
    let ok: Bool
    if mode == "clear" {
      board.items = []
      ok = board.items.isEmpty
    } else if mode == "write",
      let value = ProcessInfo.processInfo.environment["TENDER_E2E_CLIPBOARD_VALUE"], !value.isEmpty {
      board.setItems([["public.utf8-plain-text": value]], options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(600)])
      ok = board.string == value
    } else {
      ok = false
    }
    // Only this fixed acknowledgement leaves the helper; never the value.
    FileHandle.standardOutput.write(Data((ok ? "TENDER_CLIPBOARD_OK\\n" : "TENDER_CLIPBOARD_READBACK_FAILED\\n").utf8))
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { exit(ok ? 0 : 1) }
  }
}
`,
      );
      writeFileSync(
        path.join(helperBundle, "Info.plist"),
        `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${helperId}</string><key>CFBundleExecutable</key><string>Fixtures</string>
<key>CFBundleName</key><string>Tender Fixtures</string><key>CFBundleDisplayName</key><string>Tender Fixtures</string>
<key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string><key>MinimumOSVersion</key><string>16.4</string>
<key>UIDeviceFamily</key><array><integer>1</integer></array><key>UIFileSharingEnabled</key><true/>
<key>LSSupportsOpeningDocumentsInPlace</key><true/><key>UILaunchScreen</key><dict/>
</dict></plist>`,
      );
      const sdk = command("xcrun", [
        "--sdk",
        "iphonesimulator",
        "--show-sdk-path",
      ]).trim();
      console.log("iOS build: compile isolated file provider");
      await execute(
        "xcrun",
        [
          "swiftc",
          "-parse-as-library",
          "-sdk",
          sdk,
          "-target",
          `${process.arch === "arm64" ? "arm64" : "x86_64"}-apple-ios16.4-simulator`,
          source,
          "-o",
          path.join(helperBundle, "Fixtures"),
        ],
        { log: path.join(output, "fixture-build.log") },
      );
      await execute("codesign", ["--force", "--sign", "-", helperBundle], {
        log: path.join(output, "fixture-signing.log"),
        timeout: 30000,
      });
      await execute("codesign", ["--verify", "--strict", helperBundle], {
        log: path.join(output, "fixture-signing-verification.log"),
        timeout: 30000,
      });
      // Resume the initialized simulator only after compilation finishes.
      await this.boot({ report, execute, output });
      this.clear();
    },
    clear() {
      console.log("iOS app reset: remove isolated apps");
      for (const id of [appId, helperId]) {
        if (installedApps()[id]) sim("uninstall", serial, id);
        assert.ok(!installedApps()[id], "Test app was not removed");
      }
      // Reinstallation alone does not clear iOS Keychain credentials.
      console.log(
        "iOS app reset: reset Keychain and restore local certificate",
      );
      sim("keychain", serial, "reset");
      sim("keychain", serial, "add-root-cert", certificate);
      for (const [label, bundle] of [
        ["main app", appBundle],
        ["fixture helper", helperBundle],
      ]) {
        console.log(`iOS app reset: install ${label}`);
        try {
          // Cold CoreSimulator installs exceeded the old two-minute command
          // limit. This reset budget does not extend any UI assertion.
          command("xcrun", ["simctl", "install", serial, bundle], {
            timeout: 300000,
          });
        } catch (error) {
          throw new Error(`iOS ${label} install: ${error.message}`);
        }
      }
      // Complete OS permission changes before the clipboard helper enters and
      // exits the foreground; no app process needs to run for this reset.
      console.log("iOS app reset: reset permissions");
      sim("privacy", serial, "reset", "all", appId);
      console.log("iOS app reset: clear and verify simulator clipboard");
      this.copySecret("", { restoreApp: false });
      console.log("iOS app reset: verify empty app data");
      assert.ok(installedApps()[appId]);
      const container = sim("get_app_container", serial, appId, "data").trim();
      for (const name of ["Documents", "Library/Caches"]) {
        const directory = path.join(container, name);
        assert.ok(
          !existsSync(directory) || readdirSync(directory).length === 0,
          "App data survived reinstall",
        );
      }
    },
    fixture(extension, bytes) {
      assert.ok(["pdf", "png"].includes(extension));
      const container = sim(
        "get_app_container",
        serial,
        helperId,
        "data",
      ).trim();
      const directory = path.join(container, "Documents");
      mkdirSync(directory, { recursive: true });
      const name = `tender-${randomUUID()}.${extension}`;
      writeFileSync(path.join(directory, name), bytes);
      return name;
    },
    copySecret(value, { restoreApp = true } = {}) {
      let phase = "helper launch";
      try {
        // The helper writes inside the simulator. Host-side simctl pbcopy can
        // fail on Xcode 26.4. Values enter only the owned process environment,
        // never arguments, files, Maestro flows, or published diagnostics.
        const response = spawnSync(
          "xcrun",
          [
            "simctl",
            "launch",
            "--console",
            "--terminate-running-process",
            serial,
            helperId,
          ],
          {
            encoding: "utf8",
            maxBuffer: 1024 * 1024,
            killSignal: "SIGKILL",
            env: {
              ...process.env,
              SIMCTL_CHILD_TENDER_E2E_CLIPBOARD_MODE: value ? "write" : "clear",
              SIMCTL_CHILD_TENDER_E2E_CLIPBOARD_VALUE: value,
            },
            timeout: 120000,
          },
        );
        // Inspect only fixed protocol markers. Never pass native output through
        // the general command error formatter: clipboard values are secret.
        const output = `${response.stdout ?? ""}\n${response.stderr ?? ""}`;
        if (response.error || response.status !== 0) {
          const code = response.error?.code ?? response.status ?? "unavailable";
          const readback = output.includes("TENDER_CLIPBOARD_READBACK_FAILED")
            ? "; native readback failed"
            : "";
          throw new Error(`helper failed (${code})${readback}`);
        }
        phase = "acknowledgement";
        assert.match(output, /\bTENDER_CLIPBOARD_OK\b/);
        // Preserve the existing form after a password write or its final clear.
        phase = "app restore";
        if (restoreApp) sim("launch", serial, appId);
      } catch (error) {
        const code =
          error.message.match(/failed \(([A-Z0-9-]+)\)/)?.[1] ?? "unavailable";
        const readback = error.message.includes("native readback failed")
          ? "; native readback failed"
          : "";
        throw new Error(
          `Owned clipboard helper failed at ${phase} (code ${code}${readback}); contents omitted`,
        );
      }
    },
    screenshot(file) {
      sim("io", serial, "screenshot", file);
    },
    diagnostics() {
      assert.ok(appExecutable, "App executable is not known");
      return command(
        "xcrun",
        [
          "simctl",
          "spawn",
          serial,
          "log",
          "show",
          "--last",
          "5m",
          "--style",
          "compact",
          "--info",
          "--predicate",
          `process == ${JSON.stringify(appExecutable)}`,
        ],
        { timeout: 20000 },
      );
    },
    close() {
      if (!serial && !creationAttempted) return;
      const records = () =>
        Object.values(
          JSON.parse(sim("list", "devices", "--json")).devices,
        ).flat();
      if (!serial) {
        const owned = records().filter(
          (device) => device.name === simulatorName,
        );
        assert.equal(
          owned.length,
          1,
          "Simulator creation returned no ID; cleanup cannot be confirmed",
        );
        serial = owned[0].udid;
      }
      let shutdownError;
      if (records().find((d) => d.udid === serial)?.state === "Booted") {
        try {
          this.shutdown();
        } catch (error) {
          shutdownError = error;
        }
      }
      // A stalled shutdown must not prevent deletion of this owned simulator.
      // Only verified absence below establishes successful cleanup.
      try {
        sim("delete", serial);
      } catch (error) {
        throw new Error(
          `Owned simulator deletion failed: ${error.message}${shutdownError ? `; shutdown: ${shutdownError.message}` : ""}`,
        );
      }
      assert.ok(
        !records().some((d) => d.udid === serial),
        "Owned simulator still exists",
      );
    },
  };
}
