# Deploy AWMLLC with Vercel and Supabase

Vercel hosts the TanStack Start application; Supabase provides Auth, the
database and Storage. The default Nitro build target is `vercel`.
`src/server.ts` compiles into a Vercel server function and browser assets under
`.vercel/output`. This uses Vercel's Build Output API, not a static Vite site.

Connect `AiXentium/AWMLLC` in Vercel and select `main` as the production branch.
The committed `vercel.json` selects Framework Preset **Other**, installs with
`pnpm install --frozen-lockfile`, and builds with `pnpm run build:vercel`.
Use Node.js **24.x**. Leave the Output Directory override disabled; Nitro
generates `.vercel/output` with its own routing and function configuration.
Clear dashboard overrides that still run Wrangler or deploy `dist` as a
static site. With Git integration enabled, pushes trigger Vercel builds.

## Environment variables

In **Vercel Project → Settings → Environment Variables**, enter these values
for Production and, if needed, Preview. The URL and both keys must belong to
project `gykyusczrrqkkfuktukc`.

| Variable                    | Value                                              |
| --------------------------- | -------------------------------------------------- |
| `SUPABASE_URL`              | `https://gykyusczrrqkkfuktukc.supabase.co`         |
| `SUPABASE_PUBLISHABLE_KEY`  | This project's publishable or legacy anon key      |
| `SUPABASE_SERVICE_ROLE_KEY` | This project's private service-role/secret key     |
| `SITE_URL`                  | The actual production HTTPS origin, without a path |

The build maps the public URL/key to `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`, and derives `VITE_SUPABASE_PROJECT_ID`.
If entering explicit `VITE_` aliases, use the same project, URL and public key.
The server still needs the unprefixed variables in the table. Private keys
must never have a `VITE_` prefix. Optional AI, email, Drive, Dropbox and paid OCR
variables are documented in `.env.example`; set only the integrations used.

Use the base Supabase URL above, without `/rest/v1/`. Remove stale URLs and
keys from project `aykvxycasuwnpavcunvb`. Vercel builds reject missing server
variables, conflicting browser/runtime URLs and a different Supabase project.
Changing build variables requires a fresh deployment.

## Supabase and authentication

Follow [Supabase setup](supabase-setup.md) to apply the application migrations
and provision the initial staff account. Application API keys cannot create
the database schema; use authenticated Supabase CLI/MCP or the empty-project
SQL bootstrap described there.

Set Supabase Auth's **Site URL** to the actual Vercel production origin and
allow `<SITE_URL>/reset-password`. Configure exact preview redirect URLs only
for previews that should support authentication. With authenticated CLI access
and `SITE_URL` configured, `pnpm run auth:configure -- --check` reviews changes
and `pnpm run auth:configure` applies the production Auth settings.
Database administration tokens and passwords are not app runtime variables.

## Validate and deploy

```sh
pnpm install --frozen-lockfile
pnpm run test:deployment
pnpm exec tsc --noEmit
pnpm run check:env
pnpm run build:vercel
```

The output should include `.vercel/output/config.json`, static assets, and
`functions/__server.func/index.mjs` with a `nodejs24.x` runtime configuration.
Local compilation without public keys verifies compilation only; real Vercel
builds require the listed environment variables. After the connected Git push
or dashboard deployment, inspect Vercel's build log and check the live homepage,
assets, real sign-in, password reset and a controlled quote/upload workflow.
Successful compilation does not establish that hosted database setup or live
authentication is complete.

Vercel supplies a `vercel.app` hostname. For a custom domain, use the DNS
instructions displayed under Vercel **Settings → Domains** for that hostname.

## Retained Cloudflare commands

The optional legacy Worker uses `build:cloudflare`, `deploy:cloudflare`,
`deploy:configured:cloudflare` and `deploy:check:cloudflare`. Wrangler explicitly
calls the Cloudflare build target. These commands are not part of Vercel's
deployment process; see [Cloudflare deployment](cloudflare-deployment.md).
