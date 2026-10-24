import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Build only the pinned XCTest UI driver. Do not run upstream unit tests.
assert.equal(process.platform, "darwin");
const upstream = "c8c361be1cc89b2e742f185466a302a22778be6b";
const maestro = path.resolve(process.argv[2]);
const receipt = path.resolve(process.argv[3]);
const root = mkdtempSync(path.join(tmpdir(), "tender-maestro-driver-"));
const source = path.join(root, "source");
const report = {
  status: "failed",
  upstream,
  patch: "springboard-alert-hierarchy-v2",
  cleanup: false,
};
const run = (file, args, options = {}) =>
  execFileSync(file, args, {
    encoding: "utf8",
    timeout: 300000,
    killSignal: "SIGKILL",
    stdio: "inherit",
    ...options,
  });
const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
try {
  mkdirSync(source);
  run("git", ["init", source]);
  run("git", [
    "-C",
    source,
    "remote",
    "add",
    "origin",
    "https://github.com/mobile-dev-inc/Maestro.git",
  ]);
  run("git", ["-C", source, "fetch", "--depth", "1", "origin", upstream]);
  run("git", ["-C", source, "checkout", "--detach", "FETCH_HEAD"]);
  assert.equal(
    run("git", ["-C", source, "rev-parse", "HEAD"], { stdio: "pipe" }).trim(),
    upstream,
  );
  const handler = path.join(
    source,
    "maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Handlers/ViewHierarchyHandler.swift",
  );
  const original = readFileSync(handler, "utf8");
  const anchor =
    "        let appHierarchy = try getHierarchyWithFallback(foregroundApp)";
  assert.equal(
    original.split(anchor).length,
    2,
    "Pinned driver patch location changed",
  );
  // iOS 26 can keep the app foreground while SpringBoard owns its Open dialog.
  // Return the real modal hierarchy so normal selectors can inspect and tap it.
  // Do not auto-accept alerts or expose the covered app as if it were actionable.
  writeFileSync(
    handler,
    original.replace(
      anchor,
      `        if foregroundApp.bundleID != "com.apple.springboard" {
            if let systemAlert = fullScreenAlertHierarchy(springboardApplication) {
                NSLog("Tender harness: exposing SpringBoard alert")
                return systemAlert
            }
            // iOS 26 URL confirmation can be a system sheet rather than an
            // XCUIElementTypeAlert. Expose its real tree, without accepting it.
            if springboardApplication.buttons["Open"].exists &&
               springboardApplication.buttons["Cancel"].exists {
                NSLog("Tender harness: exposing SpringBoard URL confirmation")
                return try elementHierarchy(xcuiElement: springboardApplication)
            }
        }
${anchor}`,
    ),
  );
  report.handlerSha256 = hash(handler);
  const derived = path.join(root, "build");
  run(
    "xcodebuild",
    [
      "build-for-testing",
      "-project",
      path.join(
        source,
        "maestro-ios-xctest-runner/maestro-driver-ios.xcodeproj",
      ),
      "-scheme",
      "maestro-driver-ios",
      "-destination",
      "generic/platform=iOS Simulator",
      "-derivedDataPath",
      derived,
      "ARCHS=x86_64",
      "CODE_SIGNING_ALLOWED=YES",
      "CODE_SIGN_IDENTITY=-",
      "CODE_SIGN_INJECT_BASE_ENTITLEMENTS=YES",
    ],
    { timeout: 2400000 },
  );
  const products = path.join(derived, "Build/Products");
  const configs = readdirSync(products).filter((name) =>
    name.endsWith(".xctestrun"),
  );
  assert.equal(configs.length, 1);
  const resources = path.join(root, "resources");
  const target = path.join(resources, "driver-iPhoneSimulator");
  const debug = path.join(target, "Debug-iphonesimulator");
  mkdirSync(debug, { recursive: true });
  copyFileSync(
    path.join(products, configs[0]),
    path.join(target, "maestro-driver-ios-config.xctestrun"),
  );
  const testConfigPath = path.join(
    target,
    "maestro-driver-ios-config.xctestrun",
  );
  const testConfig = JSON.parse(
    run("plutil", ["-convert", "json", "-o", "-", testConfigPath], {
      stdio: "pipe",
    }),
  );
  const onlyUiTarget = (config) => {
    const version = config.__xctestrun_metadata__.FormatVersion;
    assert.ok([1, 2].includes(version), "Unsupported xctestrun format");
    let targets;
    if (version === 2) {
      assert.equal(config.TestConfigurations.length, 1);
      targets = config.TestConfigurations[0].TestTargets;
    } else {
      targets = Object.values(config).filter((value) => value?.BlueprintName);
    }
    assert.equal(targets.length, 1);
    assert.equal(targets[0].BlueprintName, "maestro-driver-iosUITests");
    assert.equal(targets[0].IsUITestBundle, true);
    return targets[0];
  };
  const uiTarget = onlyUiTarget(testConfig);
  // The upstream bundle also contains unit methods. Start only the HTTP UI
  // automation server; every app test is then driven through our E2E harness.
  const serverTest = "maestro_driver_iosUITests/testHttpServer";
  uiTarget.OnlyTestIdentifiers = [serverTest];
  writeFileSync(testConfigPath, JSON.stringify(testConfig));
  run("plutil", ["-convert", "xml1", testConfigPath]);
  const verifiedConfig = JSON.parse(
    run("plutil", ["-convert", "json", "-o", "-", testConfigPath], {
      stdio: "pipe",
    }),
  );
  assert.deepEqual(onlyUiTarget(verifiedConfig).OnlyTestIdentifiers, [
    serverTest,
  ]);
  report.onlyTestIdentifiers = [serverTest];
  for (const name of [
    "maestro-driver-iosUITests-Runner",
    "maestro-driver-ios",
  ]) {
    const bundle = path.join(products, "Debug-iphonesimulator", `${name}.app`);
    assert.ok(existsSync(bundle));
    run("codesign", ["--verify", "--strict", bundle]);
    run("zip", ["-qr", path.join(debug, `${name}.zip`), `${name}.app`], {
      cwd: path.dirname(bundle),
    });
  }
  const libraries = path.join(maestro, "lib");
  const jars = readdirSync(libraries).filter((name) =>
    /^maestro-ios-driver.*\.jar$/.test(name),
  );
  assert.equal(jars.length, 1, "Expected the pinned Maestro iOS driver JAR");
  const jar = path.join(libraries, jars[0]);
  report.originalJarSha256 = hash(jar);
  run("jar", ["uf", jar, "-C", resources, "driver-iPhoneSimulator"]);
  report.patchedJarSha256 = hash(jar);
  assert.notEqual(report.patchedJarSha256, report.originalJarSha256);
  report.status = "passed";
} finally {
  assert.equal(path.dirname(root), path.resolve(tmpdir()));
  assert.ok(path.basename(root).startsWith("tender-maestro-driver-"));
  rmSync(root, { recursive: true, force: true });
  assert.ok(!existsSync(root));
  report.cleanup = true;
  mkdirSync(path.dirname(receipt), { recursive: true });
  writeFileSync(receipt, JSON.stringify(report, null, 2));
  console.log(
    `iOS UI driver build: ${report.status}; cleanup=${report.cleanup}`,
  );
}
