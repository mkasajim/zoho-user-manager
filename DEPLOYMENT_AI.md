# Cloudflare Pages + Next.js 14 Deployment Playbook (for AI agents)

This playbook describes a reliable, repeatable way to build and deploy a Next.js App Router project to Cloudflare Pages with server-side Functions and a D1 database. It includes Windows-safe steps, an example wrangler.toml, and end‑to‑end commands.

Use this when:
- You need Pages Functions (API routes) to work
- You must bind a D1 database
- You want to deploy via the Wrangler CLI (not Git integration)

---

## 1) Prerequisites

- Node.js 18+
- Wrangler CLI v4.36.0+ (older works, but 4.36+ is recommended)
- For Windows users: Vercel CLI may be unreliable under native PowerShell. If `@cloudflare/next-on-pages` build fails, use the Windows workaround in section 3B.

```bash
# Check versions
wrangler --version
node -v
```

If Wrangler asks you to log in or refresh scopes:
```bash
wrangler login
```

---

## 2) Configure D1 and environment variables

### 2.1 Create a D1 database
```bash
# Name your DB; keep it simple and unique
wrangler d1 create my_next_pages_db
# Output shows: database_id (copy it)
```

### 2.2 Add initial schema (migration)
Create a migration file at `migrations/001_init.sql` with tables and indexes:
```sql
-- migrations/001_init.sql
CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname TEXT NOT NULL,
  os TEXT,
  arch TEXT,
  cpu TEXT,
  mac_address TEXT,
  disk_serial TEXT,
  system_uuid TEXT,
  motherboard_serial TEXT,
  cpu_id TEXT,
  is_blocked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_signin TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_system_uuid ON devices (system_uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_mac_address ON devices (mac_address);
```

Apply the migration (binding form requires env setup in wrangler.toml; see 2.3). If env not ready yet, execute by DB name/ID instead (see Troubleshooting):
```bash
# If env/binding is configured (see 2.3):
wrangler d1 execute DB --file=./migrations/001_init.sql --env production --remote
```

### 2.3 Example wrangler.toml (for Pages CLI deploys)
Use env-specific D1 bindings. Do NOT declare [vars] if you plan to set secrets via Pages (recommended). Replace the database_id and database_name with your values.
```toml
name = "my-next-pages-app"
pages_build_output_dir = ".vercel/output"
compatibility_date = "2024-06-10"
compatibility_flags = ["nodejs_compat"]

[env.production]
  [[env.production.d1_databases]]
  binding = "DB"
  database_name = "my_next_pages_db"
  database_id = "<YOUR_DATABASE_ID>"

[env.preview]
  [[env.preview.d1_databases]]
  binding = "DB"
  database_name = "my_next_pages_db"
  database_id = "<YOUR_DATABASE_ID>"
```

### 2.4 Set Pages secrets (env variables)
Use project-level secrets for both Production and Preview. Run twice if you want both environments.
```bash
# Production by default
wrangler pages secret put ADMIN_PASSWORD --project-name <PROJECT_NAME>
wrangler pages secret put API_PASSWORD   --project-name <PROJECT_NAME>
```

Note: Avoid duplicating the same variables in wrangler.toml [vars] when deploying to Pages. That can cause binding conflicts (e.g., "Binding name 'ADMIN_PASSWORD' already in use").

---

## 3) Build Next.js for Cloudflare Pages

You need the .vercel/output directory with Functions and (for some cases) a Worker bundle.

### 3A) Standard build (Linux/macOS or stable Windows)
```bash
# Installs and runs Vercel build + transforms for Pages
npx @cloudflare/next-on-pages@latest
# Produces .vercel/output with functions
```

### 3B) Windows fallback (reliable)
If the above fails on Windows, run Vercel build first, then generate the Pages worker with `--skip-build`:
```bash
# 1) Build Next.js via Vercel
npx vercel build

# 2) Generate Pages worker + attach function routes without re-running Vercel build
npx @cloudflare/next-on-pages@latest --skip-build
# This creates .vercel/output/static/_worker.js and the function modules
```

---

