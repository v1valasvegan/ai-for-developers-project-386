import { execSync } from "node:child_process";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const roots = ["api/generated", "frontend/src/api/generated", "backend/generated"];
// Removing old output also makes deleted operations disappear from the SDK and server crate.
for (const root of roots) await rm(root, { recursive: true, force: true });
execSync("tsp compile api", { stdio: "inherit" });
execSync("openapi-ts", { stdio: "inherit" });
execSync(
  "node scripts/generate-rust.mjs generate -g rust-axum -t api/templates/rust-axum -i api/generated/openapi.yaml -o backend/generated --additional-properties=packageName=okoshko_api,packageVersion=0.1.0,disableValidator=false,licenseInfo=MIT,hideGenerationTimestamp=true --global-property=apiTests=false,modelTests=false,apiDocs=false,modelDocs=false",
  { stdio: "inherit" },
);

async function markGenerated(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await markGenerated(file);
    else {
      const prefix = /\.(ts|rs)$/.test(file) ? "// " : /\.(yaml|toml)$/.test(file) ? "# " : null;
      if (prefix) {
        const content = await readFile(file, "utf8");
        await writeFile(file, `${prefix}Generated from api/main.tsp. DO NOT EDIT.\n${content}`);
      }
    }
  }
}
for (const root of roots) await markGenerated(root);
