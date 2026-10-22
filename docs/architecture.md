# Shared business workspace — MVP and architecture

## Product scope

One business, two named members, one shared collection of thoughts, boards, tasks and calendar entries. Both members can capture thoughts, organize either member's thoughts, edit shared items, complete tasks and archive content. Original author and responsibility are separate: thoughts show created_by; tasks have assigned_to (or unassigned); events require calendar_owner_id. Either member can create an event for the other. Everyone is the default task/calendar view; person filters change the view, never access permissions.

AI is optional and user-triggered: send one thought, review shared suggestions, explicitly accept selected items. Either member may review an extraction. The member accepting a suggestion becomes the new item's creator; source-thought authorship stays unchanged. Assignees/calendar owners are selected by the reviewer, not inferred by AI. A database lock prevents duplicate acceptance by both people.

Initial exclusions: external calendar sync, voice/files, embeddings, public signup, autonomous scheduling and ChatGPT writes. Task deadlines are SQL dates. Events store timestamp instants and an IANA timezone; the UI rejects nonexistent/repeated daylight-saving wall times instead of guessing.

## Relational schema and RLS

workspaces → workspace_members → content. Membership stores workspace_id, user_id, display_name, active flag and slot (1 or 2). Unique (workspace_id, slot) enforces two seats without a race-prone count; each user belongs to at most one workspace. An operator provisions membership. Application users cannot change it, even through direct PostgREST calls.

thoughts, tags, thought_tags, boards, items and extractions carry workspace_id and created_by. Membership controls visibility; created_by is attribution. Database triggers prevent changing the original author or workspace. Composite foreign keys use (workspace_id, id), permitting cross-author source/board links inside the business and rejecting another workspace's records. Tags are unique per workspace.

Items also record assigned_to, calendar_owner_id, updated_by and updated_at. Foreign keys and active-member checks reject assignments outside the business. Original author references no longer cascade-delete business data when an account is removed. Deactivate membership to remove access while retaining names/history.

RLS permits active native members to read/insert/update shared content. Inserts must use auth.uid() as created_by. Both members can update each other's items; a trigger records the actual last editor. Hard deletes are denied to application users; the UI archives. Inactive members and outsiders have no access. OAuth sessions additionally need a per-user, unrevoked mcp_grants row and remain read-only. They cannot grant themselves access, consume AI quotas or accept suggestions. Deactivation blocks unexpired OAuth tokens too.

Migration 001 is the historical personal foundation. Migration 002 replaces owner-based permissions and relationships, preserving each existing owner's data in a separate workspace. It never silently shares old private data. For a fresh installation apply both migrations before provisioning Auth accounts, then use the guarded operator template to create one business with two members. Existing populated workspaces require a separate reviewed consolidation migration.

## API contracts

/api/workspace requires a validated Supabase Bearer JWT (signature, issuer, audience, expiry, role). Writes require active native membership. Origin must match APP_ORIGIN when supplied; no permissive CORS or cookie-authenticated mutation. Payload limit 32 KiB; thought limit 8,000 characters. workspace_id/created_by are database-derived, never accepted from clients. Responses use `{data: ...}` or `{error: string}`; codes: 400 validation, 401 session, 403 membership/OAuth write, 404 missing, 409 conflict/reference, 429 AI quota, 503 unavailable.

GET /api/workspace?kind=thoughts|items|boards|extractions|grants|members&q=...&offset=0 returns up to 100 accessible rows. Thoughts/items use PostgreSQL full-text search; single #tag thought queries match exact normalized tags. Members resolve attribution names. Active sessions poll every 15 seconds while visible and refresh on window focus. Concurrent full-form edits are last-write-wins; author and last editor remain recorded. Optimistic edit-conflict checks are a later hardening step.

POST operations:

- capture: `{op,id,body,timezone}`; client UUID survives retry; thought and tags commit atomically. Reused ID must match creator/content.
- board: `{op,id,title}`; shared board.
- item / edit_item: `{op,id,kind,title,details,source_id,board_id,due_on,starts_at,ends_at,timezone,assigned_to,calendar_owner_id}`. Nullable fields are explicit. Only ideas have boards, tasks have due dates/assignees, events have times/calendar owners. New events default to the caller if owner is omitted; UI requires a member selection.
- update_item: `{op,id,status:open|done|archived}`; preserves creator.
- archive_thought: `{op,id}`; either member can archive.
- extract: `{op,thought_id}`; explicit single-thought OpenAI request, strict output parsing, no tools/retrieval or hidden retries. Ten attempts per user per UTC day (twenty across two members), including failures. This is not a dollar budget.
- accept: `{op,extraction_id,indexes,edits}`; reviewed suggestions include human-selected assigned_to/calendar_owner_id. Transaction locks extraction, rejects duplicate indexes, validates dates/member references, and commits all selected items or none.
- grant / revoke: `{op,client_id}`; the caller's OAuth grant only, never business membership.

## Security and integration boundaries

The two-member demo simulates authorship in one browser-local store; it is not real authentication or device sync. It never uploads data and uses a separate key from the earlier personal demo, leaving that data untouched. Production uses signed identity and explicit membership. The UI offers sign-in only; disable public signup and configure recovery/email flows during setup.

Notes render as plain text. AI input/output and MCP results are untrusted reference material. AI remains disabled pending spending approval/configuration. MCP remains disabled pending HTTPS, account compatibility, OAuth/PKCE and resource-bound audience tests. Only search/fetch are exposed. Results include author/assignment IDs; fetch includes member names. Grant consent explains that the scope includes the other member's business contributions. No service-role client exists in the app.

## Verified documentation basis — 2026-10-21

OpenAI documents remote MCP OAuth 2.1, PKCE, resource discovery and audience binding. Account availability remains unverified. [OpenAI authentication](https://developers.openai.com/plugins/build/auth). Public plugin submission is separate; nothing was submitted. [Submission](https://developers.openai.com/plugins/deploy/submission).

Supabase documents MCP authentication, client_id claims and a default `authenticated` audience. OIDC scopes do not limit database access. Our stricter MCP resource audience requires issuer configuration and verification before enabling; never weaken the check to make linking succeed. A reviewed authorization gateway may be necessary if resource-bound issuance is unavailable. [Supabase MCP](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication), [token security](https://supabase.com/docs/guides/auth/oauth-server/token-security).

Extraction uses Responses API structured outputs; refusals/incomplete output fail without losing the thought. [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Phased roadmap

1. Local shared MVP: membership migration, attribution, assignments/calendar owners, shared editing, person filters, authorization tests, optional AI/MCP adapters.
2. Approved staging: choose region/host/budget; provision two named accounts in one workspace. Test both accounts and an outsider through real Auth/PostgREST, shared updates, deactivation, recovery and backup. Approve API spend before extraction tests.
3. ChatGPT pilot: verify account connection UI, HTTPS/OAuth discovery, client registration/consent, PKCE/resource audience and revocation. Remain read-only.
4. Production: approved deployment, edge limits, monitoring without note content, restore drill, retention/export/deletion policy. Add conflict handling where needed.
5. Optional external calendar sync, recurring entries, queued extraction, embeddings and proposed writes requiring review.
