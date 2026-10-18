import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../feature-integration/artifacts/service-tools",
);
const file = path.join(root, "auth-2.197.0/cmd/serve_cmd.go");
const original = readFileSync(file, "utf8");
const marker = "// Windows integration harness: no Unix SO_REUSEPORT.";
if (!original.includes(marker)) {
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    "86a19a36523bb568c9853eeedf01ac34a9bb3d9ce80b9599d38defe325526ff7",
    "Official pinned source checksum",
  );
  assert.equal(
    (original.match(/serr = unix.SetsockoptInt/g) ?? []).length,
    1,
    "Pinned socket patch target",
  );
  const patched = original
    .replace(/\n\s*"syscall"/, "")
    .replace(/\n\s*"golang.org\/x\/sys\/unix"/, "")
    .replace(
      /lc := net\.ListenConfig\{[\s\S]*?\n\t\}/,
      `lc := net.ListenConfig{} ${marker}`,
    );
  assert.ok(
    patched.includes(marker) && !patched.includes("unix."),
    "Socket patch applied",
  );
  writeFileSync(file, patched);
}
console.log(
  "Auth source uses the Windows listener adapter. Authentication code is unchanged.",
);
