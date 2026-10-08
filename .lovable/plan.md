# Consolidation blockers: Windows build + tracked .env

Audit only — no behavior, design, or feature changes. Two isolated fixes.

## 1. Windows build failure in the MCP Vite integration

### What the audit found

`@lovable.dev/mcp-js@0.25.0` (`dist/stacks/tanstack/vite.js`) resolves the routes directory and then does a raw string containment check:

```text
routesDir = resolve(projectRoot, "src/routes")      // Windows: C:\...\src\routes
assertContains(projectRoot, routesDir)              // compares with startsWith(parent + sep)
```

At `configResolved` the plugin replaces `projectRoot` with Vite's `config.root`, and Vite normalizes `root` to forward slashes (`C:/Users/.../awm-coastal-windows`). The resolved `routesDir` keeps native backslashes, so `startsWith` fails and the plugin throws. This is a plugin-side normalization bug, not a project misconfiguration — it cannot be fixed by changing the `routesDir` option, because both paths are derived the same way. On Linux/macOS the separators match, which is why Lovable's own build passes.

The upgrade to `0.26.2` did not change this — the containment check still compares a forward-slash root against a native-separator path, so the fix has to happen on our side.

### Smallest safe fix: a Windows-only wrapper in `vite.config.ts`

Only `vite.config.ts` changes. Nothing else — no source files, no generated MCP routes, no formatting runs.

- Keep `mcpPlugin()` called exactly as today.
- Wrap the returned plugin in a passthrough object that overrides only `configResolved`, calling the original hook with `{ ...config, root: path.resolve(config.root) }`.
  - On Windows, `path.resolve` converts `C:/Users/.../awm-coastal-windows` back to `C:\Users\...\awm-coastal-windows`, so it matches the separators of the resolved `routesDir` and the check passes.
  - On Linux/macOS, `path.resolve` on an already-absolute POSIX path is a no-op, so Lovable's build path is byte-for-byte unchanged.
- Guard it with `process.platform === "win32"` if you want the POSIX path to skip the wrapper entirely — belt and braces; both are equivalent in effect.
- Every other hook (`config`, `buildStart`, `watchChange`, etc.) and the plugin `name`/`enforce`/`apply` fields are spread through untouched, so route emission and adoption detection behave identically.

The plugin's `projectRoot` is only used for the containment assertions and for computing the relative import path written into the generated route files. Since the normalized and native roots refer to the same directory, `relative()` yields the same POSIX-normalized string, so the four generated files stay identical.

### Files that change

- `vite.config.ts` (only)
- `package.json` may keep `@lovable.dev/mcp-js` at `0.26.2` — no revert needed

### Verification (no mass formatting, no unrelated edits)

1. Windows: `bun run build` completes without the `routesDir` error.
2. `git status` after the build shows only `vite.config.ts` modified — `src/routes/mcp.ts`, `src/routes/[.mcp]/list-tools.ts`, `src/routes/[.mcp]/invoke-tool/$tool.ts`, and `src/routes/[.well-known]/oauth-protected-resource.ts` must be unchanged.
3. Regenerate the MCP manifest and confirm the same seven tools are still advertised.
4. Sandbox/Linux: `bun run dev` starts clean and `/mcp` still responds; `bun run build` passes.
5. Do not run `bun run format` as part of this change.

## 2. `.env` is tracked in Git

### What the audit found

- `.env` is tracked (`git ls-files` lists it) and `.gitignore` has no `.env` coverage at all.
- The tracked file holds only the Supabase project id, URL, and the publishable (anon) key — publishable values, plus their `VITE_` duplicates. No private keys are in it.
- Real secrets are **not** in `.env`: server code reads `APP_USER_CONNECTION_KEY_SECRET`, `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DROPBOX_APP_KEY`/`DROPBOX_APP_SECRET`, and the Google Drive connector key from `process.env` at runtime, injected by the hosted environment.
- Client code reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` via `import.meta.env`; the MCP plugin also reads `VITE_SUPABASE_PROJECT_ID` at build time. These must remain present locally or the build/dev run breaks.

### Proposed change (no rotation, no environment breakage)

1. Add ignore coverage to `.gitignore`:
   ```text
   .env
   .env.*
   !.env.example
   ```
2. Stop tracking the file **without deleting it from disk**: `git rm --cached .env` (untrack only — the working copy stays, so local dev and the Lovable-managed environment keep their values). Note: the Lovable side regenerates `.env`; untracking is safe there because the platform writes the file, it does not read it from git history.
3. Add a committed `.env.example` with names and placeholders only — no values:
   ```text
   VITE_SUPABASE_PROJECT_ID=
   VITE_SUPABASE_URL=
   VITE_SUPABASE_PUBLISHABLE_KEY=
   SUPABASE_PROJECT_ID=
   SUPABASE_URL=
   SUPABASE_PUBLISHABLE_KEY=
   ```
   Server-only secrets are intentionally excluded — they are supplied by the platform, not by a local file.
4. Optionally add `.env` to `.prettierignore` housekeeping — not required.

History rewriting is **not** proposed: the only tracked values are publishable, so purging history would be disruptive with no security gain.

### Files that change

- `.gitignore`
- `.env.example` (new)
- `.env` untracked (file content untouched)

## Out of scope

No changes to app routes, components, Supabase schema, RLS, MCP tools, or any runtime behavior.
