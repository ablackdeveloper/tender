import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createServiceHarness, workspace } from "./harness.mjs";
import { passwordScenarioCount, runPasswordFlows } from "./password-flows.mjs";

let harness;
try {
  // Explicit opt-in keeps the user's ProtonPass requirement in force by default.
  assert.equal(
    process.env.TENDER_TEST_PASSWORD_SOURCE,
    "disposable-generated",
    "Password tests require permission to generate disposable local credentials. Set TENDER_TEST_PASSWORD_SOURCE=disposable-generated only after approval.",
  );
  const config = readFileSync(
    path.join(workspace, "supabase/config.toml"),
    "utf8",
  );
  assert.match(config, /^minimum_password_length\s*=\s*12\s*$/m);
  assert.match(
    config,
    /^password_requirements\s*=\s*"lower_upper_letters_digits_symbols"\s*$/m,
  );
  harness = await createServiceHarness({
    passwords: true,
    plannedScenarios: passwordScenarioCount,
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      harness.report.setupError = `Interrupted by ${signal}`;
      await harness.close();
      process.exit(130);
    });
  await runPasswordFlows(harness, () => ({
    // New values per case. No file, environment variable, report, or log contains them.
    old: `Aa1!${randomBytes(24).toString("hex")}`,
    next: `Bb2@${randomBytes(24).toString("hex")}`,
    third: `Cc3#${randomBytes(24).toString("hex")}`,
    boundary: `Dd4$${randomBytes(4).toString("hex")}`,
  }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (harness && (await harness.close()).status !== "passed")
    process.exitCode = 1;
}
