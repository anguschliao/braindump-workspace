# Automatic AI suggestions

Status: prepared; migration 003 and production credentials are required before enabling.
Use OPENAI_MODEL=gpt-5.6-luna, AI_ENABLED=true and an OPENAI_API_KEY belonging only
to this app. Never put the key in a NEXT_PUBLIC variable or in source control.
Keep AI_ENABLED=false until migration 003 and live model tests have passed.

Each capture saves its thought first, then awaits one classification request.
Refreshing never calls AI. The existing Suggest button can process a previously
unattempted note or display its saved suggestions. It does not generate again.
No backfill runs automatically for thoughts captured with AI disabled.

Classification selects the best category per intent, not all three. It may return
nothing. Separate intents can produce up to five suggestions. An event with unknown
times stays an event draft; the review editor requires valid times before saving.
No suggestion becomes a board item, task or calendar entry without human acceptance.

## Cost boundary

Migration 003 reserves a conservative maximum before each request in a PostgreSQL
transaction. Both members share US$5 per UTC calendar month across this database.
It locks the monthly row and claims each thought once; client-side refreshes and
duplicate calls cannot repeat a provider request. The ten-per-day limit is unused.

GPT-5.6 Luna standard price verified 2026-10-21:
https://developers.openai.com/api/docs/models/gpt-5.6-luna
Input US$0.20/M, cache-write input US$0.25/M, output US$1.20/M.
Reserve ceil((UTF-8 bytes of JSON-encoded note + 10000)*0.25 + 3600)
microdollars. One byte per input token is conservative; the allowance covers fixed
prompt/schema/metadata. Runtime rejects fixed serialized input over 9000 bytes.
Output is capped at 3000 tokens, retries disabled, service tier default, reasoning none.
Model changes fail closed and require repricing. Recheck prices before activation.

Reservations are not actual charges: unused amounts are never released, even after
failure/timeout. This may stop AI early. It avoids trusting client-reported costs
and avoids refunding calls whose provider outcome is uncertain. No calls start in
the final minute of a UTC month. This covers this application's API traffic only,
not unrelated API-key usage, taxes, currency conversion or future price increases.
Use a dedicated key/project and keep provider billing alerts enabled too.

## Failure behavior and verification

Capture survives unavailable credentials, missing migration, provider errors and
budget exhaustion. An attempt that times out or cannot save its response is not
automatically retried; manual organization remains available. Do not delete or
reset budget/attempt rows in production. Exports intentionally omit these ledgers;
a disaster-recovery restore must keep AI disabled until budget state is reconciled.

Automated PostgreSQL tests cover shared reservations, deduplication, >10 daily
requests, cross-workspace/OAuth rejection, direct-write denial and budget exhaustion.
Before activation, test actual model responses for a task, a precisely scheduled
event, an idea, a reference note, a mixed-intent note, and an event missing its end.
Review all outputs. Quality and provider compatibility need a real API key.
