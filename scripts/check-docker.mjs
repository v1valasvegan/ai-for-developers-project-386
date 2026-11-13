import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

const run = randomUUID().slice(0, 12);
const image = `okoshko-check:${run}`;
const volume = `okoshko-check-${run}`;
const container = `okoshko-check-${run}`;
const state = resolve(`.cache/docker-${run}.json`);
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8" }).trim();
const command = (cmd, args, env = {}) =>
  execFileSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    timeout: 1200000,
  });
let createdImage = false;
let createdVolume = false;
let startedContainer = false;

async function check(port, user, mode) {
  docker(
    "run",
    "--detach",
    "--name",
    container,
    "--user",
    user,
    "--mount",
    `type=volume,source=${volume},target=/data`,
    "--publish",
    `127.0.0.1::${port}`,
    "--env",
    `PORT=${port}`,
    image,
  );
  startedContainer = true;
  const baseURL = `http://${docker("port", container, `${port}/tcp`)}`;
  const deadline = Date.now() + 20000;
  while (true) {
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).status === "ok") break;
    } catch {
      // Ожидаем реальную HTTP-готовность, а не фиксированную задержку.
    }
    if (Date.now() >= deadline) throw new Error(`Контейнер не готов: ${docker("logs", container)}`);
    await setTimeout(100);
  }
  assert.match(
    docker("top", container, "-eo", "pid,uid,comm"),
    /^\s*\d+\s+10001\s+okoshko-backend\s*$/m,
  );
  command("npx", ["--no-install", "playwright", "test", "--config=playwright.deploy.config.mjs"], {
    BASE_URL: baseURL,
    SMOKE_STATE_FILE: state,
    SMOKE_MODE: mode,
  });
  docker("stop", "--time", "5", container);
  assert.equal(docker("inspect", "--format", "{{.State.ExitCode}}", container), "0");
  docker("rm", container);
  startedContainer = false;
}

try {
  await mkdir(".cache", { recursive: true });
  command("docker", ["build", "--tag", image, "."]);
  createdImage = true;
  docker("volume", "create", volume);
  createdVolume = true;
  // Эмулируем root-owned volume Railway, не используя чужие тома.
  docker(
    "run",
    "--rm",
    "--user",
    "0:0",
    "--mount",
    `type=volume,source=${volume},target=/data`,
    "--entrypoint",
    "/bin/sh",
    image,
    "-c",
    "chown 0:0 /data",
  );
  await check(4100, "0:0", "create");
  await check(4101, "10001:10001", "verify");
  console.log(
    "Docker: оба PORT, реальный браузер/API, конфликты, остановка и сохранность подтверждены.",
  );
} finally {
  if (startedContainer) {
    try {
      console.error(docker("logs", container));
      docker("rm", "--force", container);
    } catch (error) {
      console.error("Не удалось убрать свой контейнер:", error.message);
    }
  }
  if (createdVolume) docker("volume", "rm", volume);
  if (createdImage) docker("image", "rm", image);
  await rm(state, { force: true });
}
