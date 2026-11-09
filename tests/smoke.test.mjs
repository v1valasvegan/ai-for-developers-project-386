import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { createClient } from "../frontend/src/api/generated/client/index";
import { getHealth } from "../frontend/src/api/generated/sdk.gen";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No TCP port assigned");
  const port = address.port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function start(command, args, env) {
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: "pipe" });
  const logs = [];
  child.stdout.on("data", (data) => logs.push(data.toString()));
  child.stderr.on("data", (data) => logs.push(data.toString()));
  child.on("error", (error) => logs.push(error.message));
  return { child, logs };
}

async function ready(url, processInfo) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      !processInfo.child.pid ||
      processInfo.child.exitCode !== null ||
      processInfo.child.signalCode !== null
    )
      break;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // Connection refused is expected until the child starts listening.
    }
    await sleep(100);
  }
  throw new Error(`Server did not start: ${url}\n${processInfo.logs.join("")}`);
}

async function stop({ child }) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const timeout = setTimeout(() => child.kill("SIGKILL"), 3000);
  try {
    await exited;
  } finally {
    clearTimeout(timeout);
  }
}

test("built frontend and generated API server start; SDK response matches the contract", async () => {
  const backendPort = await freePort();
  const frontendPort = await freePort();
  const backendUrl = `http://127.0.0.1:${backendPort}`;
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  const processes = [];
  try {
    const backend = start("backend/target/debug/okoshko-backend", [], {
      BIND_ADDR: `127.0.0.1:${backendPort}`,
    });
    processes.push(backend);
    await ready(`${backendUrl}/api/health`, backend);

    const frontend = start(
      "node",
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--config",
        "frontend/vite.config.ts",
        "--host",
        "127.0.0.1",
        "--port",
        String(frontendPort),
        "--strictPort",
        "frontend",
      ],
      { BACKEND_URL: backendUrl },
    );
    processes.push(frontend);
    await ready(frontendUrl, frontend);

    const page = await fetch(frontendUrl);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<title>Окошко</title>");

    const result = await getHealth({
      client: createClient({ baseUrl: frontendUrl }),
      throwOnError: true,
    });
    const contract = parse(await readFile("api/generated/openapi.yaml", "utf8"));
    expect(result.response.status).toBe(200);
    expect(result.data).toEqual({ status: "ok" });
    expect(contract.components.schemas.Health.properties.status.enum).toContain(result.data.status);
    expect(contract.paths["/api/health"].get.operationId).toBe("getHealth");
  } finally {
    for (const processInfo of processes.reverse()) await stop(processInfo);
  }
}, 30000);
