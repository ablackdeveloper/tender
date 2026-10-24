import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Maestro moves XCTest logs to --test-output-dir after initializing its logger.
// Copy only known text logs; raw commands and screenshots can contain secrets.
export function saveMaestroDiagnostics({ roots, output, prefix, redact }) {
  let count = 0;
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root, { recursive: true })) {
      const base = path.basename(name);
      if (base !== "maestro.log" && !/^xctest_runner_[\d_-]+\.log$/.test(base))
        continue;
      const kind = base === "maestro.log" ? "maestro" : "xctest";
      writeFileSync(
        path.join(output, `${prefix}-${kind}-${count++}.log`),
        redact(readFileSync(path.join(root, name), "utf8")).slice(-131072),
      );
    }
  }
  return count;
}