## 4) Deploy to Cloudflare Pages (CLI)

You can deploy either the whole .vercel/output or only the static directory. If deploying only static, Wrangler will attach the worker and function modules.

- Option A: Deploy the entire output (works when functions are in .vercel/output/functions)
```bash
wrangler pages deploy .vercel/output --project-name <PROJECT_NAME> --branch main --commit-message "Deploy"
```

- Option B: Deploy static + worker (recommended when using the Windows fallback)
```bash
wrangler pages deploy .vercel/output/static --project-name <PROJECT_NAME> --branch main --commit-message "Deploy static + worker"
```

If you see a binding conflict error, remove duplicate [vars] in wrangler.toml and use Pages secrets instead (see 2.4).

---

## 5) Verify

```bash
# Root page
curl -i https://<PROJECT_NAME>.pages.dev/

# Admin login (expect 401 for wrong password)
curl -i -H "content-type: application/json" \
  -d '{"password":"wrong"}' \
  https://<PROJECT_NAME>.pages.dev/api/admin/login

# Devices (expect 401 without auth)
curl -i https://<PROJECT_NAME>.pages.dev/api/admin/devices

# Tail logs if needed
wrangler pages deployment list --project-name <PROJECT_NAME>
wrangler pages deployment tail --project-name <PROJECT_NAME> --deployment-id <ID>
```

---

## Troubleshooting

- 404 at "/" or APIs not routed:
  - Build may have used `next build` instead of `@cloudflare/next-on-pages`.
  - On Windows, ensure `_worker.js` exists under `.vercel/output/static/_worker.js` and deploy Option B.

- 405 on POST APIs:
  - Often indicates the request hit static hosting without the worker attached. Rebuild with next-on-pages and deploy with the worker (Option B).

- "Binding name 'ADMIN_PASSWORD' already in use":
  - Remove [vars] from wrangler.toml when using Pages secrets. Use `wrangler pages secret put ...` instead.

- D1 commands fail with authentication/scopes:
  - Run `wrangler login` to refresh OAuth scopes.

- Apply migration directly by DB name/ID (when env/bindings not ready yet):
  ```bash
  # Replace with your database UUID from `wrangler d1 list`
  wrangler d1 execute <DB_UUID> --file=./migrations/001_init.sql
  ```

---

## Minimal end-to-end (Unix/macOS)
```bash
# 1) Create DB
wrangler d1 create my_next_pages_db

# 2) Configure wrangler.toml with env.production/preview d1_databases
# 3) Add migrations/001_init.sql (from this doc)
wrangler d1 execute DB --file=./migrations/001_init.sql --env production --remote

# 4) Secrets
wrangler pages secret put ADMIN_PASSWORD --project-name <PROJECT_NAME>
wrangler pages secret put API_PASSWORD   --project-name <PROJECT_NAME>

# 5) Build + Deploy
npx @cloudflare/next-on-pages@latest
wrangler pages deploy .vercel/output --project-name <PROJECT_NAME>
```

## Minimal end-to-end (Windows-safe)
```bash
# 1) Create DB
wrangler d1 create my_next_pages_db

# 2) Configure wrangler.toml with env.production/preview d1_databases
# 3) Add migrations/001_init.sql (from this doc)
wrangler d1 execute DB --file=./migrations/001_init.sql --env production --remote

# 4) Secrets
wrangler pages secret put ADMIN_PASSWORD --project-name <PROJECT_NAME>
wrangler pages secret put API_PASSWORD   --project-name <PROJECT_NAME>

# 5) Build (Windows fallback) + Deploy static+worker
npx vercel build
npx @cloudflare/next-on-pages@latest --skip-build
wrangler pages deploy .vercel/output/static --project-name <PROJECT_NAME>
```

---

## Notes
- For Git-integrated Pages projects: wrangler.toml bindings are ignored; configure D1 bindings and environment variables in the Pages UI.
- Prefer Pages secrets over [vars] in wrangler.toml for deploys to avoid conflicts.
- The Next.js route handlers should read Cloudflare bindings via `context.cloudflare.env` (as implemented in this repo).
