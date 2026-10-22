# Stillroom — shared business workspace

Local Next.js implementation. No cloud project, paid service, or deployment has been created. `sources/` in the parent project is untouched.

## Business model

Both members share thoughts, boards, tasks, and calendar entries. Thoughts show who entered them. Tasks have an assignee; events have a calendar owner. Original authors remain unchanged when either member edits shared items. Everyone is the default calendar/task view, with person filters for focus. Active signed-in sessions refresh every 3 minutes, pause background refresh after 5 minutes without a click, keypress, or scroll, and skip refresh while hidden. Returning to the tab or resuming activity refreshes immediately (duplicate return events within 5 seconds are combined). Saves still refresh immediately.

The local demo has two clearly labelled example members and a member switcher. This simulates authorship in one browser; it is not live two-device synchronization. Its storage is separate from the earlier personal demo, whose records are left untouched.

Existing v1 databases are not automatically merged: migration 002 preserves each previous owner's records in a separate workspace. Consolidating existing records requires an explicit, reviewed migration. The fresh-install provisioning template deliberately refuses accounts that already have memberships.

## Run

Node 22+, pnpm 10+: `pnpm install`, then `pnpm dev`. Open http://127.0.0.1:3000. With no Supabase configuration the app offers an explicitly labelled, browser-local demo. Demo content never calls AI or syncs automatically.

Copy `.env.example` to `.env.local` for a real backend. Apply `supabase/migrations/001_workspace.sql` and then `002_shared_business.sql` to a **new, approved** Supabase project before provisioning users; configure email/password authentication, then add its URL and publishable key. Do not use a service-role key. Restart after environment changes. Provision the two Auth accounts through your approved Supabase administrator flow, then add both to the same workspace using the guarded template in `supabase/provision_two_members.sql`. The app supports sign-in/sign-out; it does not offer public signup or self-enrollment. Configure email confirmation/recovery in Supabase.

Use Supabase asymmetric JWT signing keys (ES256 or RS256); this implementation verifies signatures through JWKS and intentionally does not accept legacy HS256 tokens. APP_ORIGIN must exactly match the browser origin, including the local hostname and port. Default local development uses http://127.0.0.1:3000.

AI requires separate spending approval, `AI_ENABLED=true`, a server-side API key, and an explicitly selected `OPENAI_MODEL` supporting structured outputs. There is no default paid model. All suggestions remain drafts until selected and saved. Capture itself is independent of AI availability.

## Verify

`pnpm typecheck`, `pnpm test`, `pnpm build`. Tests exercise PostgreSQL RLS using PGlite, cross-workspace references, atomic suggestion acceptance, and validation. PGlite is not a replacement for a staging Supabase/Auth integration test.

See [verification results](docs/verification.md) for checks actually run and remaining integration limits. Current business screenshots: `docs/business-desktop.jpg` and `docs/business-mobile.jpg`. Earlier `preview-*` screenshots show the original personal demo.

See [design and API contracts](docs/architecture.md) and [release gates](docs/release.md). MCP is implemented as a disabled-by-default resource server; full ChatGPT linking requires a deployed HTTPS endpoint, configured OAuth issuer, verified audience binding, consent, and an account-level connection test. It is not presented as an already connected integration.

Hosting preparation: see [hosting setup](docs/hosting.md) and netlify.toml. Deployment requires separate approval.

## Install on Android
Open https://sotaria-workspace.netlify.app in Chrome. Use the three-dot menu,
then **Add to Home screen** / **Install app**, and confirm. Launch Stillroom
from its new icon. Installation is available after the manifest update is deployed.
The app opens in a standalone window and still requires internet access.
This release adds no offline cache, offline capture, or push notifications.
If Chrome offers only a shortcut, refresh the page and check again after deployment.
