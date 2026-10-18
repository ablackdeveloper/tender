// Integration tests of the runner itself: real browser, real server, real reports.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHarness } from "./harness.mjs";

const checks = [];
const harness = await createHarness("runner-probes");
await harness.scenario("intentional-failure", "screen=today", async () => {
  throw new Error("Expected runner probe");
});
await harness.scenario(
  "continues-with-clean-storage",
  "screen=today",
  async (page) => {
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    await page.evaluate(() =>
      localStorage.setItem("probe", "only this context"),
    );
  },
);
await harness.scenario(
  "next-context-is-empty",
  "screen=today",
  async (page) => {
    assert.equal(
      await page.evaluate(() => localStorage.getItem("probe")),
      null,
    );
  },
);
await harness.scenario(
  "external-request-is-blocked",
  "screen=today",
  async (page) => {
    await page.goto("https://example.invalid/runner-probe");
  },
);
await harness.scenario(
  "other-loopback-port-is-blocked",
  "screen=today",
  async (page) => {
    await page.goto("http://127.0.0.1:49999/runner-probe");
  },
);
await assert.rejects(() => harness.close(), /runner-probes failed/);
const report = JSON.parse(
  await readFile(path.join(harness.output, "results.json"), "utf8"),
);
assert.equal(report.cleanup, true);
assert.deepEqual(
  report.results.map((item) => item.passed),
  [false, true, true, false, false],
);
assert.deepEqual(report.results[3].blockedRequests, [
  "https://example.invalid",
]);
assert.deepEqual(report.results[4].blockedRequests, ["http://127.0.0.1:49999"]);
checks.push(
  "failure persists and cannot report success",
  "runner continues after failure",
  "storage does not leak between contexts",
  "external request blocked",
  "other loopback port blocked",
  "cleanup after failure",
);
await assert.rejects(() => fetch(harness.url), /fetch failed/);
checks.push("test server stopped");
const previous = process.env.SCENARIO_FILTER;
process.env.SCENARIO_FILTER = "no-such-scenario";
const empty = await createHarness("runner-empty");
try {
  await empty.scenario("real-scenario", "screen=today", async () => {});
  await assert.rejects(() => empty.close(), /runner-empty failed/);
  const result = JSON.parse(
    await readFile(path.join(empty.output, "results.json"), "utf8"),
  );
  assert.equal(result.status, "failed");
  assert.equal(result.results.length, 0);
  checks.push("empty filter fails");
} finally {
  if (previous === undefined) delete process.env.SCENARIO_FILTER;
  else process.env.SCENARIO_FILTER = previous;
}
await writeFile(
  path.join(
    process.env.FLOW_RUN_DIR ?? path.dirname(harness.output),
    "harness-checks.json",
  ),
  JSON.stringify(
    { runId: process.env.FLOW_RUN_ID, passed: true, checks },
    null,
    2,
  ),
);
console.log(
  `PASS ${checks.length} harness integration checks (probe failures above are expected)`,
);
