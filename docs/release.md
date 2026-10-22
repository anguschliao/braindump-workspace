# Release gates

This is a local MVP, not a verified production deployment. No paid API calls are authorized by implementation alone.

- Confirm hosting provider, database region, recurring budget, backup/retention policy and approved deployment destination.
- Run migrations on a new staging database; never apply these blindly to an existing schema. Run real Supabase two-member and outsider tests in addition to local PostgreSQL tests.
- Confirm email authentication and password reset policy. The MVP includes sign-in/sign-out with operator-provisioned accounts; disable public signup and verify both accounts are members of the same business workspace; password recovery must be configured before production.
- Choose a supported structured-output model, enable explicit API billing limit, then test extraction refusal, outages, ambiguous dates and DST transitions. Ten daily attempts per user (up to twenty for the business) is an application quota, not a guaranteed monetary cap.
- MCP stays disabled until OAuth issuer emits the canonical resource audience, account supports connecting the server, and authorization-code+PKCE and revocation tests pass. Use provider-managed consent; never build a password-collecting OAuth proxy or paste browser tokens into ChatGPT.
- Native user explicitly grants the registered OAuth client read access to the shared business content in the app. Consent must explain that this includes the other member’s contributions. Revoking this grant blocks RLS reads even for unexpired tokens.
- Add edge/IP rate limits and operational monitoring before public exposure. Validate Origin/Host at your reverse proxy. No wildcard credentialed CORS.
- Run mobile UI QA, real auth and persistence tests, and PostgreSQL backup/restore before calling this production-ready.
