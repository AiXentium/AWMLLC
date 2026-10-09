import assert from "node:assert/strict";
import test from "node:test";
import { resolveBuildEnvironment } from "./build-env.mjs";

const url = "https://example.supabase.co";
const publishable = "sb_publishable_test_fixture";

test("maps public server settings into the Vite build", () => {
  const result = resolveBuildEnvironment(
    { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishable },
    {},
    true,
  );
  assert.equal(result.VITE_SUPABASE_URL, url);
  assert.equal(result.VITE_SUPABASE_PROJECT_ID, "example");
  assert.equal(result.VITE_SUPABASE_PUBLISHABLE_KEY, publishable);
});

test("explicit Vite settings override server defaults", () => {
  const result = resolveBuildEnvironment(
    { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publishable },
    { SUPABASE_URL: "https://other.supabase.co" },
    true,
  );
  assert.equal(result.VITE_SUPABASE_URL, url);
});

test("a private service-role key is never copied to a Vite variable", () => {
  const result = resolveBuildEnvironment({ SUPABASE_SERVICE_ROLE_KEY: "private-test-fixture" });
  assert.equal(result.VITE_SUPABASE_PUBLISHABLE_KEY, undefined);
  assert.equal(result.VITE_SUPABASE_SERVICE_ROLE_KEY, undefined);
});

test("rejects modern private Supabase keys without logging their value", () => {
  assert.throws(
    () => resolveBuildEnvironment({ SUPABASE_PUBLISHABLE_KEY: "sb_secret_private_test_fixture" }),
    (error) => {
      assert.ok(!error.message.includes("sb_secret_private_test_fixture"));
      return /publishable/.test(error.message);
    },
  );
});

test("rejects private environment variables with browser-visible prefixes", () => {
  assert.throws(
    () => resolveBuildEnvironment({ VITE_SUPABASE_SERVICE_ROLE_KEY: "private-test-fixture" }),
    /must not be exposed/,
  );
  assert.throws(
    () => resolveBuildEnvironment({ VITE_PGPASSWORD: "private-test-fixture" }),
    /must not be exposed/,
  );
});

test("rejects legacy service-role JWTs", () => {
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  assert.throws(
    () => resolveBuildEnvironment({ SUPABASE_PUBLISHABLE_KEY: `eyJheader.${payload}.signature` }),
    /Only a legacy anon key/,
  );
});

test("accepts legacy anon JWTs", () => {
  const payload = Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url");
  const key = `eyJheader.${payload}.signature`;
  assert.equal(
    resolveBuildEnvironment({ SUPABASE_PUBLISHABLE_KEY: key }).VITE_SUPABASE_PUBLISHABLE_KEY,
    key,
  );
});

test("rejects missing required build settings", () => {
  assert.throws(
    () => resolveBuildEnvironment({}, { SUPABASE_URL: url }, true),
    /Missing Supabase build settings/,
  );
});

test("compilation without credentials stays explicit", () => {
  const result = resolveBuildEnvironment({}, { SUPABASE_URL: url });
  assert.equal(result.VITE_SUPABASE_URL, url);
  assert.equal(result.VITE_SUPABASE_PUBLISHABLE_KEY, undefined);
});

test("rejects URLs with credentials or insecure protocols", () => {
  assert.throws(
    () => resolveBuildEnvironment({ SUPABASE_URL: "http://example.supabase.co" }),
    /HTTPS URL/,
  );
  assert.throws(
    () => resolveBuildEnvironment({ SUPABASE_URL: "https://user:password@example.supabase.co" }),
    /without credentials/,
  );
});
