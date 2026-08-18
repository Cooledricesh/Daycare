#!/usr/bin/env python3
"""Copy and verify the Daycare patient-avatars bucket through HTTP APIs."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import quote

import requests

BUCKET = 'patient-avatars'
USER_AGENT = 'daycare-migration/1.0'


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def source_config(path: Path) -> tuple[str, str]:
    env = load_env(path)
    url = (env.get('SUPABASE_URL') or env.get('NEXT_PUBLIC_SUPABASE_URL') or '').rstrip('/')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY') or ''
    if not url or not key:
        raise SystemExit('missing source Storage URL/key')
    return url, key


def target_config(path: Path) -> tuple[str, str]:
    env = load_env(path)
    url = (env.get('DAYCARE_AVATAR_API_URL') or env.get('DAYCARE_DATA_API_URL') or '').rstrip('/')
    key = env.get('DAYCARE_AVATAR_API_KEY') or env.get('DAYCARE_DATA_API_KEY') or ''
    if not url or not key:
        raise SystemExit('missing target avatar URL/key')
    return url, key


def list_objects(session: requests.Session, base: str, key: str) -> list[dict]:
    objects: list[dict] = []
    offset = 0
    while True:
        response = session.post(
            f'{base}/storage/v1/object/list/{BUCKET}',
            headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
            json={'prefix': '', 'limit': 100, 'offset': offset, 'sortBy': {'column': 'name', 'order': 'asc'}},
            timeout=60,
        )
        response.raise_for_status()
        chunk = response.json()
        objects.extend(obj for obj in chunk if obj.get('id') and obj.get('name'))
        if len(chunk) < 100:
            return objects
        offset += 100


def object_url(base: str, kind: str, name: str) -> str:
    encoded = '/'.join(quote(part, safe='') for part in name.split('/'))
    return f'{base}/storage/v1/object/{kind}/{BUCKET}/{encoded}' if kind else f'{base}/storage/v1/object/{BUCKET}/{encoded}'


def copy_objects(source_env: Path, target_env: Path, manifest_path: Path) -> None:
    source_base, source_key = source_config(source_env)
    target_base, target_key = target_config(target_env)
    session = requests.Session()
    session.headers.update({'User-Agent': USER_AGENT})
    objects = list_objects(session, source_base, source_key)
    manifest: list[dict] = []
    for index, obj in enumerate(objects, 1):
        name = obj['name']
        source = session.get(
            object_url(source_base, '', name),
            headers={'apikey': source_key, 'Authorization': f'Bearer {source_key}'},
            timeout=60,
        )
        source.raise_for_status()
        body = source.content
        content_type = (obj.get('metadata') or {}).get('mimetype') or source.headers.get('Content-Type') or 'application/octet-stream'
        uploaded = session.put(
            object_url(target_base, '', name),
            headers={'apikey': target_key, 'Content-Type': content_type},
            data=body,
            timeout=60,
        )
        uploaded.raise_for_status()
        copied = session.get(object_url(target_base, 'public', name), timeout=60)
        copied.raise_for_status()
        source_hash = hashlib.sha256(body).hexdigest()
        target_hash = hashlib.sha256(copied.content).hexdigest()
        if source_hash != target_hash:
            raise SystemExit(f'object hash mismatch at item {index}')
        manifest.append({
            'name': name,
            'bytes': len(body),
            'sha256': source_hash,
            'content_type': content_type,
        })
        if index % 50 == 0 or index == len(objects):
            print(f'copied {index}/{len(objects)}')
    manifest.sort(key=lambda item: item['name'])
    payload = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    summary = {
        'bucket': BUCKET,
        'objects': len(manifest),
        'bytes': sum(item['bytes'] for item in manifest),
        'manifest_sha256': hashlib.sha256(payload).hexdigest(),
        'items': manifest,
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: summary[key] for key in ('bucket', 'objects', 'bytes', 'manifest_sha256')}))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-env', type=Path, required=True)
    parser.add_argument('--target-env', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    args = parser.parse_args()
    copy_objects(args.source_env, args.target_env, args.manifest)


if __name__ == '__main__':
    main()
