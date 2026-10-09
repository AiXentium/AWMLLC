/** Map public build settings explicitly; private Worker secrets stay private. */
export function resolveBuildEnvironment(environment, defaults = {}, requireSupabase = false) {
  for (const name of Object.keys(environment)) {
    if (
      name.startsWith("VITE_") &&
      /SERVICE_ROLE|PGPASSWORD|APP_PASSWORD|APP_SECRET|CONNECTION_KEY_SECRET|CLOUDFLARE_API_TOKEN/.test(
        name,
      )
    ) {
      throw new Error(`Private setting ${name} must not be exposed through a VITE_ variable.`);
    }
  }
  const result = { ...environment };
  const url = environment.VITE_SUPABASE_URL || environment.SUPABASE_URL || defaults.SUPABASE_URL;
  const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY || environment.SUPABASE_PUBLISHABLE_KEY;

  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error("SUPABASE_URL must be an HTTPS URL without credentials.");
    }
    result.VITE_SUPABASE_URL = url;
    result.VITE_SUPABASE_PROJECT_ID =
      environment.VITE_SUPABASE_PROJECT_ID ||
      environment.SUPABASE_PROJECT_ID ||
      (parsed.hostname.endsWith(".supabase.co") ? parsed.hostname.split(".")[0] : "");
  }
  if (key) {
    if (key.startsWith("sb_secret_")) {
      throw new Error("The Supabase build key must be publishable, never a secret key.");
    }
    if (key.startsWith("eyJ")) {
      let role;
      try {
        role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
      } catch {
        throw new Error("The Supabase build key is not a valid legacy anon key.");
      }
      if (role !== "anon") {
        throw new Error("Only a legacy anon key may be included in the browser build.");
      }
    }
    result.VITE_SUPABASE_PUBLISHABLE_KEY = key;
  }
  if (requireSupabase && (!url || !key)) {
    throw new Error(
      "Missing Supabase build settings. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY " +
        "(or their VITE_ aliases) in Cloudflare Build variables. " +
        "Set SUPABASE_SERVICE_ROLE_KEY separately as a Worker runtime secret.",
    );
  }
  return result;
}
