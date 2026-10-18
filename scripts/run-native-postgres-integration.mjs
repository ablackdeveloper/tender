import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import net from "node:net";

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const postgresVersion = "17.11-5";
const postgresInstallerName = `postgresql-${postgresVersion}-windows-x64.exe`;
const postgresInstallerUrl = `https://get.enterprisedb.com/postgresql/${postgresInstallerName}`;
const postgresInstallerSha256 =
  "612c7f5400a003aaffa0372cb273eed52278f93c680ab911eb9cb2229e329072";
const pgTapVersion = "1.3.4";
const pgTapArchiveName = `pgtap-${pgTapVersion}.zip`;
const pgTapArchiveUrl = `https://github.com/theory/pgtap/releases/download/v${pgTapVersion}/${pgTapArchiveName}`;
const pgTapArchiveSha256 =
  "5de16455e3e29898813f05cc9f396a31f878309a94d8adb34e80f423a5841736";
const toolsRoot = path.resolve(
  process.env.TENDER_POSTGRES_TOOLS_DIR ??
    path.join(tmpdir(), "tender-native-postgres-tools"),
);
const postgresRoot = path.join(toolsRoot, "pgsql");
const postgresInstallerPath = path.join(toolsRoot, postgresInstallerName);
const pgTapArchivePath = path.join(toolsRoot, pgTapArchiveName);
const pgTapExtractRoot = path.join(toolsRoot, `pgtap-${pgTapVersion}`);
const pgTapSourceRoot = path.join(pgTapExtractRoot, `pgTAP-${pgTapVersion}`);

function executable(name) {
  return path.join(postgresRoot, "bin", `${name}.exe`);
}

function requireWindows() {
  if (process.platform !== "win32") {
    throw new Error(
      "The native PostgreSQL harness supports Windows. Use the Docker harness on other platforms.",
    );
  }
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? workspace,
    encoding: options.capture ? "utf8" : undefined,
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    stdio: options.capture
      ? [options.input ? "pipe" : "ignore", "pipe", "pipe"]
      : options.input
        ? ["pipe", "inherit", "inherit"]
        : "inherit",
    timeout: options.timeout,
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const details = options.capture
      ? `\n${result.stdout ?? ""}${result.stderr ?? ""}`
      : "";
    throw new Error(
      `${options.label ?? command} failed with exit code ${result.status}.${details}`,
    );
  }
  return result;
}

async function downloadFile(url, destination) {
  console.log(`Downloading ${path.basename(destination)}...`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed with HTTP ${response.status}: ${url}`);
  }
  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(destination),
  );
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

async function ensureVerifiedDownload({ destination, expectedHash, url }) {
  if (existsSync(destination) && sha256(destination) !== expectedHash) {
    rmSync(destination, { force: true });
  }
  if (!existsSync(destination)) await downloadFile(url, destination);

  const actualHash = sha256(destination);
  if (actualHash !== expectedHash) {
    rmSync(destination, { force: true });
    throw new Error(
      `Checksum mismatch for ${path.basename(destination)}. Expected ${expectedHash}; received ${actualHash}.`,
    );
  }
}

async function waitForFile(filePath, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (existsSync(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out while waiting for ${filePath}.`);
}

async function ensurePostgres() {
  mkdirSync(toolsRoot, { recursive: true });
  const postgres = executable("postgres");
  if (!existsSync(postgres)) {
    await ensureVerifiedDownload({
      destination: postgresInstallerPath,
      expectedHash: postgresInstallerSha256,
      url: postgresInstallerUrl,
    });
    mkdirSync(postgresRoot, { recursive: true });
    console.log(
      "Extracting PostgreSQL 17 without installing a Windows service...",
    );
    run(
      postgresInstallerPath,
      ["--mode", "unattended", "--extract-only", "1", "--prefix", postgresRoot],
      { label: "PostgreSQL binary extraction", timeout: 10 * 60 * 1000 },
    );
    await waitForFile(postgres, 2 * 60 * 1000);
  }

  for (const name of ["initdb", "pg_ctl", "postgres", "psql"]) {
    accessSync(executable(name), constants.X_OK);
  }
  const version = run(postgres, ["--version"], { capture: true });
  console.log(version.stdout.trim());
}

