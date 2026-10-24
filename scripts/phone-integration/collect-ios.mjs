import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getFlowPlan, scenarioCount } from "./flow-plan.mjs";

// Validate real CI reports. This is an evidence gate, not a unit-test suite.
const input = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const count = 4;
const result = {
  kind: "ios-native-e2e-suite",
  status: "failed",
  plannedScenarios: scenarioCount,
  sourceCommit: process.env.GITHUB_SHA,
  ciRunId: process.env.GITHUB_RUN_ID,
  ciRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
  shards: [],
  issues: [],
};
const seen = [];
const runIds = new Set();
const driverSessionIds = new Set();
const verifyDriverCleanup = (session) => {
  assert.equal(session?.cleanup, true);
  assert.equal(
    session.driverAppRemoved,
    true,
    "XCTest app removal was not verified",
  );
  assert.ok(Array.isArray(session.exitedProcessEntries));
  assert.ok(
    session.exitedProcessEntries.every((entry) => entry.state.startsWith("Z")),
    "A live driver process survived cleanup",
  );
};
for (let index = 0; index < count; index++) {
  try {
    const root = path.join(
      input,
      `ios-phone-evidence-${result.ciRunAttempt}-${index}`,
    );
    const files = readdirSync(root, { recursive: true }).filter(
      (name) => path.basename(name) === "summary.json",
    );
    assert.equal(files.length, 1, "Expected exactly one harness report");
    const report = JSON.parse(readFileSync(path.join(root, files[0]), "utf8"));
    const vm = JSON.parse(
      readFileSync(path.join(root, "vm-cleanup.json"), "utf8"),
    );
    const expected = (await getFlowPlan("ios", index, count)).map(
      ({ name }) => name,
    );
    result.shards.push({
      index,
      runId: report.runId,
      status: report.status,
      cleanup: report.cleanup,
      vmCleanup: vm.cleanup,
      driverReadiness: report.driverReadiness,
      driverBuild: report.driverBuild,
      results: report.results.map(
        ({ name, status, cleanup, mailCleanup, driverSession }) => ({
          name,
          status,
          cleanup,
          mailCleanup,
          driverSession,
        }),
      ),
    });
    seen.push(...report.results.map(({ name }) => name));
    assert.ok(!runIds.has(report.runId), "Shard run IDs must be unique");
    runIds.add(report.runId);
    for (const key of ["sourceCommit", "ciRunId", "ciRunAttempt"]) {
      assert.ok(result[key], `Missing CI identity: ${key}`);
      assert.equal(
        report[key],
        result[key],
        `Harness identity mismatch: ${key}`,
      );
      assert.equal(vm[key], result[key], `VM identity mismatch: ${key}`);
    }
    assert.deepEqual(report.shard, { index, count });
    assert.equal(vm.shardIndex, index);
    assert.equal(report.kind, "ios-native-e2e-shard");
    assert.equal(report.totalScenarios, scenarioCount);
    assert.equal(report.plannedScenarios, expected.length);
    assert.deepEqual(report.plannedScenarioNames, expected);
    assert.deepEqual(
      report.results.map(({ name }) => name),
      expected,
      "Missing or reordered cases",
    );
    assert.equal(report.driverReadiness?.status, "passed");
    assert.equal(report.driverReadiness?.cleanup, true);
    assert.equal(report.driverReadiness?.failurePropagation, true);
    assert.equal(report.driverReadiness?.sessionReuse, true);
    verifyDriverCleanup(report.driverReadiness?.driverSession);
    verifyDriverCleanup(report.nativeStartupDriverSession);
    assert.equal(report.driverBuild?.status, "passed");
    assert.equal(report.driverBuild?.cleanup, true);
    assert.equal(report.driverBuild?.patch, "springboard-alert-hierarchy-v1");
    assert.deepEqual(report.driverBuild?.onlyTestIdentifiers, [
      "maestro_driver_iosUITests/testHttpServer",
    ]);
    assert.equal(report.cleanup, true, "Harness cleanup failed");
    assert.equal(vm.cleanup, true, "VM cleanup failed");
    for (const test of report.results) {
      assert.equal(test.driverSession?.kind, "maestro-mcp-per-case");
      verifyDriverCleanup(test.driverSession);
      assert.ok(test.driverSession.batches > 0);
      assert.ok(
        !driverSessionIds.has(test.driverSession.id),
        "Cases must not share a driver session",
      );
      driverSessionIds.add(test.driverSession.id);
      assert.equal(test.cleanup, true, `Case cleanup failed: ${test.name}`);
      assert.equal(
        test.mailCleanup,
        true,
        `Inbox cleanup failed: ${test.name}`,
      );
      assert.equal(test.status, "passed", `Flow failed: ${test.name}`);
    }
    assert.equal(report.status, "passed");
    assert.ok(!report.error, "Harness reported an error");
  } catch (error) {
    result.issues.push({ shard: index, error: error.message });
  }
}
try {
  const expected = (await getFlowPlan("ios")).map(({ name }) => name).sort();
  assert.deepEqual(
    [...seen].sort(),
    expected,
    "Suite must execute all 19 cases exactly once",
  );
} catch (error) {
  result.issues.push({ error: error.message });
}
result.executedScenarios = seen.length;
result.passedScenarios = result.shards
  .flatMap((s) => s.results)
  .filter((r) => r.status === "passed").length;
result.cleanup =
  result.shards.length === count &&
  result.shards.every(
    (s) =>
      s.cleanup &&
      s.vmCleanup &&
      s.driverReadiness?.cleanup &&
      s.driverBuild?.cleanup &&
      s.results.every(
        (r) => r.cleanup && r.mailCleanup && r.driverSession?.cleanup,
      ),
  );
if (result.issues.length === 0 && result.cleanup) result.status = "passed";
mkdirSync(output, { recursive: true });
writeFileSync(
  path.join(output, "summary.json"),
  JSON.stringify(result, null, 2),
);
console.log(
  `iOS suite: ${result.passedScenarios}/${scenarioCount} passed; executed=${result.executedScenarios}; cleanup=${result.cleanup}`,
);
for (const issue of result.issues)
  console.error(
    `iOS evidence failure: shard ${issue.shard ?? "all"}: ${issue.error}`,
  );
if (result.status !== "passed") process.exitCode = 1;
