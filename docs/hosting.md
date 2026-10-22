# Sotaria hosting preparation

Prepared 2026-10-21. Nothing has been uploaded or deployed by this preparation.

## Proposed destination

Netlify Free, using its Next.js adapter and a provider-assigned HTTPS subdomain. Keep the existing Supabase project jjwrruizyyujhnynlvqd in Canada (Central). Do not create another database or rerun migrations.

Netlify permits commercial projects on Free. Current Free pricing is $0/month with 300 monthly credits and a hard limit, without automatic recharge. This is a small-business pilot, not a promise of uninterrupted uptime. Confirm current pricing and available account features when creating the project. Do not enable paid add-ons, custom domain purchases, AI Gateway, or plan upgrades without approval. The two app users do not need Netlify developer seats.

Vercel Hobby is limited to non-commercial use and is not the proposed plan for this business app.

## Source boundary

IMPORTANT: git rev-parse currently reports C:/Users/Angoose/OneDrive/Documents/Projects as the Git root. Do not publish that parent repository or run git add . from it. Other projects are outside this deployment.

Use a local CLI deployment explicitly scoped to braindump-workspace, or first prepare a separate private repository containing only this app. Do not assume private-repository integration is included in the Free plan; verify account eligibility before selecting a Git workflow. No Git remotes, repositories, or commits were created in this preparation.

Never upload .env.local, node_modules, .pnpm-store, .test-build, or raw database exports. Build with the framework adapter; a static folder upload would omit API routes. Keep generated .netlify output out of Git.

## Production environment

Configure these through Netlify's project environment UI, available to both builds and server functions:

| Variable | Value |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | https://jjwrruizyyujhnynlvqd.supabase.co |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Copy the existing publishable key from local configuration or Supabase dashboard |
| APP_ORIGIN | Exact assigned HTTPS origin, without a trailing slash |
| AI_ENABLED | false |
| MCP_ENABLED | false |

Leave OPENAI_API_KEY, OPENAI_MODEL and MCP_RESOURCE unset for this phase. Never provide a service-role key, Supabase database password, or user passwords to the hosting build. NEXT_PUBLIC variables are intentionally visible in browser assets; rebuild after changing them.

Use only the final production origin for APP_ORIGIN. Do not wildcard it or substitute localhost. Preview deployments must not receive production database configuration by default. A separate approved staging database is needed for preview testing.

## Approval and release sequence

1. User signs into Netlify and selects Free. Create/prepare the hosting project without publishing code. Verify account plan, site name, assigned URL, adapter support for locked Next.js 16.4.2, and the final configuration.
2. Verify Supabase public signup remains disabled, ES256 signing is active, and Angus/Churmy are the only intended members. Live login and sharing were confirmed by the user locally; hosted checks are still pending.
3. Resolve the production password-recovery flow and email delivery before treating this as a production-ready service. The app currently has operator-created password accounts and no password-reset UI. Do not send invitation/recovery links to localhost for another device. Configure Supabase Site URL and allowed redirects to the final HTTPS origin when ready; keep redirects exact.
4. Review provider rate-limit controls, usage notifications, and database backup/export and restore procedures. These release gates are not yet verified. Supabase's database region does not guarantee the host's server execution region or end-to-end Canadian data residency.
5. Run the framework build and adapter validation. Obtain user approval for the named URL and $0 plan before any preview or production upload. A preview upload is still an external deployment.
6. Deploy only this app with AI/MCP disabled. Verify HTTPS and security headers; anonymous workspace requests must be rejected. Test login as each member, capture, reload/persistence, shared edits, attribution, and calendar timezone from two devices. Verify a nonmember cannot read business data.
7. Record the deployment URL, version and verification results. Rolling back the web deployment does not roll back the database; do not reset or delete the live schema.

## Sources checked

- https://www.netlify.com/blog/introducing-netlify-free-plan/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- https://vercel.com/docs/plans/hobby

## Verification boundary

Existing local type checks, eight automated tests and production build passed before this preparation. New hosting configuration has not yet been exercised by Netlify's adapter. No hosting account was created, no cloud environment settings were changed, and no deployment was made.

## Netlify account setup completed

The Sotaria team (angus-liao) is verified on Free with 300 credits and no payment method. Empty project sotaria-workspace was created and linked locally: 407b5254-c091-4283-951e-5fcfb2431be6. Assigned URL: https://sotaria-workspace.netlify.app. No deploy has been uploaded.

Production-only environment variables are configured: the existing public Supabase URL/key, APP_ORIGIN matching the assigned URL, AI_ENABLED=false and MCP_ENABLED=false. No private keys or passwords were uploaded.

Local Next.js compilation and TypeScript passed through Netlify Runtime 5.16.3. Adapter packaging failed on Windows with EPERM creating a symlink. This is not a successful Netlify build. Before deployment, complete packaging on a supported build environment; a cloud build/upload still needs user approval. Do not change Windows security settings automatically. The incomplete dependency folder was preserved as node_modules.hosting-backup (ignored); a clean locked install restored the app dependencies.

The direct Next.js build command in netlify.toml avoids a local package-manager reinstall side effect. CLI execution used pnpm --package=npm --package=netlify-cli dlx netlify build --context production. Production build environment injection and hosted runtime behavior still require verification. Earlier preparation-only statements describe the earlier state; this section records the subsequent account setup.
