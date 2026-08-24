from pathlib import Path
from urllib.parse import quote
import os
import secrets

root = Path('/volume1/docker/daycare-api')
creds = {}
for line in Path('/volume1/docker/postgres-platform/credentials/daycare.env').read_text().splitlines():
    if '=' in line:
        key, value = line.split('=', 1)
        creds[key] = value

service = root / 'service.env'
if service.exists():
    values = dict(line.split('=', 1) for line in service.read_text().splitlines() if '=' in line)
    api_key = values['DAYCARE_API_KEY']
    apps_script_key = values.get('DAYCARE_APPS_SCRIPT_KEY', api_key)
else:
    api_key = secrets.token_urlsafe(48)
    apps_script_key = api_key
    service.write_text(
        f'DAYCARE_API_KEY={api_key}\n'
        f'DAYCARE_APPS_SCRIPT_KEY={apps_script_key}\n'
        'DAYCARE_API_URL=https://daycare-api.rebridge.work\n'
    )

db_uri = (
    'postgres://'
    + quote(creds['DB_USER'], safe='')
    + ':'
    + quote(creds['DB_PASSWORD'], safe='')
    + '@127.0.0.1:'
    + creds['DB_PORT']
    + '/'
    + creds['DB_NAME']
)
(root / 'postgrest.env').write_text(f'PGRST_DB_URI={db_uri}\n')
template = (root / 'nginx.conf.template').read_text()
(root / 'nginx.conf').write_text(
    template
    .replace('__DAYCARE_API_KEY__', api_key)
    .replace('__DAYCARE_APPS_SCRIPT_KEY__', apps_script_key)
)
for path in [service, root / 'postgrest.env', root / 'nginx.conf', root / 'compose.yaml', root / 'nginx.conf.template']:
    os.chmod(path, 0o600)
os.chown(root / 'storage/patient-avatars', 101, 101)
print('rendered=ok')
