import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

try {
  const env = {
    ...loadEnv("production", fileURLToPath(new URL("../", import.meta.url)), ""),
    ...process.env,
  };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.ADMIN_USER_ID ?? "")
  ) {
    throw new Error("Set ADMIN_USER_ID to the existing Supabase Auth user UUID to promote.");
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Set the server-only SUPABASE_SERVICE_ROLE_KEY securely.");
  const url = "https://gykyusczrrqkkfuktukc.supabase.co";
  if (env.SUPABASE_URL && env.SUPABASE_URL !== url)
    throw new Error("SUPABASE_URL must target gykyusczrrqkkfuktukc.");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_secret_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const user = await supabase.auth.admin.getUserById(env.ADMIN_USER_ID);
  if (user.error || !user.data.user)
    throw new Error("The selected Auth user could not be verified; no role was changed.");
  const result = await supabase
    .from("user_roles")
    .upsert({ user_id: user.data.user.id, role: "owner_admin" }, { onConflict: "user_id,role" });
  if (result.error)
    throw new Error(
      "The admin role could not be provisioned. Apply the application migrations first.",
    );
  console.log("The selected existing Auth user now has the owner_admin application role.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Admin provisioning failed.");
  process.exitCode = 1;
}
