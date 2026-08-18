# Daycare NAS deployment

This directory contains the reproducible NAS-side parts of the Supabase-to-PostgreSQL migration.

## Schema

Apply the existing `supabase/migrations/*.sql` in order with these NAS adjustments:

- Use `nas/migrations/20260408000001_add_patient_avatar.sql` instead of the Supabase Storage policy migration.
- Skip `20260414000001_patient_birth_dates_batch.sql` and `20260414000002_patient_birth_dates_batch_v2.sql` when a complete production snapshot will be imported; they contain historical data corrections rather than schema.
- Use `nas/migrations/20260424000001_create_monthly_reports.sql` because `dbctl migrate` owns the transaction and rejects nested `BEGIN`/`COMMIT`.

The final production snapshot is imported only after every migration succeeds.

## Services

`nas/api` runs:

- PostgREST on `127.0.0.1:19288`
- authenticated database and avatar gateway on `127.0.0.1:19287`
- public avatar reads under `/storage/v1/object/public/patient-avatars/`

The gateway is published as `https://daycare-api.rebridge.work` by the existing outbound Cloudflare Tunnel. PostgreSQL itself is not published.

## Migration tools

- `nas/scripts/daycare_snapshot.py`: complete table export, import, canonical compare, and deterministic avatar-URL rewrite.
- `nas/scripts/daycare_storage_migrate.py`: copy and hash-verify the `patient-avatars` bucket.

Credential files remain on the NAS or in the task workspace `tmp/`; they are not stored in Git.
