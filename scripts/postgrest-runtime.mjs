import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// Hashes come from the verified vendor archives in setup-native-api.ps1.
// Verify the DLLs too: falling back to EDB's gettext 0.19.8 can abort libpq.
export function verifyPostgrestRuntime(workspace) {
  const directory = path.join(
    workspace,
    "scripts/feature-integration/artifacts/native-api-tools",
  );
  for (const [file, hash] of [
    [
      "postgrest.exe",
      "c4155000dfb0befb59215b65d61a621bbaea1515f36a6e758fc504c7ca0dcbee",
    ],
    [
      "libintl-9.dll",
      "d92bb2c5f04e897699692b324e5be0c3194f3e43ae301866214b655d5dc1935c",
    ],
    [
      "libiconv-2.dll",
      "8b262fae4436bf5d98433f925888d6a52e378f53b376261f9f57150e797f8e8e",
    ],
  ]) {
    let bytes;
    try {
      bytes = readFileSync(path.join(directory, file));
    } catch {
      throw new Error(`Run scripts/setup-native-api.ps1: missing ${file}`);
    }
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      hash,
      `Verified test runtime: ${file}`,
    );
  }
  return path.join(directory, "postgrest.exe");
}
