import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
let temporary;
try {
  const env = { ...loadEnv("production", root, ""), ...process.env };
  if (!env.SITE_URL)
    throw new Error(
      "Set SITE_URL to the production HTTPS origin before configuring hosted authentication.",
    );
  const site = new URL(env.SITE_URL);
  if (
    site.protocol !== "https:" ||
    site.username ||
    site.password ||
    site.pathname !== "/" ||
    site.search ||
    site.hash
  ) {
    throw new Error("SITE_URL must be the production HTTPS origin without credentials or a path.");
  }
  temporary = mkdtempSync(join(tmpdir(), "awm-auth-config-"));
  mkdirSync(join(temporary, "supabase"));
  // This file contains only public URLs and settings, never credentials.
  writeFileSync(
    join(temporary, "supabase", "config.toml"),
    `project_id = "gykyusczrrqkkfuktukc"
[auth]
site_url = ${JSON.stringify(site.origin)}
additional_redirect_urls = [${JSON.stringify(`${site.origin}/reset-password`)}]
enable_signup = false
minimum_password_length = 12
[auth.email]
enable_signup = false
enable_confirmations = true
double_confirm_changes = true
secure_password_change = true
`,
  );
  const cli = join(root, "node_modules", ".bin", "supabase");
  const command = process.argv.includes("--check") ? "diff" : "push";
  const args = ["config", command, "--project-ref", "gykyusczrrqkkfuktukc", "--workdir", temporary];
  if (command === "push") args.push("--yes");
  const result = spawnSync(cli, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Authentication configuration failed.");
  process.exitCode = 1;
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
