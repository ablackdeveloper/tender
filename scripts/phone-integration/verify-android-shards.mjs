import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runFlows } from "./scenarios.mjs";

const root = path.resolve(process.argv[2]);
const files = readdirSync(root, { recursive: true }).filter(
  (file) => path.basename(file) === "summary.json",
);
const reports = files.map((file) =>
  JSON.parse(readFileSync(path.join(root, file), "utf8")),
);
const expected = [];
await runFlows({
  platform: "android",
  scenario: async (name) => expected.push(name),
});
const complete = {
  status: "failed",
  sourceSha: process.env.GITHUB_SHA,
  plannedScenarios: expected.length,
  results: reports.flatMap((report) => report.results),
  cleanup: false,
  reports: files,
};
try {
  assert.equal(expected.length, 30);
  assert.equal(
    reports.length,
    3,
    "Exactly three fresh shard reports are required",
  );
  assert.deepEqual(
    reports.map((report) => report.shard?.index).sort(),
    [1, 2, 3],
  );
  assert.match(process.env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
  for (const report of reports) {
    assert.equal(report.kind, "android-native-e2e");
    assert.equal(report.sourceSha, process.env.GITHUB_SHA);
    assert.equal(report.shard.count, 3);
    assert.equal(report.catalogScenarios, 30);
    assert.equal(report.status, "passed");
    assert.equal(report.cleanup, true);
    assert.equal(report.plannedScenarios, 10);
    assert.equal(report.results.length, 10);
    assert.match(report.apkSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      report.results.map((result) => result.name).sort(),
      [...report.selectedScenarios].sort(),
    );
  }
  assert.deepEqual(
    complete.results.map((result) => result.name).sort(),
    expected.sort(),
    "Every case must occur exactly once",
  );
  for (const result of complete.results) {
    assert.equal(result.status, "passed", result.name);
    assert.equal(result.cleanup, true, result.name);
    assert.equal(result.mailCleanup, true, result.name);
  }
  const navigation = complete.results.find(
    (result) => result.name === "android-navigation-and-secondary-routes",
  );
  const expectedImages = ["light", "dark"].flatMap((mode) =>
    ["today", "memories", "care", "together", "add"].map(
      (tab) => `tabs-${mode}-${tab}.png`,
    ),
  );
  assert.deepEqual(
    [...navigation.visualEvidence].sort(),
    expectedImages.sort(),
  );
  const navigationReportIndex = reports.findIndex((report) =>
    report.results.includes(navigation),
  );
  for (const name of expectedImages) {
    const bytes = readFileSync(
      path.join(root, path.dirname(files[navigationReportIndex]), name),
    );
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  }
  complete.cleanup = true;
  complete.status = "passed";
} catch (error) {
  complete.error = error.message;
  process.exitCode = 1;
} finally {
  writeFileSync(
    path.join(root, "complete.json"),
    JSON.stringify(complete, null, 2),
  );
  console.log(
    `Android complete: ${complete.status}; ${complete.results.filter((result) => result.status === "passed").length}/${expected.length} passed; cleanup=${complete.cleanup}`,
  );
}
