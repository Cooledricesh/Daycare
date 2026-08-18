from datetime import datetime
from pathlib import Path

path = Path('/volume1/docker/stacks/cloudflared/config/config.yml')
text = path.read_text()
if 'hostname: daycare-api.rebridge.work' in text:
    print('ingress=already_present')
else:
    marker = '  - service: http_status:404\n'
    rule = (
        '  - hostname: daycare-api.rebridge.work\n'
        '    service: http://127.0.0.1:19287\n'
        '    originRequest:\n'
        '      connectTimeout: 5s\n'
        '      noHappyEyeballs: true\n'
    )
    if text.count(marker) != 1:
        raise SystemExit('catch-all marker missing or ambiguous')
    backup = path.with_name(f'config.yml.bak-{datetime.now().strftime("%Y%m%d-%H%M%S")}-daycare')
    backup.write_text(text)
    path.write_text(text.replace(marker, rule + marker))
    print(f'ingress=added backup={backup.name}')
