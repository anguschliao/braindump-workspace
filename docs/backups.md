# Workspace exports and recovery

In Settings, select **Download workspace data**. Pause editing on both devices while
exporting; the download reads all pages but is not a single database snapshot.
It includes archived content, author IDs, assignments, tags and reviewed suggestions.
Search text and the UI's first-100-record limit do not restrict the export.

Save all local backups and generated recovery SQL in the project backup/ folder: C:UsersAngooseOneDriveDocumentsProjectsraindump-workspaceackup. This folder is excluded from Git. Browser downloads must be saved or moved there manually; Android cannot directly write to this Windows folder. Confirm the JSON file
saved successfully. Download weekly and before substantial changes. This is manual:
no background backup schedule is enabled. No passwords, sessions, OAuth grants,
auth accounts, or rate-limit counters are included.

## Recover missing content

Use Node.js 24 with a saved export:
    node scripts/prepare-recovery.mjs PATH_TO_BACKUP.json PATH_TO_NEW_RECOVERY.sql

The command only prepares a SQL file, never connects to a database, and refuses to
overwrite an existing file. Keep this generated file private too. Review it before
running it through the Supabase SQL editor as an operator.

First test on a separate compatible database with migrations 001 and 002 and the
same auth user IDs. The SQL runs in one transaction, retains original record IDs,
authorship and relationships, and only inserts missing rows. Existing rows win.
Any foreign-key, uniqueness or validation failure rolls the transaction back.
It does not undo edits or unarchive an existing row. Do not use it as an overwrite
restore, and do not disable constraints to force it through.

For a new Supabase project, auth users and their original IDs must be restored
separately before this content can be restored. Recreating accounts with new IDs
requires an explicit reviewed mapping. Never silently reassign authorship.
Do not replay OAuth grants or sessions from old backups.

## Full disaster recovery

A content export is not a full database backup. Supabase documents an operator
backup workflow that saves roles, schema and data with its CLI and restores into
a separate project:
https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

Full database backups and an actual Supabase restore drill are not configured yet.
They require database access and backup tooling; never commit database credentials.
The app and this repository do not contain a database password or service-role key.
Before calling disaster recovery ready, verify restored content counts, both users'
access, author/assignee relationships and RLS isolation in the separate project.

