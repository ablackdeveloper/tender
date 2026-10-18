import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHarness } from "./harness.mjs";
const require = createRequire(import.meta.url);
const harness = await createHarness("experience-fixes");
const { scenario, url } = harness;
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });

let failure;
try {
  const appRoot = fileURLToPath(
    new URL("../../apps/mobile/src/app/", import.meta.url),
  );
  const files = (await readdir(appRoot, { recursive: true })).filter((name) =>
    /\.[jt]sx?$/.test(name),
  );
  const {
    getRoutes,
  } = require("../../apps/mobile/node_modules/expo-router/build/getRoutes.js");
  const modules = () => {
    throw new Error("Route inventory must not execute screen modules");
  };
  modules.keys = () => files.map((name) => "./" + name.replaceAll("\\", "/"));
  const routes = getRoutes(modules, {
    platform: "ios",
    ignoreEntryPoints: true,
    ignoreRequireErrors: true,
    skipGenerated: true,
  })
    .children.find((node) => node.route === "(app)")
    .children.map((node) => node.route);
  const layout = await readFile(appRoot + "/(app)/_layout.tsx", "utf8");
  const declared = [...layout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(
    routes.filter(
      (route) =>
        !declared.some((name) => route === name || route === `${name}/index`),
    ),
    [],
  );

  await scenario("care-delete-cancel-confirm", "screen=care", async (page) => {
    await button(page, "Delete appointment record").click();
    assert.equal(
      await page.evaluate(() => window.appFixture.appointments.length),
      1,
    );
    await page
      .getByText(
        "This also removes questions and notes for this appointment. This cannot be undone.",
        { exact: true },
      )
      .waitFor();
    await button(page, "Cancel").click();
    assert.equal(
      await page.evaluate(() => window.appFixture.appointments.length),
      1,
    );
    await button(page, "Delete appointment record").click();
    await button(page, "Permanently delete record").click();
    await page.waitForFunction(
      () => window.appFixture.appointments.length === 0,
    );
  });
  await scenario(
    "question-draft-back-refresh-offline",
    "screen=questions",
    async (page) => {
      await field(page, "Question").fill("Keep this question after leaving.");
      await page
        .getByRole("checkbox", { name: "Fixture follow-up", exact: true })
        .click();
      await page
        .getByRole("checkbox", { name: "If time", exact: true })
        .click();
      await page
        .getByText("Question draft saved on this device.", { exact: true })
        .waitFor();
      await button(page, "Open Get Help").click();
      await page.goBack();
      await field(page, "Question").waitFor();
      assert.equal(
        await field(page, "Question").inputValue(),
        "Keep this question after leaving.",
      );
      await page.reload();
      await page
        .getByText("Question draft saved on this device.", { exact: true })
        .waitFor();
      assert.equal(
        await field(page, "Question").inputValue(),
        "Keep this question after leaving.",
      );
      await page.goto(`${url}?screen=questions&offline=1`);
      await field(page, "Question").fill("An offline question stays here.");
      await page
        .getByText("Question draft saved on this device.", { exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByText("Question draft saved on this device.", { exact: true })
        .waitFor();
      assert.equal(
        await field(page, "Question").inputValue(),
        "An offline question stays here.",
      );
      assert.equal(await button(page, "Save question").isDisabled(), true);
      await page.goto(`${url}?screen=questions`);
      await button(page, "Save question").click();
      await page.waitForFunction(() => window.fixture.questions.length === 1);
      assert.equal(
        await page.evaluate(() => window.fixture.questions[0].priority),
        2,
      );
      await button(page, "Add one question").click();
      await field(page, "Question").waitFor();
      assert.equal(await field(page, "Question").inputValue(), "");
    },
  );
  for (const zone of ["UTC", "Asia/Tokyo"])
    await scenario(
      `care-time-${zone.replace("/", "-")}`,
      "screen=care",
      async (page) => {
        await button(page, "Delete appointment record").waitFor();
        await page.evaluate(() => {
          const snapshot = JSON.parse(
            localStorage.getItem("flutterings.preview.v1") || "null",
          );
          // The fixture is saved by a harmless setting action below, if no snapshot exists yet.
          window.appFixture.appointments[0].startsAt = "2040-10-18T13:00:00Z";
        });
        await page.getByRole("tab", { name: "Today", exact: true }).click();
        await button(page, "Pregnancy settings").click();
        await button(page, "Save pregnancy settings").click();
        await page.getByRole("tab", { name: "Care", exact: true }).click();
        await page.reload();
        const stamp = await page.evaluate(() =>
          new Intl.DateTimeFormat(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/New_York",
            timeZoneName: "short",
          }).format(new Date("2040-10-18T13:00:00Z")),
        );
        await page.getByText(stamp, { exact: true }).waitFor();
        await page.getByRole("tab", { name: "Today", exact: true }).click();
        await page.getByText(stamp, { exact: false }).first().waitFor();
      },
      zone,
    );
  await scenario(
    "appointment-calendar-narrow",
    "screen=care&noAppointment=1",
    async (page) => {
      await field(page, "Appointment title").fill("Calendar visit");
      await button(page, "Appointment date").click();
      await button(page, "Next month").click();
      const day = new Date();
      day.setDate(1);
      day.setMonth(day.getMonth() + 1);
      day.setDate(15);
      await button(
        page,
        day.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      ).click();
      await field(page, "Hour (0–23)").fill("99");
      assert.equal(
        await button(page, "Add appointment record").isDisabled(),
        true,
      );
      await field(page, "Hour (0–23)").fill("9");
      await field(page, "Minute (0–59)").fill("30");
      await button(page, "Add appointment record").click();
      await page.waitForFunction(
        () => window.appFixture.appointments.length === 1,
      );
      assert.match(
        await page.evaluate(() => window.appFixture.appointments[0].startsAt),
        /T09:30:00.000Z$/,
      );
    },
    "UTC",
    320,
  );
  await scenario(
    "onboarding-skip-memory-add-date",
    "screen=onboarding&noPregnancy=1",
    async (page) => {
      await button(page, "Not sure yet — skip").click();
      await button(page, "Continue").click();
      await page.getByText("Choose your home focus", { exact: true }).waitFor();
      await button(page, "Continue").click();
      await button(page, "Got it").click();
      await button(page, "Finish setup").click();
      await page.waitForURL("**/?screen=today");
      await page.getByRole("tab", { name: "Memories", exact: true }).click();
      await button(page, "Add a memory").click();
      await field(page, "Title (optional)").fill("An undated memory");
      await field(page, "Entry").fill("No due date is needed.");
      await button(page, "Save now").click();
      await page.getByText("Saved", { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => window.appFixture.pregnancy.estimatedDueDate),
        null,
      );
      await page.getByRole("tab", { name: "Today", exact: true }).click();
      await button(page, "Pregnancy settings").click();
      await button(page, "Estimated due date").click();
      const date = new Date();
      date.setDate(15);
      await button(
        page,
        date.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      ).click();
      await button(page, "Save due date").click();
      await page.getByText("Due date saved.", { exact: true }).waitFor();
      await page.reload();
      assert.ok(
        await page.evaluate(() => window.appFixture.pregnancy.estimatedDueDate),
      );
      assert.equal(
        await page.evaluate(() => window.appFixture.entries.length),
        1,
      );
      assert.equal(
        await page.evaluate(() => window.appFixture.preferences.appointment),
        false,
      );
    },
  );
  await scenario(
    "checkin-progressive-disclosure",
    "screen=checkin",
    async (page) => {
      await button(page, "Emotions").waitFor();
      assert.equal(
        await page
          .getByRole("checkbox", { name: "Tiredness", exact: true })
          .count(),
        0,
      );
      await button(page, "Symptoms or observations").click();
      await page
        .getByRole("checkbox", { name: "Tiredness", exact: true })
        .click();
      await button(page, "Symptoms or observations").click();
      await button(page, "Symptoms or observations").click();
      await page.getByText("1 selected", { exact: true }).waitFor();
      await page.waitForFunction(() =>
        window.appFixture.checkin?.values.symptoms.some(
          (item) => item.slug === "tiredness",
        ),
      );
    },
  );
  await scenario("memory-filters", "screen=memories", async (page) => {
    await button(page, "Add a memory").click();
    await field(page, "Title (optional)").fill("Filter sample");
    await field(page, "Entry").fill("Private filter sample.");
    await button(page, "Save now").click();
    await page.getByText("Saved", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "Memories", exact: true }).click();
    assert.equal(await field(page, "Search memories").count(), 0);
    await button(page, "Filter memories").click();
    await page
      .getByRole("checkbox", { name: "Meals only", exact: true })
      .click();
    await button(page, "Show results").click();
    await page.getByText("No matching memories", { exact: true }).waitFor();
    await button(page, "Filters active").click();
    await button(page, "Clear filters").click();
    await button(page, "Show results").click();
    await button(page, "Open Filter sample").waitFor();
  });
  await scenario(
    "signout-confirmation-preview-limit",
    "screen=privacy",
    async (page) => {
      await button(page, "Sign out").click();
      await button(page, "Stay signed in").click();
      assert.equal(await button(page, "Confirm sign out").count(), 0);
      await button(page, "Sign out").click();
      await button(page, "Confirm sign out").click();
      await page
        .getByText(/Signing out of an account requires the installed app/)
        .waitFor();
    },
  );
  await scenario(
    "notification-zone-search",
    "screen=notifications",
    async (page) => {
      await button(page, "Choose time zone").click();
      await field(page, "Find a city or region").fill("Tokyo");
      await button(page, "Asia/Tokyo").click();
      await button(page, "Save choices").click();
      await page.waitForFunction(
        () => window.appFixture.preferences.timezone === "Asia/Tokyo",
      );
    },
  );
} catch (error) {
  failure = error;
} finally {
  await harness.close(failure);
}
