import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { workspace } from "./harness.mjs";

// Readiness only: never installs, launches, resets, or deletes an app/device.
const root = path.join(
  workspace,
  "scripts/feature-integration/artifacts/service-tools",
);
const probe = (file, args) =>
  spawnSync(file, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
const locate = (name, bundled) => {
  if (bundled && existsSync(bundled)) return bundled;
  const found = probe(process.platform === "win32" ? "where.exe" : "which", [
    name,
  ]);
  return found.status === 0 ? found.stdout.trim().split(/\r?\n/)[0] : null;
};
const adb = locate("adb", path.join(root, "platform-tools/adb.exe"));
const java = locate("java", path.join(root, "jdk-21.0.12.1+1/bin/java.exe"));
const maestro =
  process.env.MAESTRO_BIN ??
  locate("maestro", path.join(root, "maestro/bin/maestro.bat"));
const docker = locate("docker");
const xcrun = process.platform === "darwin" ? locate("xcrun") : null;
const report = {
  runId: randomUUID(),
  status: "blocked",
  kind: "readiness-only",
  testsExecuted: 0,
  checkedAt: new Date().toISOString(),
  host: process.platform,
  tools: {
    adb: !!adb,
    java: !!java,
    maestro: !!maestro,
    docker: !!docker,
    xcrun: !!xcrun,
  },
  androidEmulators: 0,
  physicalAndroidDevices: 0,
  iosRuntimes: 0,
  physicalIos:
    "Not supported by the pinned Maestro runner; requires a Mac, physical iPhone, and a separate device driver",
  blockers: [],
  physicalBlockers: [],
};
if (adb) {
  const result = probe(adb, ["devices"]);
  if (result.status !== 0) report.blockers.push("adb device check failed");
  else
    for (const line of result.stdout.split(/\r?\n/)) {
      if (!/^\S+\s+device\b/.test(line)) continue;
      if (line.startsWith("emulator-")) report.androidEmulators++;
      else report.physicalAndroidDevices++;
    }
}
if (xcrun) {
  const result = probe(xcrun, ["simctl", "list", "runtimes", "--json"]);
  if (result.status === 0)
    report.iosRuntimes = JSON.parse(result.stdout).runtimes.filter(
      (r) => r.isAvailable && r.identifier.includes(".iOS-"),
    ).length;
}
const dockerReady =
  docker && probe(docker, ["info", "--format", "{{.OSType}}"]);
report.localLinuxBackend =
  !!dockerReady &&
  dockerReady.status === 0 &&
  dockerReady.stdout.trim() === "linux";
if (!java || !maestro)
  report.blockers.push("Java 21 and Maestro 2.11.0 are required");
if (!report.localLinuxBackend)
  report.blockers.push(
    "A local Docker Linux engine is required; no hosted fallback is allowed",
  );
if (process.platform === "darwin") {
  if (!report.iosRuntimes)
    report.blockers.push("Install Xcode and an iOS simulator runtime");
} else if (process.platform === "linux") {
  if (report.androidEmulators !== 1)
    report.blockers.push("Start exactly one dedicated Android emulator");
} else
  report.blockers.push(
    "Use the Linux Android or macOS iOS CI harness; Windows is readiness-only",
  );
if (!report.physicalAndroidDevices)
  report.physicalBlockers.push(
    "No authorized physical Android phone is connected",
  );
report.physicalExecution =
  "blocked; current execution adapters accept only owned simulators/emulators";
if (report.blockers.length === 0) report.status = "ready";
const output = path.join(
  workspace,
  "scripts/feature-integration/artifacts/phone-runs",
  report.runId,
);
mkdirSync(output, { recursive: true });
writeFileSync(
  path.join(output, "summary.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
console.log(`Phone readiness report: ${path.join(output, "summary.json")}`);
if (report.status !== "ready") process.exitCode = 2;
