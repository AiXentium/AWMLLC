import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { resolveBuildEnvironment } from "./build-env.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const checkOnly = process.argv.includes("--check-env");
const requireSupabase = checkOnly || process.env.WORKERS_CI === "1" || process.env.VERCEL === "1";

try {
  const environment = resolveBuildEnvironment(
    { ...loadEnv("production", root, ""), ...process.env },
    { SUPABASE_URL: "https://gykyusczrrqkkfuktukc.supabase.co" },
    requireSupabase,
  );
  const preset = process.argv.find((argument) => argument.startsWith("--preset="))?.slice(9);
  if (preset) environment.NITRO_PRESET = preset;
  if (environment.VERCEL === "1") {
    for (const name of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
      if (!environment[name]) {
        throw new Error(`Set ${name} in Vercel environment variables for server runtime access.`);
      }
    }
    if (environment.NITRO_PRESET && environment.NITRO_PRESET !== "vercel") {
      throw new Error("Vercel builds require the vercel Nitro preset.");
    }
    environment.NITRO_PRESET = "vercel";
    if (environment.VITE_SUPABASE_URL !== "https://gykyusczrrqkkfuktukc.supabase.co") {
      throw new Error("Vercel Supabase variables must target project gykyusczrrqkkfuktukc.");
    }
    if (environment.SUPABASE_URL && environment.SUPABASE_URL !== environment.VITE_SUPABASE_URL) {
      throw new Error(
        "SUPABASE_URL and VITE_SUPABASE_URL must match for Vercel build and runtime.",
      );
    }
  }
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
