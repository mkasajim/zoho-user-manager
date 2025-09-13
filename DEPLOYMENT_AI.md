# Cloudflare Pages + Next.js 14 Deployment Playbook (for AI agents)

This playbook describes a reliable, repeatable way to build and deploy a Next.js App Router project to Cloudflare Pages with server-side Functions and a D1 database. It includes Windows-safe steps, an example wrangler.toml, and end‑to‑end commands.

Use this when:
- You need Pages Functions (API routes) to work
- You must bind a D1 database
- You want to deploy via the Wrangler CLI (not Git integration)

---

## 1) Prerequisites

- Node.js 18+ (Note: Node.js 22+ may cause Vercel CLI compatibility issues - see 3C for workaround)
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

### 3C) Node.js 22+ compatibility fallback
If you encounter "Found invalid Node.js Version" errors with Vercel CLI on Node.js 22+:
```bash
# Use direct Next.js build instead of Vercel CLI
npm run build

# Then generate the Cloudflare Pages output
npx @cloudflare/next-on-pages@latest
```

**Important**: If using this approach, you MUST deploy using Option B (static + worker) in step 4.

---

## 4) Deploy to Cloudflare Pages (CLI)

You can deploy either the whole .vercel/output or only the static directory. If deploying only static, Wrangler will attach the worker and function modules.

- Option A: Deploy the entire output (works when functions are in .vercel/output/functions)
```bash
wrangler pages deploy .vercel/output --project-name <PROJECT_NAME> --branch main --commit-message "Deploy"
```

- Option B: Deploy static + worker (REQUIRED when using Node.js 22+ fallback or Windows workaround)
```bash
wrangler pages deploy .vercel/output/static --project-name <PROJECT_NAME> --branch main --commit-message "Deploy static + worker"
```

**Critical**: If you used the Node.js 22+ fallback (3C) or Windows fallback (3B), you MUST use Option B. Option A will result in 404/405 errors for API routes.

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

### 404/405 Routing Issues (MOST COMMON)

**Problem**: 404 errors on root page "/" or 405 "Method Not Allowed" on API routes
**Root Cause**: Worker not properly attached to handle dynamic routes

**Symptoms**:
- `curl https://yourproject.pages.dev/` returns 404 with Cloudflare Pages error page
- `curl -X POST https://yourproject.pages.dev/api/admin/login` returns 405 Method Not Allowed
- Static assets work but dynamic routes fail

**Solutions** (try in order):

1. **Wrong deployment method**: If you used Option A (.vercel/output) but should have used Option B (.vercel/output/static)
   ```bash
   # Redeploy with Option B
   wrangler pages deploy .vercel/output/static --project-name <PROJECT_NAME>
   ```

2. **Node.js version compatibility**: If using Node.js 22+ and got Vercel CLI errors during build
   ```bash
   # Use the Node.js 22+ fallback build process
   npm run build
   npx @cloudflare/next-on-pages@latest
   # Then MUST use Option B deployment
   wrangler pages deploy .vercel/output/static --project-name <PROJECT_NAME>
   ```

3. **Missing worker file**: Verify `_worker.js` exists
   ```bash
   ls -la .vercel/output/static/_worker.js
   # Should exist and contain Cloudflare Pages worker code
   ```

4. **Build process used wrong method**: Ensure you used `@cloudflare/next-on-pages`, not just `next build`
   ```bash
   # Rebuild properly
   rm -rf .vercel
   npx @cloudflare/next-on-pages@latest
   ```

### Other Common Issues

- **"Found invalid Node.js Version" during build**:
  - You're using Node.js 22+ but Vercel CLI expects 20.x
  - Use the Node.js 22+ fallback (section 3C) and deploy with Option B

- **"Binding name 'ADMIN_PASSWORD' already in use"**:
  - Remove [vars] from wrangler.toml when using Pages secrets. Use `wrangler pages secret put ...` instead.

- **D1 commands fail with authentication/scopes**:
  - Run `wrangler login` to refresh OAuth scopes.

- **Apply migration directly by DB name/ID (when env/bindings not ready yet)**:
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

## Minimal end-to-end (Node.js 22+ compatible)
```bash
# 1) Create DB
wrangler d1 create my_next_pages_db

# 2) Configure wrangler.toml with env.production/preview d1_databases
# 3) Add migrations/001_init.sql (from this doc)
wrangler d1 execute DB --file=./migrations/001_init.sql --env production --remote

# 4) Secrets
wrangler pages secret put ADMIN_PASSWORD --project-name <PROJECT_NAME>
wrangler pages secret put API_PASSWORD   --project-name <PROJECT_NAME>

# 5) Build (Node.js 22+ fallback) + Deploy static+worker
npm run build
npx @cloudflare/next-on-pages@latest
wrangler pages deploy .vercel/output/static --project-name <PROJECT_NAME>
```

---

---

## Real-World Case Study: 404 Resolution

**What happened**: During deployment of `zoho-user-manager`, we encountered 404 errors on the root page and 405 errors on API endpoints after initial deployment.

**Timeline of the issue**:
1. Initial build with `npx @cloudflare/next-on-pages@latest` failed due to Node.js v23 incompatibility with Vercel CLI
2. Used fallback build process: `npm run build` → `npx @cloudflare/next-on-pages@latest`
3. First deployment used Option A: `wrangler pages deploy .vercel/output` 
4. **Result**: 404 on root page, 405 on API endpoints (functions not attached)
5. **Solution**: Redeployed with Option B: `wrangler pages deploy .vercel/output/static`
6. **Success**: API endpoints returned proper 401 responses, functions working correctly

**Key learnings**:
- When using Node.js 22+ fallback builds, Option A deployment doesn't properly attach the worker
- Option B deployment explicitly uploads the worker and function modules
- The symptom `HTTP/2 405` on POST requests indicates functions aren't being reached
- Proper functioning is confirmed by getting expected 401 responses from secured endpoints

**Prevention**: Always use Option B deployment when using any fallback build method (Node.js 22+, Windows, or manual builds).

---

## Notes
- For Git-integrated Pages projects: wrangler.toml bindings are ignored; configure D1 bindings and environment variables in the Pages UI.
- Prefer Pages secrets over [vars] in wrangler.toml for deploys to avoid conflicts.
- The Next.js route handlers should read Cloudflare bindings via `context.cloudflare.env` (as implemented in this repo).
