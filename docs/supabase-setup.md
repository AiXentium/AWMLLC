# Supabase setup

The application targets `gykyusczrrqkkfuktukc`. It uses Supabase Auth, the
HTTPS database API and private Storage. A PostgreSQL password alone does not
authenticate the Management API, MCP or Wrangler.

## Apply the database migrations

Install with `pnpm install --frozen-lockfile`. The repository pins Supabase
CLI 2.120.0. Authenticate that CLI with a securely supplied
`SUPABASE_ACCESS_TOKEN` or `pnpm exec supabase login`; MCP OAuth is a separate
connection. Then run:

```sh
pnpm run db:link
pnpm run db:plan
pnpm run db:push
pnpm run db:check
```

The 28 migrations create 79 application tables with RLS, seed the public
catalog and system assemblies, and create private `plan-files`,
`project-exports` and `quote-uploads` buckets. Quotes use server-issued upload
URLs; users cannot access that bucket directly. Storage limits configured in
the project/plan can impose smaller upload limits than the bucket settings.

The readiness migration fixes company self-joining, restricts private customer,
profile and bid records, grants the policy helpers needed on fresh projects,
and backfills profiles and viewer roles for existing Auth users. Roles come
from trusted application tables; user-supplied metadata cannot grant admin
access. The historical commercial migration now creates organization tables
before the functions that reference them, allowing fresh projects to migrate.

For an **empty application database**, the SQL Editor is an alternative when
CLI access is unavailable:

```sh
pnpm run db:bootstrap -- --output /tmp/awm-bootstrap.sql
```

Run that generated SQL in the intended project's SQL Editor. It applies all
migrations and records their native Supabase migration history in one
transaction. It aborts if application tables or migration history already
exist. Do not use it to replace a partially configured project: inspect the
existing schema/history and use the migration workflow. The output file must
not already exist. The local test fixture `supabase/tests/bootstrap.sql` is
only for disposable PostgreSQL validation; never run it on hosted Supabase.

## Configure production authentication

Set `SITE_URL` to the application's actual production HTTPS origin, without
a path, and authenticate the Supabase CLI. Review and apply:

```sh
pnpm run auth:configure -- --check
pnpm run auth:configure
```

These commands set the production site and reset-password redirect URLs,
disable public signup, require 12-character passwords and email confirmations,
and enable secure password changes. They use a temporary configuration
containing public settings only. The committed `supabase/config.toml` contains
local development URLs; do not push its localhost URLs to production.
Configure production SMTP in Supabase before relying on password-reset email;
email delivery cannot be verified by a local schema test. SAML is deferred.

Create the intended initial staff account in Supabase Auth's dashboard.
Set its existing UUID as `ADMIN_USER_ID` and securely supply the project's
server-only `SUPABASE_SERVICE_ROLE_KEY`, then run `pnpm run auth:admin`.
The script verifies that Auth user before provisioning `owner_admin`.
It does not create passwords, send invitations or elevate a guessed account.
Other new accounts receive the viewer role until staff grants their access.
Staff must assign organization and project memberships for company users.

## Connect the deployed application

The build requires the project's public URL and publishable/legacy anon key.
The server runtime separately requires that public key and its private
service-role/secret key. Use the environment matrix and commands in
[Vercel deployment](vercel-deployment.md). Keep Management API tokens,
database passwords and service-role keys out of `VITE_` variables.

Check `db:check` for 79 protected tables, three private buckets, no missing
profiles and at least one provisioned administrator. After deployment, verify
real sign-in, password reset, permitted project access and a controlled
quote/upload workflow. These require working hosted credentials and services.

## Local validation

`pnpm run test:database` starts a disposable PostgreSQL 17 container with no
published ports, applies every migration, tests Auth profile provisioning,
RLS, role escalation, company isolation and private Storage policies, and
removes the container. Docker is required. It does not verify the hosted Auth,
email, PostgREST or Storage services. To regenerate application types from an
authenticated project, use `pnpm exec supabase gen types --project-id
gykyusczrrqkkfuktukc --schema public` and format the generated output.
