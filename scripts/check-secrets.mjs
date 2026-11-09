import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const staged = process.argv.includes("--staged");
const files = execFileSync(
  "git",
  staged
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
    : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const content = [];
for (const file of new Set(files)) {
  try {
    const bytes = staged ? execFileSync("git", ["show", `:${file}`]) : readFileSync(file);
    if (!bytes.includes(0)) content.push(`\nFILE: ${file}\n`, bytes.toString("utf8"));
  } catch (error) {
    // Deleted tracked files have no working-tree content.
    if (error.code !== "ENOENT") throw error;
  }
}
execFileSync("betterleaks", ["stdin", "--no-banner", "--redact", "--exit-code", "1"], {
  input: content.join(""),
  stdio: ["pipe", "inherit", "inherit"],
});
if (!staged) {
  execFileSync(
    "betterleaks",
    ["git", "--no-banner", "--redact", "--exit-code", "1", "--log-opts=--all", "."],
    { stdio: "inherit" },
  );
}
