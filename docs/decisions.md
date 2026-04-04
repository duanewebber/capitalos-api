# Architectural Decisions

Settled decisions. Do not reopen unless explicitly asked.

## D001: Git repo rooted at $HOME
- **Decision**: The git repo is initialized at `~` with a restrictive `.gitignore` that only allows `src/`, `docs/`, `.github/`, and config files.
- **Tradeoff**: Unusual structure, but works with Railway deploy. May need to move to a dedicated directory later.
- **Status**: Accepted (2026-04-04)

## D002: Supabase as sole datastore
- **Decision**: Use Supabase (Postgres) via `@supabase/supabase-js`. No ORM, no local DB.
- **Reason**: Fastest path to production for a small team. Supabase provides auth, storage, and realtime if needed later.
- **Status**: Accepted

## D003: No test framework yet
- **Decision**: Placeholder `npm test` that exits 0. Real tests deferred until core routes are validated manually.
- **Reason**: API is still in early build phase. Adding a test framework before routes are stable would slow iteration.
- **Status**: Accepted, revisit when routes are stable

## D004: Railway for API deployment
- **Decision**: Auto-deploy from `main` via Railway. Health check at `GET /health`.
- **Status**: Accepted

## D005: Scoring weights are business rules
- **Decision**: 7-dimension weights (financial_strength 25%, market_validation 20%, management_quality 20%, capital_structure 15%, regulatory_compliance 10%, exit_potential 5%, esg_score 5%) and tier thresholds are calibrated. Never modify without explicit instruction.
- **Status**: Locked

## D006: CommonJS, no TypeScript
- **Decision**: Plain Node.js with `require`/`module.exports`. No build step.
- **Reason**: Simplicity. One fewer thing to break in deployment.
- **Status**: Accepted