async function ensurePgTap() {
  await ensureVerifiedDownload({
    destination: pgTapArchivePath,
    expectedHash: pgTapArchiveSha256,
    url: pgTapArchiveUrl,
  });

  const pgTapSqlTemplate = path.join(pgTapSourceRoot, "sql", "pgtap.sql.in");
  if (!existsSync(pgTapSqlTemplate)) {
    mkdirSync(pgTapExtractRoot, { recursive: true });
    run(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force",
        pgTapArchivePath,
        pgTapExtractRoot,
      ],
      { label: "pgTAP archive extraction" },
    );
  }

  const extensionRoot = path.join(postgresRoot, "share", "extension");
  mkdirSync(extensionRoot, { recursive: true });
  copyFileSync(
    path.join(pgTapSourceRoot, "pgtap.control"),
    path.join(extensionRoot, "pgtap.control"),
  );
  const pgTapSql = readFileSync(pgTapSqlTemplate, "utf8")
    .replaceAll("MODULE_PATHNAME", "pgtap")
    .replaceAll("__OS__", "windows")
    .replaceAll("__VERSION__", "1.3");
  writeFileSync(
    path.join(extensionRoot, `pgtap--${pgTapVersion}.sql`),
    pgTapSql,
    "utf8",
  );
  console.log(`pgTAP ${pgTapVersion} is ready.`);
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a loopback PostgreSQL port."));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function listSql(relativeDirectory) {
  const directory = path.join(workspace, relativeDirectory);
  return readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right))
    .map((file) => path.join(directory, file));
}

function psqlArguments(port) {
  return [
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--username",
    "postgres",
    "--dbname",
    "postgres",
    "--no-psqlrc",
    "--set",
    "ON_ERROR_STOP=1",
  ];
}

function runSqlFile(filePath, port, options = {}) {
  const result = run(
    executable("psql"),
    [
      ...psqlArguments(port),
      ...(options.tap ? ["--tuples-only", "--no-align", "--quiet"] : []),
      "--file",
      filePath,
    ],
    {
      capture: options.capture ?? true,
      label: path.relative(workspace, filePath),
    },
  );

  if (options.tap) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (/^not ok\b/mu.test(output) || /^Bail out!/imu.test(output)) {
      throw new Error(
        `${path.basename(filePath)} reported a pgTAP failure.\n${output}`,
      );
    }
    const assertions = [...output.matchAll(/^ok (\d+)\b/gmu)].map((match) =>
      Number(match[1]),
    );
    const assertionCount = assertions.length;
    const plans = [...output.matchAll(/^1\.\.(\d+)\s*$/gmu)];
    if (
      assertionCount === 0 ||
      plans.length !== 1 ||
      Number(plans[0][1]) !== assertionCount ||
      assertions.some((number, index) => number !== index + 1)
    ) {
      throw new Error(
        `${path.basename(filePath)} did not return a complete TAP plan.\n${output}`,
      );
    }
    console.log(
      `${path.basename(filePath)}: ${assertionCount} assertions passed.`,
    );
  }
  return result;
}

function spawnSql(sql, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      executable("psql"),
      [...psqlArguments(port), "--file", "-"],
      {
        cwd: workspace,
        env: process.env,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr, stdout }));
    child.stdin.end(sql);
  });
}

async function runInvitationRace(port) {
  runSqlFile(
    path.join(
      workspace,
      "supabase/tests/integration/invitation-race-setup.sql",
    ),
    port,
  );

  const winnerAttempt = spawnSql(
    String.raw`
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT public.accept_partner_invitation(
  'f1000000-0000-4000-8000-000000000002',
  'synthetic-concurrency-token-000000000000000000000001',
  'f6000000-0000-4000-8000-000000000001',
  repeat('a', 64)
);
SELECT pg_sleep(2);
COMMIT;
`,
    port,
  );

  await new Promise((resolve) => setTimeout(resolve, 500));

  const loserAttempt = spawnSql(
    String.raw`
\set ON_ERROR_STOP on
\set VERBOSITY verbose
SET lock_timeout = '10s';
SELECT public.accept_partner_invitation(
  'f1000000-0000-4000-8000-000000000002',
  'synthetic-concurrency-token-000000000000000000000001',
  'f6000000-0000-4000-8000-000000000002',
  repeat('b', 64)
);
`,
    port,
  );

  const [winner, loser] = await Promise.all([winnerAttempt, loserAttempt]);
  if (winner.code !== 0) {
    throw new Error(
      `The first invitation acceptance failed.\n${winner.stderr}`,
    );
  }
  if (
    loser.code === 0 ||
    !/22023|invitation is invalid or expired/u.test(loser.stderr)
  ) {
    throw new Error(
      `The concurrent invitation acceptance was not rejected as expected.\n${loser.stdout}\n${loser.stderr}`,
    );
  }

  runSqlFile(
    path.join(
      workspace,
      "supabase/tests/integration/invitation-race-verify.sql",
    ),
    port,
  );
  console.log(
    "Invitation race passed: one acceptance committed and one was rejected.",
  );
}

