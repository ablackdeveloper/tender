import assert from "node:assert/strict";
import { createHarness } from "./harness.mjs";
const harness = await createHarness("design-review");
const { url, output } = harness;
let failure;
try {
  await harness.scenario(
    "compassionate-memory-suppression",
    "screen=today",
    async (page) => {
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.getByRole("button", { name: "Memory", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Title (optional)", exact: true })
        .fill("Design review sample memory");
      await page
        .getByRole("textbox", { name: "Entry", exact: true })
        .fill("Disposable sample for the compassionate mode check.");
      await page
        .getByRole("checkbox", {
          name: "Include in gentle memory moments",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Save now", exact: true }).click();
      await page.getByText("Saved", { exact: true }).waitFor();
      await page.getByRole("tab", { name: "Today", exact: true }).click();
      await page
        .getByRole("button", { name: "Pregnancy settings", exact: true })
        .click();
      await page.locator('input[aria-label="Compassionate setting"]').check();
      await page
        .getByRole("button", { name: "Save pregnancy settings", exact: true })
        .click();
      await page.getByRole("tab", { name: "Memories", exact: true }).click();
      await page
        .getByRole("button", { name: "Add a memory", exact: true })
        .waitFor();
      const enabled = await page.evaluate(
        () => window.appFixture.pregnancy.compassionateMode,
      );
      const resurfaced = await page
        .getByRole("button", {
          name: "Open memory Design review sample memory",
          exact: true,
        })
        .count();
      const capsule = await page
        .getByRole("button", {
          name: "Review this week's capsule",
          exact: true,
        })
        .count();
      await page.addStyleTag({
        content:
          ".preview-header{display:none!important}.preview-shell{height:844px}",
      });
      await page
        .locator("main")
        .screenshot({ path: `${output}/compassionate-memories.png` });
      await page
        .getByRole("button", {
          name: "Open Design review sample memory",
          exact: true,
        })
        .waitFor();
      await page.getByRole("tab", { name: "Today", exact: true }).click();
      await page
        .getByRole("button", { name: "Pregnancy settings", exact: true })
        .waitFor();
      const todaySuggestion = await page
        .getByText("RECENT PRIVATE NOTE", { exact: true })
        .count();
      await page.goto(`${url}?screen=capsule`);
      await page
        .getByText("Memory suggestions are paused", { exact: true })
        .waitFor();
      const directCapsuleMemory = await page
        .getByText("Design review sample memory", { exact: true })
        .count();

      assert.equal(enabled, true);
      assert.deepEqual(
        [resurfaced, capsule, todaySuggestion, directCapsuleMemory],
        [0, 0, 0, 0],
      );
    },
  );
} catch (error) {
  failure = error;
} finally {
  await harness.close(failure);
}
