import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = new URL("../supabase/migrations/", import.meta.url);
const names = readdirSync(directory)
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort();
const lines = [
  "-- AWMLLC: empty-project bootstrap for gykyusczrrqkkfuktukc.",
  "-- Run in that project's SQL Editor only. For existing databases use db:push.",
  "begin;",
  "set local standard_conforming_strings = on;",
  "do $$ begin if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')) then raise exception 'Application tables already exist. Use the migration workflow instead.'; end if; end $$;",
  "create schema if not exists supabase_migrations;",
  "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);",
  "do $$ begin if exists (select 1 from supabase_migrations.schema_migrations) then raise exception 'Migration history already exists. Use the migration workflow instead.'; end if; end $$;",
];
for (const name of names) {
  const version = name.slice(0, 14);
  const migrationName = name.slice(15, -4);
  const sql = readFileSync(new URL(name, directory), "utf8");
  const tag = `$migration_${version}$`;
  if (sql.includes(tag)) throw new Error("Migration delimiter collision.");
  lines.push(`\n-- ${name}\n${sql}`);
  lines.push(
    `insert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${migrationName.replaceAll("'", "''")}', array[${tag}${sql}${tag}]);`,
  );
}
lines.push("notify pgrst, 'reload schema';", "commit;", "");
const result = lines.join("\n");
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) {
  const output = process.argv[outputIndex + 1];
  if (!output) throw new Error("--output requires a filename.");
  writeFileSync(output, result, { flag: "wx" });
  console.log(
    `Wrote ${names.length} migrations as one transaction to ${fileURLToPath(new URL(output, `file://${process.cwd()}/`))}.`,
  );
} else {
  process.stdout.write(result);
}
