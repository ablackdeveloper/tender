import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startServer } from "../../scripts/feature-integration/server.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright",
);
const target = fileURLToPath(new URL("./assets/", import.meta.url));
await mkdir(target, { recursive: true });
const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  await page.goto(`${url}?screen=today`);
  await page.getByRole("heading", { name: /^Week \d+$/ }).waitFor();
  await page.evaluate(() => {
    window.appFixture.appointments[0].title = "Your next appointment";
  });
  async function capture(name) {
    await page.evaluate(() => document.fonts.ready);
    const style = await page.addStyleTag({
      content:
        ".preview-header { display:none !important } .preview-shell { height:844px }",
    });
    await page
      .locator("main")
      .screenshot({ path: `${target}/app-${name}.png` });
    await style.evaluate((node) => node.remove());
  }
  await page.getByRole("tab", { name: "Care", exact: true }).click();
  await page
    .getByRole("button", { name: "Add one question", exact: true })
    .waitFor();
  await capture("care");
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  await page.getByRole("heading", { name: /^Week \d+$/ }).waitFor();
  await capture("today");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Title (optional)", exact: true })
    .fill("The first little flutter");
  await page
    .getByRole("textbox", { name: "Entry", exact: true })
    .fill("A small moment I want to remember.");
  await page
    .getByRole("checkbox", {
      name: "Include in gentle memory moments",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await page.getByText("Saved", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Memories", exact: true }).click();
  await page
    .getByRole("button", { name: "Review this week's capsule", exact: true })
    .waitFor();
  await capture("memories");
  await page
    .getByRole("combobox", { name: "Demo stage" })
    .selectOption("birth");
  await page
    .getByRole("heading", { name: "Support after birth", exact: true })
    .waitFor();
  await capture("recovery");
  console.log("Captured four real app screens using isolated sample records.");
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
