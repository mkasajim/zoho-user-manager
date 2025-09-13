# Cloudflare Pages D1 Database Binding Guide for AI Agents

## Overview

This guide addresses common pitfalls and solutions when working with D1 database bindings in Cloudflare Pages, specifically for AI agents helping developers troubleshoot binding issues.

## 🚨 Common Pitfalls & Solutions

### 1. **Wrong Environment Configuration in wrangler.toml**

#### ❌ **Pitfall: Missing Default Environment Binding**
Many developers only configure D1 bindings for specific environments (`production`, `preview`) but forget the default environment:

```toml
# ❌ WRONG: Only has environment-specific bindings
[env.production]
  [[env.production.d1_databases]]
  binding = "DB"
  database_name = "my_database"
  database_id = "uuid-here"
```

#### ✅ **Solution: Add Default Environment Binding**
```toml
# ✅ CORRECT: Add default environment binding
name = "my-project"
pages_build_output_dir = ".vercel/output"

# Default environment binding (crucial for deployments)
[[d1_databases]]
binding = "DB"
database_name = "my_database"
database_id = "uuid-here"

# Environment-specific bindings (optional)
[env.production]
  [[env.production.d1_databases]]
  binding = "DB"
  database_name = "my_database"
  database_id = "uuid-here"
```

### 2. **Incorrect Binding Access Pattern in Next.js**

#### ❌ **Pitfall: Using Context Parameter Pattern**
Developers often try to access bindings through context parameters (works in Workers, not in Pages):

```typescript
// ❌ WRONG: This pattern doesn't work in Cloudflare Pages
export async function POST(
  request: NextRequest,
  { cloudflare }: { cloudflare?: { env: Env } }
) {
  const env = cloudflare?.env; // ❌ undefined in Pages
  const db = env?.DB; // ❌ undefined
}
```

#### ✅ **Solution: Use process.env Pattern**
```typescript
// ✅ CORRECT: Access bindings through process.env
export async function POST(
  request: NextRequest,
  context: any
) {
  const env = {
    DB: (process.env as any).DB,
    API_PASSWORD: process.env.API_PASSWORD,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
  };
  
  // Now you can use env.DB safely
  const result = await env.DB.prepare("SELECT * FROM users").all();
}
```

### 3. **Missing Edge Runtime Declaration**

#### ❌ **Pitfall: No Runtime Specification**
```typescript
// ❌ WRONG: Missing edge runtime
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Bindings won't be available without edge runtime
}
```

#### ✅ **Solution: Declare Edge Runtime**
```typescript
// ✅ CORRECT: Declare edge runtime
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // ✅ Required for bindings

export async function POST(request: NextRequest) {
  // Bindings now available through process.env
}
```

### 4. **Secrets vs Variables Confusion**

#### ❌ **Pitfall: Using [vars] in wrangler.toml**
```toml
# ❌ WRONG: Using [vars] for Pages (causes conflicts)
[vars]
API_PASSWORD = "secret123"
ADMIN_PASSWORD = "admin123"
```

#### ✅ **Solution: Use Pages Secrets**
```bash
# ✅ CORRECT: Use wrangler commands for secrets
wrangler pages secret put API_PASSWORD --project-name your-project
wrangler pages secret put ADMIN_PASSWORD --project-name your-project
```

### 5. **Database Migration Issues**

#### ❌ **Pitfall: Forgetting to Run Migrations**
Database exists but tables are missing because migrations weren't applied.

#### ✅ **Solution: Apply Migrations**
```bash
# Check if tables exist
wrangler d1 execute your-database --remote --command "SELECT name FROM sqlite_master WHERE type='table';"

# Apply migrations if needed
wrangler d1 migrations apply your-database --remote
```

### 6. **Wrong Database ID or Name**

#### ❌ **Pitfall: Copy-paste Errors**
Using wrong database ID from a different project or environment.

#### ✅ **Solution: Verify Database Details**
```bash
# List all databases to verify
wrangler d1 list

# Use correct database_id and database_name in wrangler.toml
```

## 🔍 Debugging Checklist for AI Agents

When helping developers debug D1 binding issues, follow this systematic approach:

