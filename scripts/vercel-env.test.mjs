import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
// Fixtures are used only in --check-env; no compiler, API or deploy is invoked.
const settings = {
  ...process.env,
  VERCEL: "1",
  WORKERS_CI: "",
  NITRO_PRESET: "vercel",
  SUPABASE_URL: "https://gykyusczrrqkkfuktukc.supabase.co",
  VITE_SUPABASE_URL: "https://gykyusczrrqkkfuktukc.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_fixture",
};
function check(overrides = {}) {
  return spawnSync(process.execPath, ["scripts/build.mjs", "--check-env"], {
    cwd: root,
    env: { ...settings, ...overrides },
    encoding: "utf8",
  });
}
test("Vercel validation requires server runtime settings, not only browser aliases", () => {
  for (const name of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const result = check({ [name]: "" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`Set ${name} in Vercel`));
    assert.equal(result.stderr.includes("sb_secret_test_fixture"), false);
  }
});
test("Vercel validation rejects a stale project or a different browser URL", () => {
  const stale = "https://oldproject.supabase.co";
  assert.match(
    check({ SUPABASE_URL: stale, VITE_SUPABASE_URL: stale }).stderr,
    /must target project/,
  );
  assert.match(check({ SUPABASE_URL: stale }).stderr, /must match/);
});
test("Vercel validation rejects Worker output and accepts complete settings", () => {
  assert.match(
    check({ NITRO_PRESET: "cloudflare-module" }).stderr,
    /require the vercel Nitro preset/,
  );
  const result = check();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes("sb_secret_test_fixture"), false);
});
