import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { startServer } from "./server.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("./artifacts/", import.meta.url));

// Shared lifecycle for real screen integration, never a unit-test runner.
export async function createHarness(name, options = {}) {
  const output = path.join(process.env.FLOW_RUN_DIR ?? root, name);
  await mkdir(output, { recursive: true });
  const report = {
    runId: process.env.FLOW_RUN_ID ?? randomUUID(),
    suite: name,
    startedAt: new Date().toISOString(),
    scope:
      options.scope ??
      "Production screens with synthetic browser service adapters; not native or hosted evidence",
    filter: process.env.SCENARIO_FILTER ?? null,
    status: "running",
    cleanup: false,
    results: [],
  };
  const persist = () =>
    writeFile(
      path.join(output, "results.json"),
      JSON.stringify(report, null, 2),
    );
  await persist(); // Replace earlier success before any fallible setup.
  let server, browser, url;
  try {
    ({ server, url } = await (options.startServer ?? startServer)());
    const { chromium } = require(
      process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright",
    );
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    report.status = "failed";
    report.setupError = String(error);
    await server?.close();
    report.cleanup = true;
    await persist();
    throw error;
  }
  const names = new Set();
  async function scenario(name, query, run, timezoneId = "UTC", width = 390) {
    assert.match(name, /^[a-zA-Z0-9_-]+$/, "safe, stable scenario name");
    assert.ok(!names.has(name), `duplicate scenario: ${name}`);
    names.add(name);
    if (report.filter && !name.includes(report.filter)) return;
    const started = Date.now();
    const result = {
      name,
      passed: false,
      errors: [],
      blockedRequests: [],
      serverErrors: [],
    };
    report.results.push(result);
    await persist();
    let context, page, timer;
    try {
      context = await browser.newContext({
        viewport: { width, height: 844 },
        timezoneId,
        locale: "en-US",
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      context.setDefaultTimeout(10000);
      context.setDefaultNavigationTimeout(20000);
      await context.addInitScript((origin) => {
        if (location.origin === origin)
          window.__initialStorageCount = localStorage.length;
      }, new URL(url).origin);
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
      await context.route("**/*", (route) => {
        const address = new URL(route.request().url());
        if (address.origin === new URL(url).origin) return route.continue();
        result.blockedRequests.push(address.origin);
        return route.abort("blockedbyclient");
      });
      await context.routeWebSocket("**/*", (socket) => {
        const address = new URL(socket.url());
        if (address.host === new URL(url).host && address.protocol === "ws:")
          socket.connectToServer();
        else {
          result.blockedRequests.push(address.origin);
          socket.close();
        }
      });
      context.on("page", (opened) => {
        opened.on("pageerror", (error) => result.errors.push(error.message));
        opened.on("response", (response) => {
          if (response.status() >= 500)
            result.serverErrors.push(`${response.status()} ${response.url()}`);
        });
      });
      page = await context.newPage();
      const work = async () => {
        await page.goto(`${url}?${query}`);
        if (options.ready) await options.ready(page);
        else await page.waitForFunction(() => Boolean(window.appFixture));
        assert.equal(
          await page.evaluate(() => window.__initialStorageCount),
          0,
          "fresh storage before application startup",
        );
        await run(page);
        await page.evaluate(() => document.fonts.ready);
        assert.deepEqual(
          result.errors,
          [],
          "no uncaught errors, including other tabs",
        );
        assert.deepEqual(result.serverErrors, [], "no server errors");
        assert.deepEqual(
          result.blockedRequests,
          [],
          "no requests outside the test server",
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "no horizontal overflow",
        );
        await page.screenshot({
          path: path.join(output, `${name}.png`),
          fullPage: true,
        });
      };
      await Promise.race([
        work(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Scenario exceeded 60 seconds")),
            60000,
          );
        }),
      ]);
      result.passed = true;
      console.log(`PASS ${name}`);
    } catch (error) {
      result.error = error.stack ?? String(error);
      await page
        ?.screenshot({
          path: path.join(output, `${name}-failed.png`),
          fullPage: true,
          timeout: 5000,
        })
        .catch(() => {});
      console.error(`FAIL ${name}: ${error.message}`);
    } finally {
      clearTimeout(timer);
      try {
        await context?.tracing.stop(
          result.passed ? {} : { path: path.join(output, `${name}-trace.zip`) },
        );
      } catch (error) {
        result.passed = false;
        result.traceError = String(error);
      }
      try {
        await context?.close();
      } catch (error) {
        result.passed = false;
        result.cleanupError = String(error);
      }
      result.durationMs = Date.now() - started;
      await persist();
    }
  }
  async function close(error) {
    if (error) report.suiteError = String(error);
    const cleanup = await Promise.allSettled([browser.close(), server.close()]);
    report.cleanup = cleanup.every((item) => item.status === "fulfilled");
    report.finishedAt = new Date().toISOString();
    report.discovered = names.size;
    report.status =
      !error &&
      report.cleanup &&
      report.results.length > 0 &&
      report.results.every((item) => item.passed)
        ? "passed"
        : "failed";
    if (!report.results.length)
      report.suiteError = "No scenarios selected. Check SCENARIO_FILTER.";
    await persist();
    if (report.status !== "passed")
      throw new Error(
        `${name} failed. See ${path.join(output, "results.json")}`,
      );
  }
  return { scenario, close, url, output };
}
