// Local experience review. Fresh browser contexts, synthetic records, no live services.
import { createRequire } from "node:module";
import { readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startServer } from "./server.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright",
);
const output = fileURLToPath(
  new URL("./artifacts/experience-review/", import.meta.url),
);
await mkdir(output, { recursive: true });
const appRoot = fileURLToPath(
  new URL("../../apps/mobile/src/app/", import.meta.url),
);
const files = (await readdir(appRoot, { recursive: true })).filter((name) =>
  /\.[jt]sx?$/.test(name),
);
const {
  getRoutes,
} = require("../../apps/mobile/node_modules/expo-router/build/getRoutes.js");
const context = () => {
  throw new Error("Screen modules must not execute during route inventory");
};
context.keys = () => files.map((name) => "./" + name.replaceAll("\\", "/"));
const tree = getRoutes(context, {
  platform: "ios",
  ignoreEntryPoints: true,
  ignoreRequireErrors: true,
  skipGenerated: true,
});
const routes = tree.children
  .find((node) => node.route === "(app)")
  .children.map((node) => node.route);
const layout = await readFile(appRoot + "/(app)/_layout.tsx", "utf8");
const declared = [...layout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map(
  (match) => match[1],
);
const undeclared = routes.filter(
  (route) =>
    !declared.some((name) => route === name || route === `${name}/index`),
);
const results = {
  routing: { routes, declared, undeclared },
  screens: [],
  journeys: [],
};
console.log(
  "Expo routes without explicit tab configuration:",
  undeclared.join(", "),
);
const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
async function fresh(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    reducedMotion: "reduce",
    timezoneId: "UTC",
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  return { context, page: await context.newPage() };
}
try {
  const screens = [
    "today",
    "memories",
    "reflection",
    "capsule",
    "care",
    "questions",
    "summary",
    "together",
    "planning",
    "journey",
    "recovery",
    "settings",
    "checkin",
    "meals",
    "meal",
    "notifications",
    "privacy",
    "health",
    "help",
  ];
  for (const width of [390, 320])
    for (const screen of screens) {
      const { context, page } = await fresh(width);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        const params =
          screen === "reflection"
            ? "&entryId=new"
            : screen === "meal"
              ? "&mealId=b2000000-0000-4000-8000-000000000001"
              : "";
        await page.goto(`${url}?screen=${screen}${params}`);
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({
          content:
            ".preview-header{display:none!important}.preview-shell{height:844px}",
        });
        const snapshot = await page.locator("main").innerText();
        const geometry = await page.locator("main").evaluate((main) => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          scrollRegions: [...main.querySelectorAll("*")].filter(
            (node) =>
              node.scrollHeight > node.clientHeight + 10 &&
              ["auto", "scroll"].includes(getComputedStyle(node).overflowY),
          ).length,
          smallTargets: [
            ...main.querySelectorAll(
              "button,[role=button],[role=tab],[role=checkbox]",
            ),
          ]
            .map((node) => ({
              name: node.getAttribute("aria-label") || node.textContent,
              rect: node.getBoundingClientRect(),
            }))
            .filter(
              (item) =>
                item.rect.width > 0 &&
                (item.rect.width < 44 || item.rect.height < 44),
            )
            .map((item) => ({
              name: item.name,
              width: item.rect.width,
              height: item.rect.height,
            })),
        }));
        results.screens.push({
          screen,
          width,
          errors,
          ...geometry,
          text: snapshot,
        });
        await page
          .locator("main")
          .screenshot({ path: `${output}/${screen}-${width}-top.png` });
        await page.locator("main").evaluate((main) =>
          [...main.querySelectorAll("*")]
            .filter(
              (node) =>
                node.scrollHeight > node.clientHeight &&
                ["auto", "scroll"].includes(getComputedStyle(node).overflowY),
            )
            .forEach((node) => {
              node.scrollTop = node.scrollHeight;
            }),
        );
        await page
          .locator("main")
          .screenshot({ path: `${output}/${screen}-${width}-bottom.png` });
        console.log(
          `REVIEW ${screen} ${width}: ${errors.length} errors, overflow=${geometry.overflow}`,
        );
      } finally {
        await context.close();
      }
    }
  // Draft recovery when a person opens Get Help from question capture.
  {
    const { context, page } = await fresh();
    try {
      await page.goto(`${url}?screen=questions`);
      await page
        .getByRole("textbox", { name: "Question", exact: true })
        .fill("Keep this question while I check help");
      await page
        .getByRole("button", { name: "Open Get Help", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Get help", exact: true })
        .waitFor();
      await page.goBack();
      const restored = await page
        .getByRole("textbox", { name: "Question", exact: true })
        .inputValue();
      results.journeys.push({
        name: "question-help-return",
        expected: "Keep this question while I check help",
        actual: restored,
      });
      await page.screenshot({ path: `${output}/question-help-return.png` });
    } finally {
      await context.close();
    }
  }
  // Compare two screens showing the same stored appointment in a different device zone.
  {
    const { context, page } = await fresh();
    try {
      await page.goto(`${url}?screen=care`);
      await page
        .getByRole("button", { name: "Add one question", exact: true })
        .waitFor();
      const appointment = await page.evaluate(() => {
        const item = window.appFixture.appointments[0];
        const date = new Date();
        date.setUTCDate(date.getUTCDate() + 1);
        date.setUTCHours(13, 0, 0, 0);
        item.startsAt = date.toISOString();
        item.timezone = "America/New_York";
        return { startsAt: item.startsAt, timezone: item.timezone };
      });
      await page.getByRole("tab", { name: "Today", exact: true }).click();
      await page
        .getByRole("button", { name: "Prepare for visit", exact: true })
        .waitFor();
      const today = await page.locator("main").innerText();
      await page.getByRole("tab", { name: "Care", exact: true }).click();
      await page
        .getByRole("button", { name: "Add one question", exact: true })
        .waitFor();
      const care = await page.locator("main").innerText();
      results.journeys.push({
        name: "appointment-timezone-consistency",
        deviceZone: "UTC",
        appointment,
        today,
        care,
      });
      await page.screenshot({ path: `${output}/appointment-timezone.png` });
      const dialogs = [];
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      });
      await page
        .getByRole("button", { name: "Delete appointment record", exact: true })
        .click();
      await page
        .getByText("No appointments recorded.", { exact: true })
        .waitFor();
      results.journeys.push({
        name: "appointment-single-tap-deletion",
        browserDialogs: dialogs,
        appDialogs: await page.getByRole("dialog").count(),
        remaining: await page.evaluate(
          () => window.appFixture.appointments.length,
        ),
      });
      await page.screenshot({ path: `${output}/appointment-deleted.png` });
    } finally {
      await context.close();
    }
  }
  // Model the null-pregnancy repository result produced when setup has no due date.
  {
    const { context, page } = await fresh();
    try {
      await page.route("**/app-data.ts", async (route) => {
        const response = await route.fetch();
        const source = (await response.text())
          .replace(
            /async getActivePregnancy\(\)\s*\{\s*return pregnancyId;/,
            "async getActivePregnancy() { return null;",
          )
          .replace(
            /async getToday\(\)\s*\{/,
            "async getToday() { return null;",
          );
        await route.fulfill({ response, body: source });
      });
      for (const screen of ["today", "memories", "settings"]) {
        await page.goto(`${url}?screen=${screen}`);
        await page.waitForLoadState("networkidle");
        results.journeys.push({
          name: `no-pregnancy-${screen}`,
          text: await page.locator("main").innerText(),
        });
        await page.screenshot({ path: `${output}/no-pregnancy-${screen}.png` });
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}
console.log(`Review evidence: ${output}`);
