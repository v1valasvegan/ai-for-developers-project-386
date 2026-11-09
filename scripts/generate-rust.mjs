import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const version = process.env.OPENAPI_GENERATOR_VERSION;
const checksum = process.env.GENERATOR_CHECKSUM_SHA256;
if (!version || !checksum)
  throw new Error("Run API generation through mise (pinned version and checksum required).");
const path = `.cache/openapi-generator-${version}.jar`;
let jar;
try {
  jar = await readFile(path);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  const response = await fetch(
    `https://repo.maven.apache.org/maven2/org/openapitools/openapi-generator-cli/${version}/openapi-generator-cli-${version}.jar`,
    {
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!response.ok) throw new Error(`Generator download failed: ${response.status}`);
  jar = Buffer.from(await response.arrayBuffer());
}
if (createHash("sha256").update(jar).digest("hex") !== checksum) {
  throw new Error("OpenAPI Generator checksum mismatch");
}
await mkdir(".cache", { recursive: true });
await writeFile(path, jar);
execFileSync("java", ["-jar", path, ...process.argv.slice(2)], { stdio: "inherit" });
