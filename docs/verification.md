# Shared-business update verification — 2026-10-21

The workspace is now shared between two explicitly provisioned members. No services were provisioned or deployed.

- TypeScript check and production build passed.
- Eight automated tests passed. New shared-workspace tests prove cross-member read/edit access, immutable authors, valid task/calendar ownership, shared board/source links, normalized shared tags, outsider denial, blocked self-enrollment, the two-seat constraint, OAuth read-only access, membership revocation, cross-member suggestion acceptance and duplicate rejection.
- Upgrade test verifies that existing personal records keep their attribution and are not silently shared by migration 002.
- Browser demo checks: task created by Member 1 and assigned to Member 2; Member 2 edits/completes it without changing its author. Event created by Member 2 for Member 1 shows separate owner/creator. Person filtering hides that event from Member 2's filtered calendar while Everyone includes it.
- Mobile calendar layout inspected at 390 × 844; desktop shared-task view inspected. Business screenshots saved separately.
- Browser switching is a local simulation. Real simultaneous accounts, Auth/PostgREST, cloud migration, AI billing/API and ChatGPT OAuth linking still require approved staging and live integration tests.

The prior personal-demo screenshots/results below describe the earlier version, not the current shared permissions. The new business preview images are saved separately.

---

# Verification — 2026-10-21

## Passed locally

- Dependency installation completed with a lockfile and package-manager supply-chain checks.
- TypeScript check passed.
- Six automated tests passed: PostgreSQL RLS and ownership integrity; OAuth read-only grants and revocation; AI attempt quota; atomic acceptance/duplicate protection; HTTP origin/body limits; MCP initialization/tool list/input validation; schema/tag/date validation and DST handling. Several assertions are grouped within each test.
- Next.js production build passed; page plus workspace API, MCP endpoint and protected-resource metadata compiled.
- Browser flows checked: capture, persistence across reload, thought-to-task creation, task completion, board creation, idea-to-board association, calendar event creation and rendering, hashtag filtering.
- Layout inspected at a 390 × 844 mobile viewport and default desktop size. Saved screenshots: preview-mobile.jpg and preview-desktop.jpg.
- HTTP smoke checks: unconfigured workspace API, disabled MCP and disabled OAuth metadata each returned 503 without content disclosure.

## Not verified / not provisioned

No cloud Supabase project, actual Auth/PostgREST session, OpenAI request, OAuth consent flow, ChatGPT connection, deployment, email delivery, or external calendar provider was exercised. PostgreSQL tests use PGlite with a minimal auth schema and simulated signed claims; they do not prove real token issuance or PostgREST relationship queries. Production still requires the release gates in release.md, including an actual two-account Supabase test and full OAuth/ChatGPT flow.

The browser-local demo is explicitly separate from the production persistence adapter. Sample/demo records created during UI testing stay in that browser. No automatic migration or upload occurs.
