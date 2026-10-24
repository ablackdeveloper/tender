import assert from "node:assert/strict";
import { runFlows, scenarioCount } from "./scenarios.mjs";
import { androidScenarioCount } from "./android-user-flows.mjs";
export { scenarioCount } from "./scenarios.mjs";

export async function getFlowPlan(platform, index = 0, count = 1) {
  assert.ok(["ios", "android"].includes(platform));
  assert.ok(Number.isInteger(count) && count >= 1 && count <= 4);
  assert.ok(Number.isInteger(index) && index >= 0 && index < count);
  if (platform === "android") assert.equal(count, 1);
  const flows = [];
  await runFlows({
    platform,
    scenario: async (name, fn) => flows.push({ name, fn }),
  });
  const total =
    scenarioCount + (platform === "android" ? androidScenarioCount : 0);
  assert.equal(flows.length, total);
  assert.equal(new Set(flows.map(({ name }) => name)).size, total);
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
  return flows.filter((_, position) => position % count === index);
}
