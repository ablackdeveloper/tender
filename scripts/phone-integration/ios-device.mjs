import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { command as nativeCommand } from "./stack.mjs";

// simctl can keep waiting after SIGTERM during a cold boot. Every synchronous
// command here belongs to this adapter and must honor its configured deadline.
const command = (file, args, options = {}) =>
  nativeCommand(file, args, { killSignal: "SIGKILL", ...options });

// This adapter owns a simulator it creates itself. It never accepts a device UDID.
export function createIosDevice({ runId, appId }) {
  let serial, appBundle, certificate, helperBundle;
  let creationAttempted = false;
  const simulatorName = `Tender E2E ${runId}`;
  const helperId = "com.tender.fixtures.e2e";
  const sim = (...args) =>
    command("xcrun", ["simctl", ...args], { timeout: 120000 });
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
      const runtimes = JSON.parse(inventory)
        .runtimes.filter((r) => r.isAvailable && r.identifier.includes(".iOS-"))
        .sort((a, b) =>
          b.version.localeCompare(a.version, undefined, { numeric: true }),
        );
      assert.ok(runtimes.length, "No available iOS Simulator runtime");
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
    async boot({ report, execute, output }) {
      // A new runtime on a cold CI Mac must initialize its data before the
      // simulator can accept UI commands. Record the phase without device data.
      for (const [phase, args, timeout] of [
        ["boot", ["boot", serial], 300000],
        ["boot readiness", ["bootstatus", serial, "-b"], 600000],
      ]) {
        console.log(`iOS simulator: ${phase}`);
        const started = Date.now();
        try {
          // The asynchronous runner kills the owned process group and closes
          // its pipes on timeout. Keep the boot output for real-device diagnostics.
          await execute("xcrun", ["simctl", ...args], {
            timeout,
            log: path.join(
              output,
              `simulator-${phase.replaceAll(" ", "-")}.log`,
            ),
          });
        } catch (error) {
          throw new Error(`iOS simulator ${phase}: ${error.message}`);
        } finally {
          (report.simulatorSetup ??= []).push({
            phase,
            elapsedMs: Date.now() - started,
          });
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
      await execute(
        "pnpm",
        ["exec", "expo", "prebuild", "--platform", "ios", "--no-install"],
        { cwd: app, env, log: path.join(output, "prebuild.log") },
      );
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
          "CODE_SIGNING_ALLOWED=NO",
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
@main class FixtureApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = UIViewController()
    window?.makeKeyAndVisible()
    return true
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
      // Image extraction and native compilation do not require a running UI.
      // Boot only after these jobs finish, leaving memory for the local backend.
      await this.boot({ report, execute, output });
      this.clear();
    },
    clear() {
      for (const id of [appId, helperId]) {
        if (installedApps()[id]) sim("uninstall", serial, id);
        assert.ok(!installedApps()[id], "Test app was not removed");
      }
      // Reinstallation alone does not clear iOS Keychain credentials.
      sim("keychain", serial, "reset");
      sim("keychain", serial, "add-root-cert", certificate);
      command("xcrun", ["simctl", "pbcopy", serial], {
        input: "",
        timeout: 15000,
      });
      for (const bundle of [appBundle, helperBundle])
        sim("install", serial, bundle);
      sim("privacy", serial, "reset", "all", appId);
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
    copySecret(value) {
      command("xcrun", ["simctl", "pbcopy", serial], {
        input: value,
        timeout: 15000,
      });
    },
    screenshot(file) {
      sim("io", serial, "screenshot", file);
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
      if (records().find((d) => d.udid === serial)?.state === "Booted")
        sim("shutdown", serial);
      sim("delete", serial);
      assert.ok(
        !records().some((d) => d.udid === serial),
        "Owned simulator still exists",
      );
    },
  };
}
