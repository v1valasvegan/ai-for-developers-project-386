import { execFileSync } from "node:child_process";

// The archived Hexlet history predates our Conventional Commits agreement.
const legacyHead = "a91f02f4c54de15eb6a4fd9b431b33a630c1ae8c";
const from = process.env.COMMIT_FROM ?? legacyHead;
const to = process.env.COMMIT_TO ?? "HEAD";
execFileSync("git", ["rev-parse", "--verify", `${from}^{commit}`], { stdio: "inherit" });
execFileSync("git", ["rev-parse", "--verify", `${to}^{commit}`], { stdio: "inherit" });
execFileSync("node_modules/.bin/commitlint", ["--from", from, "--to", to, "--strict"], {
  stdio: "inherit",
});
