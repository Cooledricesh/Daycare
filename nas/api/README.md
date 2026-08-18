# Daycare NAS API

Supabase-compatible database and patient-avatar gateway for the Daycare application.

- NAS root: `/volume1/docker/daycare-api`
- API bind: `127.0.0.1:19287`
- PostgREST bind: `127.0.0.1:19288`
- Database: `daycare`
- Runtime role: `daycare_app` (DML only, UTC timezone)
- Primary public ingress: `https://daycare-api.rebridge.work`
- Scheduler: `daycare-scheduler` (`scheduler.crontab`, UTC)

Contracts:

- `/rest/v1/*`: server-only Supabase/PostgREST compatibility endpoint; requires the Daycare `apikey` and rejects browser-Origin requests.
- `/storage/v1/object/patient-avatars/*`: authenticated `PUT`/`DELETE` for Vercel server-side avatar operations.
- `/storage/v1/object/public/patient-avatars/*`: public `GET` for the avatar URLs stored in `patients.avatar_url`.
- `/health`: performs a live PostgREST/database subrequest and returns only `{"ok":true}`.

Rendered `nginx.conf`, `postgrest.env`, `service.env`, and `scheduler.env` are NAS-local protected files and must not be committed. The scheduler calls `https://dddaycare.vercel.app/api/internal/cron/*`; run `docker exec daycare-scheduler /opt/daycare/run-job.sh health` for a no-notification connectivity and database check.
