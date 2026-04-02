# CapitalOS API — Claude Instructions

## Project Overview

**CapitalOS API** is a Node.js/Express REST API providing capital readiness scoring and DEFLOW investor matching for African SMEs and deal passports.

- **Runtime**: Node.js ≥18, Express v4
- **Database**: Supabase (Postgres via `@supabase/supabase-js`)
- **Auth**: JWT middleware (`src/middleware/auth.js`)
- **Deployment**: Railway (`railway.toml`) — auto-deploy from `main`
- **Base path**: `/api/v2/`

## Project Structure

```
src/
  index.js                  # App entry — Express setup, route mounting, rate limiting
  lib/supabase.js           # Supabase client singleton
  middleware/auth.js        # JWT verification middleware
  routes/
    opportunities.js        # Deal opportunity CRUD
    passports.js            # Deal passport management
    scoring.js              # Readiness assessment endpoints
    matching.js             # DEFLOW investor matching endpoints
    leads.js                # Lead capture (public, rate-limited)
  services/
    scoring.js              # 7-dimension readiness scoring engine
    matching.js             # DEFLOW match score computation
docs/
  progress.md               # Completed / in-progress / next step
  session-handoff.md        # Restart summary for next session
  decisions.md              # Architectural decisions (create if absent)
```

## Domain Concepts

- **Readiness Score**: 7-dimension weighted composite (financial_strength 25%, market_validation 20%, management_quality 20%, capital_structure 15%, regulatory_compliance 10%, exit_potential 5%, esg_score 5%)
- **Readiness Tiers**: `investor_ready` (≥75) · `fundable` (≥55) · `emerging` (≥35) · `early_stage` (<35)
- **DEFLOW Match Score**: Weighted composite of dealFit (40%), financialFit (20%), stageFit (15%), riskFit (15%), esgFit (10%)
- **Deal Passport**: Structured deal profile used as matching input

## Environment Variables

All secrets live in `.env` only. Never hardcode or log them.

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
JWT_SECRET=
PORT=3000
NODE_ENV=
CAPITALOS_OPERATOR_URL=
```

Validate at the top of any new file that uses env vars:
```js
const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) throw new Error('SUPABASE_URL is not set');
```

## Key Conventions

- All routes are under `/api/v2/`
- Auth middleware applied per-router (not globally) — check existing routes before adding
- Rate limits: 500 req/15min on `/api/`, 100 req/hr on `/api/v2/leads`
- Supabase errors are thrown directly — the global error handler catches them
- No test framework currently present — validate manually via `/health` and route-level testing

## Safety Rules

- **NEVER deploy to Railway without confirming the change works locally first**
- **NEVER modify `src/services/scoring.js` scoring weights or tier thresholds** without explicit instruction — these are calibrated business rules
- **NEVER add a new route without applying auth middleware** unless it's intentionally public (like `/api/v2/leads`)
- **NEVER commit `.env`** — verify `.gitignore` before every commit

## Deployment

Push to `main` → Railway auto-deploys via `npm start`.
Health check: `GET /health` — must return `{ status: "healthy" }`.
Check Railway logs if a deploy fails before attempting a fix.

## Token Discipline

- Do not make changes until you have 95% confidence in the plan.
- Default to Plan Mode first.
- Keep responses concise.
- Do not explore the whole repo unless explicitly asked.
- In first pass, inspect the minimum number of files needed.
- Before editing, name the exact files to be changed and why.
- Limit shell output with `head`, `tail`, `grep`, or targeted commands.
- Run targeted tests only.
- After each completed work unit, update `docs/progress.md` and `docs/session-handoff.md`.
- Save architectural decisions in `docs/decisions.md`, not in chat.
- If context exceeds ~60%, compact with explicit preservation instructions.
- Use a fresh chat for unrelated tasks.
