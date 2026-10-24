import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import { saveMaestroDiagnostics } from "./maestro-diagnostics.mjs";

// Maestro 2.11's official MCP interface retains its XCTest session between
// command groups. One process belongs to one case; no session crosses cases.
const driverPort = 22087;
async function driverListening() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: driverPort });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", (error) => finish(error.code !== "ECONNREFUSED"));
    socket.setTimeout(1000, () => finish(true)); // An uncertain owner is not free.
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
  child.on("exit", () =>
    fail(new Error("Owned Maestro process exited before its response")),
  );
  child.stdin.on("error", () => fail(new Error("Owned Maestro input closed")));
  child.stderr.on("data", (data) => {
    stderr += data.toString();
    if (stderr.length > 1048576) {
      stderrTruncated = true;
      stderr = stderr.slice(-1048576);
    }
  });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (data) => {
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
          () => fail(new Error("Maestro session request timed out")),
          timeout,
        ),
      };
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
      );
    });
  };
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
    const groupAlive = () => {
      if (!child.pid) return false;
      try {
        process.kill(-child.pid, 0);
        return true;
      } catch (error) {
        if (error.code === "ESRCH") return false;
        throw error;
      }
    };
    if (groupAlive()) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
      await Promise.race([
        exited,
        new Promise((resolve) => {
          timer = setTimeout(resolve, 10000);
        }),
      ]);
      clearTimeout(timer);
    }
    try {
      assert.ok(stopped, "Owned Maestro process did not exit");
      const deadline = Date.now() + 10000;
      while (groupAlive() && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        groupAlive(),
        false,
        "Owned Maestro child processes survived cleanup",
      );
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
      60000,
    );
    assert.equal(initialized.serverInfo?.name, "maestro");
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );
    const tools = await request("tools/list", {}, 30000);
    assert.ok(tools.tools?.some((tool) => tool.name === "run"));
  } catch (error) {
    try {
      await close();
    } catch {
      error.cleanupFailed = true;
    }
    throw error;
  }
  return {
    receipt,
    close,
    async run(file, log) {
      const result = await request("tools/call", {
        name: "run",
        arguments: { device_id: serial, files: [file] },
      });
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
