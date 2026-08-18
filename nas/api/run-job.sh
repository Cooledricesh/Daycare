#!/bin/sh
set -eu

job=${1:?missing cron job name}
case "$job" in
  health|birthday-report|noon-attendance-report) ;;
  *) printf 'unknown_job=%s\n' "$job" >&2; exit 64 ;;
esac

url="${DAYCARE_APP_URL%/}/api/internal/cron/${job}"
response=$(wget -qO- -T 60 -t 1 \
  --header="Authorization: Bearer ${CRON_SECRET}" \
  --header="Content-Type: application/json" \
  --post-data='{}' \
  "$url")
printf 'job=%s status=ok response=%s\n' "$job" "$response"
