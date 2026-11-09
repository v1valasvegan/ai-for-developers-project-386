import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const roots = ["api/generated", "frontend/src/api/generated", "backend/generated"];

async function snapshot() {
  const hashes = {};
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await visit(file);
      else
        hashes[file] = createHash("sha256")
          .update(await readFile(file))
          .digest("hex");
    }
  }
  for (const root of roots) await visit(root);
  return hashes;
}

const before = await snapshot();
execFileSync("npm", ["run", "api:generate"], { stdio: "inherit" });
const after = await snapshot();
const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
  (file) => before[file] !== after[file],
);
if (changed.length) {
  throw new Error(
    `Generated files were stale. Review and commit regenerated output:\n${changed.join("\n")}`,
  );
}
console.log("Generated files are up to date.");
