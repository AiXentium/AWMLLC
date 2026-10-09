import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { resolveBuildEnvironment } from "./build-env.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const checkOnly = process.argv.includes("--check-env");
const requireSupabase = checkOnly || process.env.WORKERS_CI === "1";

try {
  const config = JSON.parse(readFileSync(new URL("../wrangler.json", import.meta.url), "utf8"));
  const environment = resolveBuildEnvironment(
    { ...loadEnv("production", root, ""), ...process.env },
    config.vars,
    requireSupabase,
  );
  if (checkOnly) {
    console.log("Required public Supabase build settings are present; values are not displayed.");
  } else {
    if (!environment.VITE_SUPABASE_PUBLISHABLE_KEY) {
      console.warn(
        "Compiling without a Supabase publishable key; authenticated/backend behavior is unconfigured.",
      );
    }
    const build = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)), "build"],
      {
        cwd: root,
        env: environment,
        stdio: "inherit",
      },
    );
    if (build.error) throw build.error;
    process.exitCode = build.status ?? 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Build configuration failed.");
  process.exitCode = 1;
}
