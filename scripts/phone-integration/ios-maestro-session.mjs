import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { freemem, loadavg, totalmem } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { saveMaestroDiagnostics } from "./maestro-diagnostics.mjs";

// Maestro 2.11's official MCP interface retains its XCTest session between
// command groups. One process belongs to one case; no session crosses cases.
const driverPort = 22087;
async function driverListening() {
  return new Promise((resolve, reject) => {
    // A cold CI host can delay a TCP refusal beyond a short client timeout.
    // Ask the kernel whether the exact loopback port can be bound instead.
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolve(true);
      else
        reject(
          new Error(`Cannot verify XCTest port ownership (${error.code})`),
        );
    });
    probe.listen(
      { host: "127.0.0.1", port: driverPort, exclusive: true },
      () => {
        probe.close((error) => (error ? reject(error) : resolve(false)));
      },
    );
  });
}

export async function createIosMaestroSession({
  maestro,
  serial,
  root,
  output,
  label,
  redact,
}) {
  assert.equal(process.platform, "darwin");
  assert.match(serial, /^[0-9A-F-]{36}$/i);
  assert.match(label, /^[a-z0-9-]+$/);
  assert.equal(
    await driverListening(),
    false,
    "XCTest port already has an owner",
  );
  const directory = mkdtempSync(path.join(root, "ios-maestro-"));
  const temp = path.join(directory, "tmp");
  mkdirSync(temp);
  // The JVM option parser treats whitespace as an option separator.
  assert.ok(!/\s/.test(temp), "Use a CI temporary directory without spaces");
  const receipt = {
    id: randomUUID(),
    kind: "maestro-mcp-per-case",
    batches: 0,
    cleanup: false,
    startedAt: new Date().toISOString(),
    protocolBytes: 0,
    diagnosticBytes: 0,
    handshakeTimeoutMs: 300000,
  };
  const child = spawn(
    maestro,
    ["mcp", "--no-viewer", "--working-dir", directory],
    {
      cwd: directory,
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        MAESTRO_CLI_NO_ANALYTICS: "1",
        XDG_STATE_HOME: path.join(directory, "state"),
        TMPDIR: temp,
        JAVA_TOOL_OPTIONS:
          `${process.env.JAVA_TOOL_OPTIONS ?? ""} -Djava.io.tmpdir=${temp}`.trim(),
      },
    },
  );
  let sequence = 0,
    pending,
    buffer = "",
    stderr = "",
    stderrTruncated = false,
    stopped = false,
    closed = false;
  const exited = new Promise((resolve) => {
    child.once("close", () => {
      stopped = true;
      resolve();
    });
  });
  const fail = (error) => {
    if (!pending) return;
    const current = pending;
    pending = undefined;
    clearTimeout(current.timer);
    current.reject(error);
  };
  child.on("error", () =>
    fail(new Error("Owned Maestro process failed to start")),
  );
  child.on("spawn", () => {
    receipt.spawnedAt = new Date().toISOString();
  });
  child.on("exit", () =>
    fail(new Error("Owned Maestro process exited before its response")),
  );
  child.stdin.on("error", () => fail(new Error("Owned Maestro input closed")));
  child.stderr.on("data", (data) => {
    receipt.diagnosticBytes += data.length;
    stderr += data.toString();
    if (stderr.length > 1048576) {
      stderrTruncated = true;
      stderr = stderr.slice(-1048576);
    }
  });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (data) => {
    receipt.protocolBytes += Buffer.byteLength(data);
    buffer += data;
    if (buffer.length > 4194304) {
      buffer = "";
      fail(new Error("Maestro protocol response exceeded its limit"));
      return;
    }
    let end;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        fail(new Error("Invalid Maestro protocol response; contents omitted"));
        continue;
      }
      if (message.id === undefined) continue; // Protocol notifications carry no result.
      if (!pending || message.id !== pending.id) {
        fail(new Error("Unexpected Maestro protocol response ID"));
        continue;
      }
      const current = pending;
      pending = undefined;
      clearTimeout(current.timer);
      if (message.error)
        current.reject(new Error("Maestro protocol request failed"));
      else current.resolve(message.result);
    }
  });
  const request = (method, params, timeout = 600000) => {
    assert.ok(
      !closed && !stopped && !pending,
      "Maestro session is not available",
    );
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending = {
        id,
        resolve,
        reject,
        timer: setTimeout(
          () => fail(new Error(`Maestro ${method} request timed out`)),
          timeout,
        ),
      };
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
      );
    });
  };
  const processGroup = async () => {
    if (!child.pid) return [];
    const { stdout } = await promisify(execFile)(
      "/bin/ps",
      ["-axo", "pid=,pgid=,uid=,stat="],
      { timeout: 10000, killSignal: "SIGKILL", maxBuffer: 1048576 },
    );
    return stdout
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const fields = line.trim().split(/\s+/);
        assert.equal(fields.length, 4, "Invalid process-state response");
        assert.ok(fields.slice(0, 3).every((value) => /^\d+$/.test(value)));
        return {
          pid: Number(fields[0]),
          group: Number(fields[1]),
          uid: Number(fields[2]),
          state: fields[3],
        };
      })
      .filter((entry) => entry.group === child.pid);
  };
  const live = (entries) =>
    entries.filter((entry) => !entry.state.startsWith("Z"));
  const close = async () => {
    if (closed) {
      assert.equal(receipt.cleanup, true, "Earlier Maestro cleanup failed");
      return;
    }
    closed = true;
    fail(new Error("Maestro session closed"));
    child.stdin.end();
    let timer;
    try {
      await Promise.race([
        exited,
        new Promise((resolve) => {
          timer = setTimeout(resolve, 30000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    try {
      let members = await processGroup();
      if (live(members).length) {
        assert.ok(
          live(members).every((entry) => entry.uid === process.getuid()),
          "Owned process group contains a different user",
        );
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          // XNU excludes zombies from group signals and can return EPERM for
          // a group whose members have all exited. Never ignore a live owner.
          if (error.code !== "ESRCH" && error.code !== "EPERM") throw error;
          members = await processGroup();
          assert.equal(
            live(members).length,
            0,
            "Owned process termination failed",
          );
        }
        try {
          await Promise.race([
            exited,
            new Promise((resolve) => {
              timer = setTimeout(resolve, 10000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      assert.ok(stopped, "Owned Maestro process did not exit");
      const deadline = Date.now() + 30000;
      while (members.length && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        members = await processGroup();
      }
      assert.equal(
        live(members).length,
        0,
        "Live Maestro child processes survived cleanup",
      );
      receipt.exitedProcessEntries = members;
      // Simulator-launched XCTest apps are managed by launchd, outside the JVM
      // process group. Remove the exact driver bundle from this owned device.
      const driverApp = "dev.mobile.maestro-driver-iosUITests.xctrunner";
      const installed = async () => {
        const { stdout } = await promisify(execFile)(
          "xcrun",
          ["simctl", "listapps", serial],
          { timeout: 120000, killSignal: "SIGKILL", maxBuffer: 8388608 },
        );
        const inventory = path.join(directory, "installed-apps.plist");
        writeFileSync(inventory, stdout, { mode: 0o600 });
        const converted = await promisify(execFile)(
          "plutil",
          ["-convert", "json", "-o", "-", inventory],
          { timeout: 10000, killSignal: "SIGKILL", maxBuffer: 8388608 },
        );
        return Object.hasOwn(JSON.parse(converted.stdout), driverApp);
      };
      if (await installed())
        await promisify(execFile)(
          "xcrun",
          ["simctl", "uninstall", serial, driverApp],
          { timeout: 120000, killSignal: "SIGKILL" },
        );
      assert.equal(
        await installed(),
        false,
        "Owned XCTest app survived cleanup",
      );
      receipt.driverAppRemoved = true;
      assert.equal(
        await driverListening(),
        false,
        "Owned XCTest server did not stop",
      );
    } finally {
      // Redact while this case's secret registry still exists. Raw files remain
      // in the owned backend tree if removal cannot be verified.
      writeFileSync(
        path.join(output, `${label}-mcp.log`),
        redact(
          stderrTruncated
            ? stderr.includes("\n")
              ? stderr.slice(stderr.indexOf("\n") + 1)
              : ""
            : stderr,
        ).slice(-131072),
      );
      saveMaestroDiagnostics({
        roots: [directory],
        output,
        prefix: `${label}-mcp`,
        redact,
      });
      assert.equal(path.dirname(directory), path.resolve(root));
      assert.ok(path.basename(directory).startsWith("ios-maestro-"));
      rmSync(directory, { recursive: true, force: true });
      assert.ok(!existsSync(directory), "Maestro case files survived cleanup");
    }
    receipt.cleanup = true;
    receipt.finishedAt = new Date().toISOString();
  };
  try {
    const initialized = await request(
      "initialize",
      {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "tender-isolated-e2e", version: "1.0.0" },
      },
      receipt.handshakeTimeoutMs,
    );
    assert.equal(initialized.serverInfo?.name, "maestro");
    receipt.initializedAt = new Date().toISOString();
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );
    const tools = await request("tools/list", {}, receipt.handshakeTimeoutMs);
    assert.ok(tools.tools?.some((tool) => tool.name === "run"));
  } catch (error) {
    // Record only process names and resource counts, never command arguments
    // or environment values. This distinguishes a stalled launcher from a JVM
    // or XCTest startup failure without exposing case credentials.
    receipt.failureResources = {
      freeMemoryBytes: freemem(),
      totalMemoryBytes: totalmem(),
      loadAverage: loadavg(),
    };
    if (child.pid) {
      try {
        const { stdout } = await promisify(execFile)(
          "/bin/ps",
          ["-axo", "pid=,ppid=,pgid=,stat=,%cpu=,rss=,comm="],
          { timeout: 5000, killSignal: "SIGKILL", maxBuffer: 1048576 },
        );
        receipt.failureProcesses = stdout
          .split("\n")
          .map((line) =>
            line.match(
              /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(.+)$/,
            ),
          )
          .filter((match) => match && Number(match[3]) === child.pid)
          .map((match) => ({
            pid: Number(match[1]),
            parentPid: Number(match[2]),
            state: match[4],
            cpuPercent: Number(match[5]),
            residentKiB: Number(match[6]),
            executable: path.basename(match[7]),
          }));
      } catch {
        receipt.processDiagnosticsUnavailable = true;
      }
    }
    try {
      await close();
    } catch {
      error.cleanupFailed = true;
    }
    error.driverSession = receipt;
    throw error;
  }
  return {
    receipt,
    close,
    async run(file, log) {
      const result = await request(
        "tools/call",
        {
          name: "run",
          arguments: { device_id: serial, files: [file] },
        },
        receipt.batches === 0 ? 900000 : 600000,
      );
      const texts =
        result.content
          ?.filter((item) => item.type === "text")
          .map((item) => item.text) ?? [];
      // Results can include shell environment values. Save only a bounded,
      // redacted failure description or a fixed success marker.
      if (result.isError) {
        const error = texts
          .map((text) => {
            try {
              const payload = JSON.parse(text);
              return (
                payload.results?.map((entry) => entry.error ?? "").join("\n") ??
                "Maestro flow failed"
              );
            } catch {
              return text;
            }
          })
          .join("\n");
        writeFileSync(log, redact(error).slice(-32768));
        const failure = new Error(
          "Maestro UI flow failed; inspect the redacted diagnostic log",
        );
        failure.uiFailure = true;
        throw failure;
      }
      const payload = texts
        .map((text) => {
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        })
        .find((value) => value?.success === true);
      assert.equal(payload?.device_id, serial);
      assert.equal(payload.total_flows, 1);
      assert.equal(payload.results?.length, 1);
      assert.equal(payload.results[0].success, true);
      assert.equal(payload.results[0].file, path.resolve(file));
      assert.ok(payload.total_commands_executed > 0);
      receipt.batches++;
      writeFileSync(log, "Maestro UI flow passed\n");
    },
  };
}
