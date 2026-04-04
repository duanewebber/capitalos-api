# Progress

## Current State (2026-04-04)
- **API**: Express/Supabase REST API with scoring + matching engines
- **Routes**: opportunities, passports, scoring, matching, leads (5 routers)
- **Services**: 7-dimension readiness scoring, DEFLOW investor matching
- **Auth**: JWT middleware, applied per-router
- **CI**: GitHub Actions (node.js.yml) — green with placeholder test
- **Deploy**: Railway auto-deploy from `main` via `npm start`
- **Files**: 19 committed (src/, docs/, .github/, config files)

## Recently Completed
- package-lock.json + test script added to fix CI
- Claude operating framework: CLAUDE.md enhanced, decisions.md, architecture.md created
- Session scaffolding (progress.md, session-handoff.md) rewritten

## Next Steps
1. Deploy MVP site to capitalos.co.za (Netlify)
2. Add real test framework (vitest or jest)
3. Validate all routes work end-to-end with Supabase