### Step 1: **Verify wrangler.toml Configuration**
```bash
# Check if D1 binding exists in default environment
grep -A 5 "\[\[d1_databases\]\]" wrangler.toml
```

### Step 2: **Test Binding Access Pattern**
Create a debug endpoint:
```typescript
// src/app/api/debug/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    hasDB: !!(process.env as any).DB,
    hasSecrets: !!process.env.API_PASSWORD,
    envKeys: Object.keys(process.env).filter(k => 
      k.includes('DB') || k.includes('PASSWORD') || k.includes('API')
    )
  });
}
```

### Step 3: **Verify Deployment and Secrets**
```bash
# Check if secrets are configured
wrangler pages secret list --project-name your-project

# Check recent deployments
wrangler pages deployment list --project-name your-project
```

### Step 4: **Test Database Connection**
```bash
# Verify database exists and is accessible
wrangler d1 execute your-database --remote --command "SELECT 1 as test;"
```

## 🛠 Quick Fix Template

For AI agents, here's a quick template to fix common D1 binding issues:

### 1. Fix wrangler.toml
```toml
name = "PROJECT_NAME"
pages_build_output_dir = ".vercel/output"
compatibility_date = "2024-06-10"

# Add default environment D1 binding
[[d1_databases]]
binding = "DB"
database_name = "DATABASE_NAME"
database_id = "DATABASE_ID"
```

### 2. Fix API Route Pattern
```typescript
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  // Access bindings through process.env
  const DB = (process.env as any).DB;
  const API_PASSWORD = process.env.API_PASSWORD;
  
  if (!DB) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }
  
  // Use DB normally
  const result = await DB.prepare("SELECT * FROM table_name").all();
  return NextResponse.json(result);
}
```

### 3. Configure Secrets
```bash
wrangler pages secret put API_PASSWORD --project-name PROJECT_NAME
wrangler pages secret put ADMIN_PASSWORD --project-name PROJECT_NAME
```

## 🎯 Testing Commands

### Test Database Binding
```bash
# Test if database is accessible
wrangler d1 execute DATABASE_NAME --remote --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
```

### Test API Endpoint
```bash
# Test the debug endpoint
curl "https://your-deployment.pages.dev/api/debug"

# Should return: {"hasDB": true, "hasSecrets": true, ...}
```

## 📝 Environment-Specific Notes

### **Cloudflare Pages vs Workers**
- **Pages**: Bindings accessed via `process.env`
- **Workers**: Bindings accessed via context parameter

### **Next.js vs Other Frameworks**
- **Next.js**: Requires `export const runtime = 'edge'`
- **Other**: May have different runtime requirements

### **Local Development**
- D1 bindings not available in local dev (`npm run dev`)
- Use fallback values or mock data for local development
- Only works in deployed Cloudflare Pages environment

## 🚀 Complete Working Example

Here's a complete working example that AI agents can reference:

### wrangler.toml
```toml
name = "my-nextjs-app"
pages_build_output_dir = ".vercel/output"
compatibility_date = "2024-06-10"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "my_database"
database_id = "a5a47b7c-dd50-4378-b8f6-4be1e2152788"
```

### API Route
```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const DB = (process.env as any).DB;
    
    if (!DB) {
      return NextResponse.json(
        { error: 'Database not available' }, 
        { status: 500 }
      );
    }
    
    const users = await DB.prepare("SELECT * FROM users").all();
    return NextResponse.json(users.results);
  } catch (error) {
    return NextResponse.json(
      { error: 'Database query failed' }, 
      { status: 500 }
    );
  }
}
```

### Deployment
```bash
npm run build
npx @cloudflare/next-on-pages@latest
wrangler pages deploy .vercel/output/static --project-name my-nextjs-app
```

## 🎓 Key Takeaways for AI Agents

1. **Always add D1 binding to default environment** in wrangler.toml
2. **Use `process.env` not context parameters** for Next.js on Pages
3. **Declare `export const runtime = 'edge'`** in API routes
4. **Use Pages secrets, not [vars]** for sensitive data
5. **Test with debug endpoint** to verify bindings work
6. **Apply migrations** before expecting database operations to work

This guide should help AI agents quickly identify and resolve D1 binding issues in Cloudflare Pages projects.