function removeCluster(clusterRoot) {
  const resolvedRoot = path.resolve(clusterRoot);
  const allowedParent = `${path.resolve(tmpdir())}${path.sep}`;
  if (
    !resolvedRoot.startsWith(allowedParent) ||
    !path.basename(resolvedRoot).startsWith("tender-postgres-integration-")
  ) {
    throw new Error(`Refusing to remove unexpected path: ${resolvedRoot}`);
  }
  rmSync(resolvedRoot, { force: true, recursive: true });
  if (existsSync(resolvedRoot)) {
    throw new Error(`Temporary database data remains at ${resolvedRoot}.`);
  }
}

function printLogTail(logPath) {
  if (!existsSync(logPath)) return;
  const lines = readFileSync(logPath, "utf8").split(/\r?\n/u);
  console.error(lines.slice(-120).join("\n"));
}

async function main() {
  requireWindows();
  await ensurePostgres();
  await ensurePgTap();

  const clusterRoot = mkdtempSync(
    path.join(tmpdir(), "tender-postgres-integration-"),
  );
  const dataRoot = path.join(clusterRoot, "data");
  const logPath = path.join(clusterRoot, "postgres.log");
  const port = await reservePort();
  let started = false;
  let failure;

  try {
    console.log(`Creating an isolated PostgreSQL cluster on port ${port}...`);
    run(
      executable("initdb"),
      [
        "--pgdata",
        dataRoot,
        "--username",
        "postgres",
        "--auth",
        "trust",
        "--encoding",
        "UTF8",
        "--locale",
        "C",
      ],
      { label: "temporary PostgreSQL initialization" },
    );
    run(
      executable("pg_ctl"),
      [
        "--pgdata",
        dataRoot,
        "--log",
        logPath,
        "--options",
        `-h 127.0.0.1 -p ${port} -F`,
        "--wait",
        "--timeout",
        "60",
        "start",
      ],
      { label: "temporary PostgreSQL startup" },
    );
    started = true;

    console.log("Applying the Supabase-compatible platform contract...");
    runSqlFile(
      path.join(
        workspace,
        "supabase/tests/integration/native-supabase-bootstrap.sql",
      ),
      port,
    );

    const migrations = listSql("supabase/migrations");
    console.log(
      `Replaying ${migrations.length} migrations from a clean database...`,
    );
    for (const migration of migrations) runSqlFile(migration, port);

    const seeds = listSql("supabase/seeds");
    console.log(`Loading ${seeds.length} synthetic seed files...`);
    for (const seed of seeds) runSqlFile(seed, port);

    const tests = listSql("supabase/tests/database");
    console.log(`Running ${tests.length} real pgTAP integration files...`);
    for (const test of tests) runSqlFile(test, port, { tap: true });

    await runInvitationRace(port);
    if (process.argv.includes("--with-api")) {
      const { runNativeApiIntegration } =
        await import("./native-api-integration.mjs");
      await runNativeApiIntegration({
        workspace,
        port,
        postgresBin: path.join(postgresRoot, "bin"),
        sql: async (source) => {
          const result = await spawnSql(source, port);
          if (result.code !== 0)
            throw new Error(`Native API setup SQL failed: ${result.stderr}`);
          return result.stdout;
        },
      });
    }
  } catch (error) {
    failure = error;
    printLogTail(logPath);
  } finally {
    if (started) {
      const stopResult = run(
        executable("pg_ctl"),
        [
          "--pgdata",
          dataRoot,
          "--wait",
          "--timeout",
          "60",
          "--mode",
          "immediate",
          "stop",
        ],
        { allowFailure: true, label: "temporary PostgreSQL shutdown" },
      );
      if (stopResult.status !== 0 && !failure) {
        failure = new Error("Temporary PostgreSQL shutdown failed.");
      }
    }
    try {
      removeCluster(clusterRoot);
    } catch (cleanupError) {
      failure = failure
        ? new Error(
            `${failure instanceof Error ? failure.message : failure}\nCleanup also failed: ${cleanupError instanceof Error ? cleanupError.message : cleanupError}`,
          )
        : cleanupError;
    }
  }

  if (failure) throw failure;
  console.log(
    "Native PostgreSQL integration harness passed. Synthetic database data was removed.",
  );
}

// The service harness reuses the same verified, disposable PostgreSQL runtime.
export {
  ensurePostgres,
  executable,
  reservePort,
  run,
  runSqlFile,
  spawnSql,
  removeCluster,
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
