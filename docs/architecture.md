# Architecture

## System Overview

```
Client → Express API (Railway) → Supabase (Postgres)
                ↓
         JWT Auth Middleware
                ↓
    ┌───────────┼───────────┐
    Routes      Routes      Routes
 (scoring)   (matching)  (passports, opportunities, leads)
    ↓           ↓
 Services    Services
 (scoring)   (matching)
```

## Components

| Component | File | Role |
|-----------|------|------|
| Entry point | `src/index.js` | Express setup, middleware, route mounting, rate limiting |
| Supabase client | `src/lib/supabase.js` | Singleton client for all DB access |
| Auth middleware | `src/middleware/auth.js` | JWT verification, applied per-router |
| Scoring engine | `src/services/scoring.js` | 7-dimension readiness scoring (LOCKED) |
| Matching engine | `src/services/matching.js` | DEFLOW investor match score computation |
| Routes | `src/routes/*.js` | Thin wrappers — validation, call service, return response |

## Data Flow

1. Request hits Express → rate limiter → CORS/helmet
2. Route-level auth middleware verifies JWT (except `/health`, `/api/v2/leads`)
3. Route handler validates input, calls service
4. Service queries/writes Supabase, computes scores
5. Response returned, errors caught by global handler

## Deployment

- **API**: Railway, auto-deploy on push to `main`
- **Database**: Supabase hosted Postgres
- **CI**: GitHub Actions (`npm ci && npm test`)
- **MVP Site**: Netlify (planned), static HTML in `~/Desktop/CapitalOS/MVP/`

## Key Tables (Supabase)
To be documented as tables are created/confirmed.
