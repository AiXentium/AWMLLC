import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const container = `awm-database-test-${randomUUID()}`;
const image =
  "postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24";
function docker(args, input) {
  return execFileSync("docker", args, {
    cwd: root,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}
function sql(text) {
  return docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    text,
  );
}
let started = false;
try {
  // No ports are published. Trust auth is confined to this disposable test container.
  docker([
    "run",
    "--detach",
    "--name",
    container,
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    image,
  ]);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!ready) throw new Error("Local PostgreSQL did not become ready.");
  sql(readFileSync(new URL("../supabase/tests/bootstrap.sql", import.meta.url), "utf8"));
  const migrations = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrations) {
    sql(readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    console.log(`Applied ${name}`);
  }
  // rls.sql controls its own transaction and rolls back its test identities.
  docker(
    ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    readFileSync(new URL("../supabase/tests/rls.sql", import.meta.url), "utf8"),
  );
  const tables = sql(
    "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p');",
  );
  console.log(
    `${migrations.length} migrations passed; RLS, authentication provisioning, private storage and company isolation checks passed.`,
  );
  console.log(tables.trim());
} catch (error) {
  console.error(error instanceof Error ? error.message : "Database validation failed.");
  if (error?.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
} finally {
  if (started) {
    try {
      docker(["rm", "--force", container]);
    } catch {
      console.error(`Could not remove test container ${container}.`);
      process.exitCode = 1;
    }
  }
}
