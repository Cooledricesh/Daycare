#!/bin/sh
set -eu

backup=${1:?usage: restore-verify.sh /absolute/path/to/backup.dump}
docker_bin=/var/packages/ContainerManager/target/usr/bin/docker
container=project-postgres
restore_db=daycare_restore_verify

"$docker_bin" exec -i "$container" pg_restore -l < "$backup" >/dev/null
"$docker_bin" exec "$container" dropdb -U platform_admin --if-exists "$restore_db"
"$docker_bin" exec "$container" createdb -U platform_admin "$restore_db"
cleanup() {
  "$docker_bin" exec "$container" dropdb -U platform_admin --if-exists "$restore_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$docker_bin" exec -i "$container" pg_restore \
  -U platform_admin \
  -d "$restore_db" \
  --no-owner \
  --no-privileges < "$backup"

query="SELECT 'staff',count(*) FROM staff
UNION ALL SELECT 'patients',count(*) FROM patients
UNION ALL SELECT 'scheduled_attendances',count(*) FROM scheduled_attendances
UNION ALL SELECT 'attendances',count(*) FROM attendances
UNION ALL SELECT 'consultations',count(*) FROM consultations
UNION ALL SELECT 'messages',count(*) FROM messages
UNION ALL SELECT 'task_completions',count(*) FROM task_completions
ORDER BY 1"

live=$("$docker_bin" exec "$container" psql -U platform_admin -d daycare -Atc "$query")
restored=$("$docker_bin" exec "$container" psql -U platform_admin -d "$restore_db" -Atc "$query")
[ "$live" = "$restored" ]
printf 'restore_verify=ok checked_tables=7\n'
