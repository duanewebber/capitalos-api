# Capital OS Session Handoff

## Project
Capital OS

## Immediate Next Session Instruction
The next session should read:
1. `CLAUDE.md`
2. `docs/progress.md`
3. `docs/session-handoff.md`

Then it should focus only on deployment and do the following:
1. Check current deploy status
2. Identify the exact deploy files required
3. Deploy the required files to Netlify
4. Confirm the live site is working at `capitalos.co.za`

The next session should not:
- resume old exploratory work
- re-audit the whole repo
- reopen architecture discussions
- explore unrelated files

If blocked, it should report only:
- the exact blocker
- the exact file or setting involved
- the shortest resolution path

## Handoff Purpose
This file exists to let a new Claude Code / Coworker session restart quickly without relying on long previous chats.

## Immediate Objective
Continue the current deployment workflow and get the current Capital OS site live at `capitalos.co.za`.

## Do Not Reopen
The next session should **not** reopen:
- broad architecture discussions
- repo-wide audits
- product strategy debates
- unrelated debugging
- token optimization theory beyond what is already operationalized

The next session is **deployment only** unless a blocker makes that impossible.

## Exact Pending Work
1. Check current deploy status
2. Identify the exact files required for deploy
3. Upload/deploy the required HTML files to Netlify
4. Confirm the live site is working correctly at `capitalos.co.za`

## Required Session Behavior
- Start in plan mode
- Keep responses concise
- Do not assume the old paused session should be resumed
- Do not scan the full repo
- Read only the minimum required files first
- State exact files needed before making changes
- Prefer the shortest path to successful deployment
- Skip browser chunk loading if direct deployment is possible
- Avoid unnecessary commentary

## Files to Read First
Read only these files first:
1. `CLAUDE.md`
2. `docs/progress.md`
3. `docs/session-handoff.md`

## If Additional Context Is Needed
Only then inspect the minimum additional deployment-related files required to complete the task. Do not perform a broad repo scan.

## Current Understanding
- Capital OS is the correct project name
- The project is being run with a token-discipline approach
- Previous sessions became too expensive because context grew too large
- Durable project memory is now being moved into repo files
- The current unfinished work is the deploy, not a redesign

## Likely Best Next Move
In the next fresh session, the AI should:
1. confirm the exact deployment path
2. identify the minimum deployment artifacts
3. proceed with deployment steps only
4. confirm whether `capitalos.co.za` is live

## Success Condition
The current session chain is considered successfully resumed only when:
- the required deploy files are identified
- the deployment is completed
- `capitalos.co.za` is confirmed live
- the outcome is written back into `docs/progress.md`

## If Blocked
If deployment cannot proceed, the AI should report only:
- the exact blocker
- the exact file or setting involved
- the shortest recommended resolution path

Do not branch into unrelated analysis.
