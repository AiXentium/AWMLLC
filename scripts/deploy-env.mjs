import { resolveBuildEnvironment } from "./build-env.mjs";

export function resolveDeployment(environment, config) {
  const env = resolveBuildEnvironment(environment, config.vars, true);
  if (env.VITE_SUPABASE_URL !== config.vars.SUPABASE_URL) {
    throw new Error("Build and Worker runtime SUPABASE_URL must match wrangler.json.");
  }
  if (!env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error("Set CLOUDFLARE_ACCOUNT_ID for the intended account.");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  let role;
  if (key?.startsWith("eyJ")) {
    try {
      role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
    } catch {
      /* Invalid keys receive the same value-free error below. */
    }
  }
  if (!key?.startsWith("sb_secret_") && role !== "service_role") {
    throw new Error(
      "Set a real SUPABASE_SERVICE_ROLE_KEY for encrypted Worker upload. Proxy placeholders cannot be uploaded as secrets.",
    );
  }
  const args = ["deploy", "--config", "wrangler.json", "--secrets-file", "/dev/stdin"];
  if (env.SITE_URL) {
    const site = new URL(env.SITE_URL);
    if (
      site.protocol !== "https:" ||
      site.username ||
      site.password ||
      site.search ||
      site.hash ||
      site.pathname !== "/"
    ) {
      throw new Error(
        "SITE_URL must be the production HTTPS origin without credentials or a path.",
      );
    }
    args.push("--var", `SITE_URL:${site.origin}`);
  }
  return {
    env,
    args,
    secrets: {
      SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: key,
    },
  };
}
