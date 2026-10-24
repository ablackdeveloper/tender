import assert from "node:assert/strict";
import { createHarness } from "./harness.mjs";
import { screens } from "./flow-catalog.mjs";

const harness = await createHarness("user-flows");
const { scenario, url } = harness;
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
const tab = (page, name) => page.getByRole("tab", { name, exact: true });
const key = "flutterings.preview.v1";
let failure;
try {
  for (const [screen, parameter, title] of [
    ["meal", "mealId", "Meal unavailable"],
    ["reflection", "entryId", "Unable to open entry"],
  ]) {
    for (const value of ["bad-id", "", "%3Cscript%3E"]) {
      await scenario(
        `invalid-${screen}-${value ? (value === "bad-id" ? "text" : "encoded") : "missing"}`,
        `screen=${screen}&${parameter}=${value}`,
        async (page) => {
          await page.getByText(title, { exact: true }).waitFor();
          assert.equal(await page.getByRole("textbox").count(), 0);
          await tab(page, "Today").click();
          await button(page, "Today preferences").waitFor();
        },
      );
    }
  }
  for (const width of [320, 390, 1280]) {
    for (const [screen, , role, name, query = ""] of screens) {
      await scenario(
        `route-${screen}-${width}`,
        `screen=${screen}&${query}`,
        async (page) => {
          const control = page.getByRole(role, { name, exact: true });
          await control.waitFor();
          assert.equal(
            await page
              .getByText("Unknown preview link", { exact: true })
              .count(),
            0,
          );
          await page.reload();
          await control.waitFor();
          // A cold link and refresh must retain the intended screen, not silently redirect.
          assert.equal(new URL(page.url()).searchParams.get("screen"), screen);
          if (screen !== "onboarding") {
            await tab(page, "Today").click();
            await button(page, "Today preferences").waitFor();
            await page.goBack();
            await control.waitFor();
          }
        },
        "UTC",
        width,
      );
    }
  }
  for (const kind of ["provider", "contact", "medication"]) {
    await scenario(
      `care-${kind}-save-reload-delete`,
      "screen=care",
      async (page) => {
        const medication = kind === "medication";
        await tab(page, medication ? "Records" : "Care team").click();
        const label = {
          provider: "Provider name",
          contact: "Contact name",
          medication: "Medication name as recorded",
        }[kind];
        const collection = {
          provider: "providers",
          contact: "contacts",
          medication: "medications",
        }[kind];
        const add = button(
          page,
          kind === "contact" ? "Add emergency contact" : `Add ${kind} record`,
        );
        assert.equal(await add.isDisabled(), true);
        await field(page, label).fill(`Synthetic ${kind}`);
        if (!medication)
          await field(page, "Phone")
            .nth(kind === "provider" ? 0 : 1)
            .fill("+12025550123");
        await add.click();
        await page.waitForFunction(
          (name) => window.appFixture[name].length === 1,
          collection,
        );
        await page.reload();
        await tab(page, medication ? "Records" : "Care team").click();
        await button(page, `Delete ${kind} record`).click();
        await button(page, "Cancel").click();
        assert.equal(
          await page.evaluate(
            (name) => window.appFixture[name].length,
            collection,
          ),
          1,
        );
        await button(page, `Delete ${kind} record`).click();
        await button(page, "Permanently delete record").click();
        await page.waitForFunction(
          (name) => window.appFixture[name].length === 0,
          collection,
        );
        await page.reload();
        await tab(page, medication ? "Records" : "Care team").click();
        assert.equal(await button(page, `Delete ${kind} record`).count(), 0);
      },
    );
  }
  for (const offline of [false, true]) {
    await scenario(
      `care-write-gates-${offline ? "offline" : "empty"}`,
      `screen=care${offline ? "&offline=1" : ""}`,
      async (page) => {
        await tab(page, "Care team").click();
        if (offline) {
          await field(page, "Provider name").fill("Local provider");
          await field(page, "Phone").first().fill("+12025550123");
          await field(page, "Contact name").fill("Local contact");
          await field(page, "Phone").last().fill("+12025550123");
        }
        assert.equal(
          await button(page, "Add provider record").isDisabled(),
          true,
        );
        assert.equal(
          await button(page, "Add emergency contact").isDisabled(),
          true,
        );
        await tab(page, "Records").click();
        if (offline)
          await field(page, "Medication name as recorded").fill("Local record");
        assert.equal(
          await button(page, "Add medication record").isDisabled(),
          true,
        );
        assert.deepEqual(
          await page.evaluate(() => [
            window.appFixture.providers.length,
            window.appFixture.contacts.length,
            window.appFixture.medications.length,
          ]),
          [0, 0, 0],
        );
      },
    );
  }
  await scenario(
    "care-save-failure-preserves-provider",
    "screen=care",
    async (page) => {
      await tab(page, "Care team").click();
      await field(page, "Provider name").fill("Retry provider");
      await field(page, "Phone").first().fill("+12025550123");
      await page.evaluate(() => {
        window.fixture.failNext = true;
      });
      await button(page, "Add provider record").click();
      await page
        .getByText(
          "That care record could not be saved. Review the fields and try again.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await field(page, "Provider name").inputValue(),
        "Retry provider",
      );
      assert.equal(
        await page.evaluate(() => window.appFixture.providers.length),
        0,
      );
      await button(page, "Add provider record").click();
      await page.waitForFunction(
        () => window.appFixture.providers.length === 1,
      );
    },
  );
  await scenario(
    "invitation-invalid-save-revoke-refresh",
    "screen=together",
    async (page) => {
      await tab(page, "Access").click();
      await field(page, "Email").fill("invalid-address");
      await button(page, "Send private invitation").click();
      await page
        .getByText("Permission change not completed", { exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(() => window.appFixture.invitations.length),
        0,
      );
      await field(page, "Email").fill("synthetic@example.invalid");
      await button(page, "Send private invitation").click();
      await button(page, "Revoke invitation").waitFor();
      await page.reload();
      await tab(page, "Access").click();
      await button(page, "Revoke invitation").click();
      await page.waitForFunction(
        () => window.appFixture.invitations[0].status === "revoked",
      );
      await page.reload();
      await tab(page, "Access").click();
      assert.equal(await button(page, "Revoke invitation").count(), 0);
    },
  );
  await scenario(
    "notification-invalid-time-retains-saved-state",
    "screen=notifications",
    async (page) => {
      await field(page, "Start (24-hour HH:MM)").fill("99:99");
      await button(page, "Save choices").click();
      await page.getByText("Settings not saved", { exact: true }).waitFor();
      assert.equal(
        await field(page, "Start (24-hour HH:MM)").inputValue(),
        "99:99",
      );
      assert.equal(
        await page.evaluate(
          () => window.appFixture.preferences.quietHoursStart,
        ),
        null,
      );
      await field(page, "Start (24-hour HH:MM)").fill("22:00");
      await field(page, "End (24-hour HH:MM)").fill("08:00");
      await button(page, "Save choices").click();
      await page
        .getByText("Notification choices saved.", { exact: true })
        .waitFor();
      await page.reload();
      assert.equal(
        await field(page, "Start (24-hour HH:MM)").inputValue(),
        "22:00",
      );
      assert.equal(
        await field(page, "End (24-hour HH:MM)").inputValue(),
        "08:00",
      );
    },
  );
  await scenario(
    "sign-out-cancel-device-boundary",
    "screen=privacy",
    async (page) => {
      await button(page, "Sign out").click();
      await button(page, "Stay signed in").click();
      assert.equal(await button(page, "Confirm sign out").count(), 0);
      await button(page, "Sign out").click();
      await button(page, "Confirm sign out").click();
      await page
        .getByRole("status")
        .filter({ hasText: "Signing out of an account requires" })
        .waitFor();
      assert.ok(await page.evaluate(() => window.appFixture.pregnancy.id));
    },
  );
  for (const payload of [
    "{broken",
    JSON.stringify({ version: 999, slices: {} }),
  ]) {
    await scenario(
      `corrupt-storage-preserved-${payload.startsWith("{broken") ? "json" : "version"}`,
      "screen=today",
      async (page) => {
        await page.evaluate(
          ({ key, payload }) => localStorage.setItem(key, payload),
          { key, payload },
        );
        await page.reload();
        await page
          .getByRole("status", { name: "Preview save status" })
          .filter({ hasText: "could not be read" })
          .waitFor();
        await button(page, "Today preferences").click();
        await button(page, "Save preferences").click();
        assert.equal(
          await page.evaluate((key) => localStorage.getItem(key), key),
          payload,
        );
      },
    );
  }
} catch (error) {
  failure = error;
} finally {
  await harness.close(failure);
}
