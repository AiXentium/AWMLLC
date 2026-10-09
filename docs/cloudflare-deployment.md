# Deploy AWMLLC to Cloudflare Workers

The source entry is `src/server.ts`. TanStack Start and Nitro compile it into
`.output/server/index.mjs`; `.output/public` contains the browser assets.
The committed `wrangler.json` names the existing Worker `awmllc` and runs
`npm run build` before loading that generated entry. This avoids Wrangler's
framework auto-configuration and its filtered build command.

Use Node.js 24.19.0 (`.nvmrc`) and pnpm 10.34.6 (`packageManager`). Dependencies
and Wrangler are locked in `pnpm-lock.yaml`. Install with
`pnpm install --frozen-lockfile`. In Workers Builds, keep the deploy command
`npx wrangler deploy --config wrangler.json` or use `pnpm run deploy`; the build command is already
configured in `wrangler.json`. An additional Cloudflare build command is not
required. Existing dashboard variables are retained with `keep_vars`.

Nitro's deployment-config generation is disabled because the root config is
authoritative. Explicit `--config` also bypasses stale configuration redirects
left in a cached `.wrangler/deploy` directory by earlier builds.

## Public build settings

In the Cloudflare Worker's **Settings > Build > Variables and secrets**, set:

| Name                       | Value                                                            |
| -------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`             | `https://gykyusczrrqkkfuktukc.supabase.co`                       |
| `SUPABASE_PUBLISHABLE_KEY` | The publishable/legacy anon key from this project's API settings |

`scripts/build.mjs` copies only these public settings to
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and derives the public
project ID. Explicit `VITE_` aliases are also accepted. The public project URL
defaults to `wrangler.json`; update its runtime URL too if using another project.
Cloudflare builds (`WORKERS_CI=1`) fail with a specific message if the public
key is absent. A service-role/secret key is rejected as a browser build key.
Never put private credentials in `VITE_` variables.

## Worker runtime settings

In **Settings > Variables and Secrets**, add encrypted Worker secrets:

| Required secret             | Used by                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `SUPABASE_PUBLISHABLE_KEY`  | Server authentication and public resource queries                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Quote submissions, signed uploads, and server-only database operations |

The runtime `SUPABASE_URL` and nonsecret PostgreSQL settings are declared in
`wrangler.json`. These values use project `gykyusczrrqkkfuktukc`, supplied by
the project owner. Confirm that the publishable and service-role keys belong to
that project and that its application tables/storage policies are provisioned.
The Supabase CLI configuration and database scripts explicitly select this
project. Follow [Supabase setup](supabase-setup.md) to provision its database,
private storage and production authentication settings.

Optional features require additional **runtime** secrets/settings:

- AI: `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`,
  or `ANTHROPIC_API_KEY`; configure the provider you intend to use.
- Dropbox: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, and
  `APP_USER_CONNECTION_KEY_SECRET`.
- Google Drive: `GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY`,
  `LOVABLE_API_KEY`, and `APP_USER_CONNECTION_KEY_SECRET`.
- Lead email/SMS: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and production `SITE_URL`;
  optional overrides are `LEAD_NOTIFY_EMAIL` and `LEAD_NOTIFY_SMS`.
- Direct PostgreSQL tooling: `PGPASSWORD`; it does not replace Supabase API
  keys or authenticate the Supabase MCP connection.

Use Cloudflare's encrypted secret entry or Wrangler's stdin secret workflow.
Never commit actual values in `.env`, `.dev.vars`, scripts, or configuration.
Paid OCR currently uses optional client-side `VITE_GOOGLE_DOCAI_*` or
`VITE_AZURE_DOCINTEL_*` settings; only use restricted browser-appropriate keys
if deliberately enabling those providers.

## Deploy from Codex or a shell

Cloudflare build settings do not populate the Codex process environment.
For deployment here, securely provide `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` in this Codex environment, then check
`pnpm exec wrangler whoami`. The token needs access to the intended account's
Workers scripts and deployments. A token rolled in Cloudflare must also be
updated wherever the old token was stored.

If the required runtime secrets already exist in the Worker dashboard, run
`pnpm run deploy`. Its environment check requires the public build key and
Wrangler compiles the configured server entry before uploading.

To upload the two Supabase runtime keys from a directly bound environment
and deploy together, run:

```sh
pnpm run deploy:configured -- --check
pnpm run deploy:configured
```

This command sends encrypted Worker secrets through stdin, without placing
their values in a file or command arguments. It preserves other Worker secrets.
It requires a real server key; a Codex proxy placeholder cannot be copied into
Cloudflare as a working secret. For proxy-delivered keys, use Cloudflare's
dashboard secret entry and the normal deploy command. Optional `SITE_URL` sets
the production HTTPS origin for server redirects and lead links. Deployment
credentials stay in the deploying process and are not uploaded to the Worker.

## Validate before deployment

```sh
pnpm install --frozen-lockfile
pnpm run test:deployment
pnpm run check:env
pnpm run deploy:check
pnpm audit
```

`deploy:check` compiles the real Worker and runs Wrangler's upload validation
without publishing. Local compilation without API keys checks build/runtime
compatibility only; it does not verify authenticated database functionality.
After deploying, check the homepage, Resources, real sign-in, and a controlled
quote/upload workflow using the configured project.

The lockfile audit covers reported advisories at the time of the scan. It does
not establish that all application code, infrastructure, or future versions are
free of vulnerabilities.
