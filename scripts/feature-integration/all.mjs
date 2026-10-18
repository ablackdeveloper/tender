import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { screens, otherRoutes, deviceGaps } from "./flow-catalog.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const artifacts = fileURLToPath(new URL("./artifacts/", import.meta.url));
const runId = randomUUID();
const runDir = path.join(artifacts, "runs", runId);
await mkdir(runDir, { recursive: true });
const browserOnly = process.argv.includes("--browser-only");
const report = {
  runId,
  startedAt: new Date().toISOString(),
  status: "running",
  scope: browserOnly
    ? "browser only"
    : "browser, local database/API, Auth, email and account functions",
  suites: [],
  routeInventory: [],
  deviceGaps,
};
const persist = async () => {
  await writeFile(
    path.join(runDir, "summary.json"),
    JSON.stringify(report, null, 2),
  );
  await writeFile(
    path.join(artifacts, "latest.json"),
    JSON.stringify(report, null, 2),
  );
};
await persist();
async function run(name, script, args = []) {
  const suite = { name, status: "running" };
  report.suites.push(suite);
  await persist();
  let log = "";
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, ...args], {
        cwd: root,
        windowsHide: true,
        shell: false,
        env: { ...process.env, FLOW_RUN_DIR: runDir, FLOW_RUN_ID: runId },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (data) => {
        log += data;
        if (!String(data).includes("console.warn")) process.stdout.write(data);
      });
      child.stderr.on("data", (data) => {
        log += data;
        process.stderr.write(data);
      });
      child.on("error", reject);
      child.on("close", resolve);
    });
    assert.equal(code, 0, `${name} must exit successfully`);
    if (name === "database") {
      assert.match(log, /Synthetic database data was removed/);
      const api = JSON.parse(
        await readFile(path.join(runDir, "native-api/results.json"), "utf8"),
      );
      assert.equal(api.runId, runId);
      assert.equal(api.cleaned, true);
      assert.ok(api.results.length >= 34);
      assert.ok(api.results.every((item) => item.passed));
      suite.apiScenarios = api.results.length;
      suite.databaseAssertions = [
        ...log.matchAll(/: (\d+) assertions passed\./g),
      ].reduce((total, match) => total + Number(match[1]), 0);
      assert.ok(
        suite.databaseAssertions > 0,
        "database assertions must be present",
      );
      suite.invitationRace = /Invitation race passed/.test(log);
      assert.ok(suite.invitationRace);
    } else if (name === "services" || name === "passwords") {
      const services = JSON.parse(
        await readFile(
          path.join(
            runDir,
            name === "passwords"
              ? "native-passwords/summary.json"
              : "native-services/summary.json",
          ),
          "utf8",
        ),
      );
      assert.equal(services.runId, runId);
      assert.equal(services.status, "passed");
      assert.equal(services.cleanup, true);
      assert.equal(services.results.length, name === "passwords" ? 20 : 36);
      assert.ok(services.results.every((item) => item.status === "passed"));
      suite.scenarios = services.results.length;
      suite.limits = services.limits;
    } else if (name === "harness-checks") {
      const checks = JSON.parse(
        await readFile(path.join(runDir, "harness-checks.json"), "utf8"),
      );
      assert.equal(checks.runId, runId);
      assert.equal(checks.passed, true);
      suite.scenarios = checks.checks.length;
    } else {
      const result = JSON.parse(
        await readFile(path.join(runDir, name, "results.json"), "utf8"),
      );
      assert.equal(result.runId, runId, "only fresh reports count");
      assert.equal(
        result.filter,
        null,
        "partial suite must not count as full coverage",
      );
      assert.equal(result.status, "passed");
      assert.equal(result.cleanup, true);
      assert.equal(result.results.length, result.discovered);
      assert.ok(
        result.results.length > 0 &&
          result.results.every((item) => item.passed),
      );
      suite.scenarios = result.results.length;
    }
    suite.status = "passed";
  } catch (error) {
    suite.status = "failed";
    suite.error = String(error);
  } finally {
    await writeFile(path.join(runDir, `${name}.log`), log);
    await persist();
  }
}
try {
  assert.equal(
    process.versions.node.split(".")[0],
    "22",
    "Use the Node 22 runtime in .nvmrc",
  );
  assert.ok(
    !process.env.SCENARIO_FILTER,
    "The full runner rejects SCENARIO_FILTER; run a suite directly for focused checks",
  );
  const routes = (
    await readdir(path.join(root, "apps/mobile/src/app"), { recursive: true })
  )
    .map((item) => item.replaceAll("\\", "/"))
    .filter((item) => item.endsWith(".tsx") && !item.endsWith("_layout.tsx"));
  const known = new Map(
    screens.map(([screen, route]) => [
      route,
      {
        status: "browser-screen",
        evidence: `user-flows: route-${screen} at 320, 390, and 1280 pixels`,
      },
    ]),
  );
  for (const [route, item] of Object.entries(otherRoutes))
    known.set(route, item);
  assert.deepEqual(
    routes.filter((route) => !known.has(route)),
    [],
    "New routes need an explicit flow or blocked evidence entry",
  );
  assert.deepEqual(
    [...known.keys()].filter((route) => !routes.includes(route)),
    [],
    "Remove stale route entries",
  );
  report.routeInventory = routes
    .sort()
    .map((route) => ({ route, ...known.get(route) }));
  await persist();
  await run("harness-checks", "scripts/feature-integration/harness-checks.mjs");
  for (const [name, file] of [
    ["core", "run"],
    ["experience-fixes", "experience-fixes"],
    ["home-preferences", "home-preferences"],
    ["design-review", "design-review"],
    ["user-flows", "user-flows"],
  ]) {
    await run(name, `scripts/feature-integration/${file}.mjs`);
  }
  await run("website", "sites/flutterings/test.mjs");
  if (!browserOnly)
    await run("database", "scripts/run-native-postgres-integration.mjs", [
      "--with-api",
    ]);
  if (!browserOnly)
    await run("services", "scripts/service-integration/run.mjs");
  if (!browserOnly)
    await run("passwords", "scripts/service-integration/passwords.mjs");
  report.status = report.suites.every((item) => item.status === "passed")
    ? "passed"
    : "failed";
} catch (error) {
  report.status = "failed";
  report.error = String(error);
} finally {
  report.finishedAt = new Date().toISOString();
  await persist();
  console.log(
    `Flow suite ${report.status}. Report: ${path.join(runDir, "summary.json")}`,
  );
  if (report.status !== "passed") process.exitCode = 1;
}
