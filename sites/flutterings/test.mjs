// Static website browser integration; fresh build and context for every run.
import assert from "node:assert/strict";
import { startServer } from "./server.mjs";
import { createHarness } from "../../scripts/feature-integration/harness.mjs";
const harness = await createHarness("website", {
  scope:
    "Local static website browser integration; not hosted or legal acceptance",
  ready: (page) => page.getByRole("heading", { level: 1 }).waitFor(),
  startServer: async () => {
    await import("./build.mjs");
    const { server, url } = await startServer();
    return {
      url,
      server: {
        close: () =>
          new Promise((resolve, reject) => {
            server.closeAllConnections();
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      },
    };
  },
});
const { url } = harness;
const scenario = (name, width, run) =>
  harness.scenario(name, "", run, "UTC", width);
let failure;
try {
  for (const width of [390, 768, 1440]) {
    await scenario(`home-${width}`, width, async (page) => {
      assert.equal((await page.goto(url)).status(), 200);
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
      await page.getByRole("tab", { name: "Memories", exact: true }).click();
      assert.equal(
        await page
          .getByRole("tab", { name: "Memories", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await page
        .getByRole("tabpanel", { name: "Memories", exact: true })
        .waitFor();
      await page.getByRole("tab", { name: "Today", exact: true }).click();
      assert.ok(
        await page
          .locator("img")
          .evaluateAll((images) =>
            images.every((i) => i.complete && i.naturalWidth > 0),
          ),
        "All images loaded",
      );
    });
  }
  for (const route of [
    "features",
    "memories",
    "privacy",
    "support",
    "delete-account",
    "preview",
  ]) {
    for (const width of [390, 1440])
      await scenario(`page-${route}-${width}`, width, async (page) => {
        assert.equal((await page.goto(`${url}/${route}/`)).status(), 200);
        await page.getByRole("heading", { level: 1 }).waitFor();
        assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
        if (route === "privacy")
          await page
            .getByText("Draft policy — not ready for publication", {
              exact: true,
            })
            .waitFor();
        if (route === "delete-account")
          await page
            .getByText("External deletion contact: to be confirmed", {
              exact: true,
            })
            .waitFor();
        if (route === "preview")
          assert.match(
            await page
              .getByRole("link", {
                name: "Open working app preview",
                exact: true,
              })
              .getAttribute("href"),
            /^http:\/\/127\.0\.0\.1:5173\//,
          );
        await page.reload();
        await page.getByRole("heading", { level: 1 }).waitFor();
      });
  }
  await scenario("navigation-and-footer", 1440, async (page) => {
    await page.goto(url);
    const links = await page
      .locator('a[href^="/"]')
      .evaluateAll((nodes) => [
        ...new Set(nodes.map((n) => n.getAttribute("href"))),
      ]);
    for (const href of links)
      assert.equal(
        (await page.request.get(url + href.split("#")[0])).status(),
        200,
        href,
      );
    for (const name of ["Privacy policy", "Support", "Delete your account"]) {
      await page
        .locator("footer")
        .getByRole("link", { name, exact: true })
        .click();
      await page.getByRole("heading", { level: 1 }).waitFor();
    }
    await page.goto(`${url}/missing-page`);
    await page.getByRole("link", { name: "Back to home", exact: true }).click();
    await page.waitForURL(url + "/");
  });
  await scenario("keyboard-and-mobile-menu", 390, async (page) => {
    await page.goto(url);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").innerText(), "Skip to content");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(":focus").getAttribute("id"), "main");
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .getAttribute("aria-expanded"),
      "false",
    );
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Memories", exact: true })
      .click();
    await page.waitForURL(`${url}/memories/`);
  });
  await scenario("faq-and-no-tracking", 1440, async (page) => {
    const external = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== url) external.push(request.url());
    });
    await page.goto(`${url}/support/`);
    await page
      .locator("summary", { hasText: "Is Flutterings a medical service?" })
      .click();
    await page
      .getByText(
        "Flutterings does not diagnose symptoms or replace your care team.",
        { exact: true },
      )
      .waitFor();
    assert.deepEqual(external, []);
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    assert.equal((await page.context().cookies()).length, 0);
  });
} catch (error) {
  failure = error;
} finally {
  await harness.close(failure);
}
