import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { workspace } from "./harness.mjs";
const root = path.join(
  workspace,
  "scripts/feature-integration/artifacts/service-tools",
);
const report = {
  runId: randomUUID(),
  status: "blocked",
  kind: "readiness-only",
  testsExecuted: 0,
  checkedAt: new Date().toISOString(),
  tools: {},
  blockers: [],
};
const adb = path.join(root, "platform-tools/adb.exe"),
  java = path.join(root, "jdk-21.0.12.1+1/bin/java.exe"),
  maestro = path.join(root, "maestro/bin/maestro.bat");
for (const [name, file] of Object.entries({ adb, java, maestro })) {
  report.tools[name] = existsSync(file);
  if (!existsSync(file))
    report.blockers.push(`${name} is missing; run setup.ps1 -WithPhone`);
}
if (report.tools.adb) {
  const result = spawnSync(adb, ["devices", "-l"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 15000,
  });
  if (result.status !== 0) report.blockers.push("adb device check failed");
  else {
    const lines = result.stdout
      .split(/\r?\n/)
      .filter((line) => /^\S+\s+device\b/.test(line));
    report.authorizedDevices = lines.length;
    if (lines.length !== 1)
      report.blockers.push(
        "Connect exactly one authorized Android test device",
      );
    else {
      const serial = lines[0].split(/\s+/)[0];
      const installed = spawnSync(
        adb,
        ["-s", serial, "shell", "pm", "path", "com.tender.companion.e2e"],
        { encoding: "utf8", windowsHide: true, timeout: 15000 },
      );
      if (!installed.stdout?.includes("package:"))
        report.blockers.push(
          "Install the isolated com.tender.companion.e2e build",
        );
    }
  }
}
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
