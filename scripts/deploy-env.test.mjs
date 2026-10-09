import assert from "node:assert/strict";
import test from "node:test";
import { resolveDeployment } from "./deploy-env.mjs";

// Synthetic fixtures are used only for these configuration tests, never builds.
const config = { vars: { SUPABASE_URL: "https://testproject.supabase.co" } };
const settings = {
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_fixture",
  CLOUDFLARE_ACCOUNT_ID: "test-account",
};
test("runtime secrets travel through stdin, not command arguments", () => {
  const deployment = resolveDeployment(settings, config);
  assert.equal(deployment.secrets.SUPABASE_SERVICE_ROLE_KEY, settings.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(deployment.args.includes(settings.SUPABASE_SERVICE_ROLE_KEY), false);
  assert.deepEqual(Object.keys(deployment.secrets).sort(), [
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  assert.equal(deployment.env.VITE_SUPABASE_SERVICE_ROLE_KEY, undefined);
});
test("a different build project cannot be deployed against the runtime project", () => {
  assert.throws(
    () => resolveDeployment({ ...settings, SUPABASE_URL: "https://other.supabase.co" }, config),
    /must match/,
  );
});
test("publishable keys and proxy placeholders cannot become service-role secrets", () => {
  for (const key of ["sb_publishable_test_fixture", "proxy-test-fixture", undefined]) {
    assert.throws(
      () => resolveDeployment({ ...settings, SUPABASE_SERVICE_ROLE_KEY: key }, config),
      /real SUPABASE_SERVICE_ROLE_KEY/,
    );
  }
});
test("deployment targets an explicitly selected Cloudflare account", () => {
  assert.throws(
    () => resolveDeployment({ ...settings, CLOUDFLARE_ACCOUNT_ID: undefined }, config),
    /CLOUDFLARE_ACCOUNT_ID/,
  );
});
test("production site URLs reject credentials, paths and insecure origins", () => {
  for (const SITE_URL of [
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com/path",
  ]) {
    assert.throws(
      () => resolveDeployment({ ...settings, SITE_URL }, config),
      /production HTTPS origin/,
    );
  }
});
