import assert from "node:assert/strict";
import { createHarness } from "./harness.mjs";
const harness = await createHarness("home-preferences");
const { url } = harness;
const scenario = (name, run) => harness.scenario(name, "screen=today", run);
const button = (page, name) => page.getByRole("button", { name, exact: true });
const choice = (page, name) =>
  page.getByRole("checkbox", { name, exact: true });
const open = (page) => button(page, "Today preferences").click();
const save = async (page) => {
  await button(page, "Save preferences").click();
  await page.getByText("Today preferences saved.", { exact: true }).waitFor();
};

let failure;
try {
  await scenario("independent-controls-refresh-journey", async (page) => {
    await open(page);
    await choice(page, "Show due-date wording").click();
    await save(page);
    await page.reload();
    await open(page);
    assert.equal(
      await choice(page, "Show due-date wording").isChecked(),
      false,
    );
    assert.equal(await choice(page, "Show progress counts").isChecked(), true);
    await choice(page, "Show progress counts").click();
    await choice(page, "Show weekly reading").click();
    await save(page);
    await page.reload();
    await button(page, "Today preferences").waitFor();
    assert.equal(
      await page
        .getByText("Synthetic reviewed reading", { exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.getByRole("heading", { name: /^Week / }).count(),
      0,
    );
    await page.goto(`${url}?screen=journey`);
    await page
      .getByText("Journey progression is hidden", { exact: true })
      .waitFor();
    await page.goto(`${url}?screen=today`);
    await open(page);
    await choice(page, "Show weekly reading").click();
    await save(page);
    await page.goto(`${url}?screen=journey`);
    await page
      .getByRole("heading", { name: "Synthetic reviewed reading", exact: true })
      .waitFor();
    assert.equal(await page.getByText(/Estimated due date:/).count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: /current approximate week/ })
        .count(),
      0,
    );
  });
  await scenario("focus-cancel-refresh-priority", async (page) => {
    await open(page);
    await choice(page, "Memories").click();
    await button(page, "Cancel").click();
    await open(page);
    assert.equal(await choice(page, "Balanced").isChecked(), true);
    await choice(page, "Memories").click();
    await save(page);
    await page.reload();
    await button(page, "Prepare for visit").waitFor();
    await button(page, "Not today").click();
    await page.getByText("Make room for a memory", { exact: true }).waitFor();
    await button(page, "Open Memories").click();
    await page.waitForURL(/screen=memories/);
  });
  await scenario("onboarding-focus-draft", async (page) => {
    await page.goto(`${url}?screen=onboarding&noPregnancy=1`);
    await button(page, "Not sure yet — skip").click();
    await button(page, "Continue").click();
    await page.getByText("Choose your home focus", { exact: true }).waitFor();
    await choice(page, "Support").click();
    await page.reload();
    await choice(page, "Support").waitFor();
    assert.equal(await choice(page, "Support").isChecked(), true);
    await button(page, "Continue").click();
    await button(page, "Got it").click();
    await button(page, "Finish setup").click();
    await page.waitForURL(/screen=today/);
    await open(page);
    assert.equal(await choice(page, "Support").isChecked(), true);
  });
  await scenario("offline-preferences", async (page) => {
    await page.goto(`${url}?screen=today&offline=1`);
    await open(page);
    await choice(page, "Support").click();
    assert.equal(await button(page, "Save preferences").isDisabled(), true);
    await page
      .getByText("Connect to save these choices.", { exact: true })
      .waitFor();
  });
  await scenario("failed-save-retains-choices", async (page) => {
    await open(page);
    await choice(page, "Care preparation").click();
    await page.evaluate(() => {
      window.fixture.failNext = true;
    });
    await button(page, "Save preferences").click();
    await page
      .getByText(
        "Preferences could not be saved. Your choices are still here. Try again.",
        { exact: true },
      )
      .waitFor();
    assert.equal(await choice(page, "Care preparation").isChecked(), true);
    await save(page);
    await page.reload();
    await open(page);
    assert.equal(await choice(page, "Care preparation").isChecked(), true);
  });
  await scenario("compassionate-choice-precedence", async (page) => {
    await button(page, "Pregnancy settings").click();
    await page.locator('input[aria-label="Compassionate setting"]').check();
    await button(page, "Save pregnancy settings").click();
    await page.getByRole("tab", { name: "Today", exact: true }).click();
    await open(page);
    await choice(page, "Show weekly reading").click();
    await save(page);
    await open(page);
    await choice(page, "Show weekly reading").click();
    await save(page);
    await page.reload();
    await button(page, "Today preferences").waitFor();
    assert.equal(
      await page
        .getByText("Synthetic reviewed reading", { exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.getByText("RECENT PRIVATE NOTE", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("heading", { name: /^Week / }).count(),
      0,
    );
    await page.goto(`${url}?screen=journey`);
    await page
      .getByText("Journey progression is hidden", { exact: true })
      .waitFor();
  });
  await scenario("older-snapshot-keeps-records", async (page) => {
    // Simulate a snapshot saved before the optional preferences slice existed.
    await open(page);
    await save(page);
    await page.evaluate(() => {
      const key = "flutterings.preview.v1";
      const snapshot = JSON.parse(localStorage.getItem(key));
      delete snapshot.slices.homePreferences;
      localStorage.setItem(key, JSON.stringify(snapshot));
    });
    await page.reload();
    await button(page, "Today preferences").waitFor();
    assert.equal(
      await page.evaluate(() => window.appFixture.appointments.length),
      1,
    );
    await open(page);
    assert.equal(await choice(page, "Balanced").isChecked(), true);
    await save(page);
    await page.reload();
    await page.getByRole("tab", { name: "Care", exact: true }).click();
    await choice(page, "Fixture follow-up").waitFor();
  });
  await scenario("narrow-preferences", async (page) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await open(page);
    await choice(page, "Show size comparisons").click();
    await save(page);
    await open(page);
    assert.equal(
      await choice(page, "Show size comparisons").isChecked(),
      false,
    );
    await button(page, "Save preferences").scrollIntoViewIfNeeded();
  });
} catch (error) {
  failure = error;
} finally {
  await harness.close(failure);
}
