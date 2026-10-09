import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { resolveDeployment } from "./deploy-env.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  const config = JSON.parse(readFileSync(new URL("../wrangler.json", import.meta.url), "utf8"));
  const { env, args, secrets } = resolveDeployment(
    { ...loadEnv("production", root, ""), ...process.env },
    config,
  );
  if (process.argv.includes("--check")) {
    console.log("Deployment variables passed validation; values are not displayed.");
  } else {
    // Secrets go through stdin into the Worker version, never files or CLI arguments.
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
        ...args,
      ],
      {
        cwd: root,
        env: { ...env, WRANGLER_LOG: "info", WRANGLER_SEND_METRICS: "false" },
        input: JSON.stringify(secrets),
        stdio: ["pipe", "inherit", "inherit"],
      },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Deployment configuration failed.");
  process.exitCode = 1;
}
