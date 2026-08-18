#!/usr/bin/env python3
"""Export, import, and compare complete Daycare PostgREST snapshots."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import requests

TABLES = [
    'staff',
    'patients',
    'holidays',
    'clinic_closures',
    'daily_stats',
    'monthly_reports',
    'streaks_cache',
    'sync_logs',
    'room_coordinator_mapping',
    'room_coordinator_assignments',
    'scheduled_patterns',
    'scheduled_attendances',
    'attendances',
    'vitals',
    'consultations',
    'task_completions',
    'messages',
    'notification_dismissals',
]


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def client(env_file: Path) -> tuple[str, dict[str, str]]:
    # Resolve all endpoint aliases from the explicitly selected file before
    # considering inherited process variables. A shell may carry unrelated
    # DAYCARE_DATA_API_* or SUPABASE_* values from another hospital service.
    file_env = load_env(env_file)
    url = (
        file_env.get('DAYCARE_DATA_API_URL')
        or file_env.get('SUPABASE_URL')
        or file_env.get('NEXT_PUBLIC_SUPABASE_URL')
        or os.environ.get('DAYCARE_DATA_API_URL')
        or os.environ.get('SUPABASE_URL')
        or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
        or ''
    ).rstrip('/')
    key = (
        file_env.get('DAYCARE_DATA_API_KEY')
        or file_env.get('SUPABASE_SERVICE_ROLE_KEY')
        or file_env.get('SUPABASE_SECRET_KEY')
        or os.environ.get('DAYCARE_DATA_API_KEY')
        or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        or os.environ.get('SUPABASE_SECRET_KEY')
        or ''
    )
    if not url or not key:
        raise SystemExit('missing endpoint URL/key')
    return url + '/rest/v1', {'apikey': key, 'Authorization': f'Bearer {key}'}


def canonical(row: dict[str, Any]) -> str:
    return json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def fetch_all(rest: str, headers: dict[str, str], table: str, page_size: int = 500) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        response = requests.get(
            f'{rest}/{table}',
            headers=headers,
            params={'select': '*', 'limit': str(page_size), 'offset': str(offset)},
            timeout=180,
        )
        response.raise_for_status()
        chunk = response.json()
        rows.extend(chunk)
        if len(chunk) < page_size:
            return rows
        offset += page_size


def export_snapshot(env_file: Path, out_dir: Path) -> None:
    rest, headers = client(env_file)
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, Any] = {
        'format': 'daycare-postgrest-snapshot-v1',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'tables': {},
    }
    for table in TABLES:
        rows = fetch_all(rest, headers, table)
        lines = sorted(canonical(row) for row in rows)
        payload = ('\n'.join(lines) + ('\n' if lines else '')).encode('utf-8')
        (out_dir / f'{table}.jsonl').write_bytes(payload)
        manifest['tables'][table] = {
            'rows': len(lines),
            'sha256': hashlib.sha256(payload).hexdigest(),
            'bytes': len(payload),
        }
        print(f'exported {table}: {len(lines)}')
    (out_dir / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + '\n',
        encoding='utf-8',
    )
    print(json.dumps({'ok': True, 'manifest': str(out_dir / 'manifest.json'), 'tables': len(TABLES)}))


def chunks_by_size(
    rows: list[dict[str, Any]],
    max_rows: int = 250,
    max_bytes: int = 4_000_000,
) -> Iterator[list[dict[str, Any]]]:
    chunk: list[dict[str, Any]] = []
    size = 2
    for row in rows:
        row_size = len(canonical(row).encode('utf-8')) + 1
        if chunk and (len(chunk) >= max_rows or size + row_size > max_bytes):
            yield chunk
            chunk, size = [], 2
        chunk.append(row)
        size += row_size
    if chunk:
        yield chunk


def import_snapshot(env_file: Path, snapshot_dir: Path) -> None:
    rest, headers = client(env_file)
    write_headers = {**headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'}
    for table in TABLES:
        rows = [
            json.loads(line)
            for line in (snapshot_dir / f'{table}.jsonl').read_text(encoding='utf-8').splitlines()
            if line
        ]
        if fetch_all(rest, headers, table, page_size=1):
            raise SystemExit(f'target table is not empty: {table}')
        written = 0
        for chunk in chunks_by_size(rows):
            response = requests.post(f'{rest}/{table}', headers=write_headers, json=chunk, timeout=300)
            if not response.ok:
                raise SystemExit(
                    f'import failed: table={table} status={response.status_code} '
                    f'error={response.text[:500]}'
                )
            written += len(chunk)
        print(f'imported {table}: {written}')
    print(json.dumps({'ok': True, 'tables': len(TABLES)}))


def rewrite_avatar_urls(source: Path, out_dir: Path, public_base_url: str) -> None:
    if out_dir.exists():
        shutil.rmtree(out_dir)
    shutil.copytree(source, out_dir)
    patients_path = out_dir / 'patients.jsonl'
    rows = [json.loads(line) for line in patients_path.read_text(encoding='utf-8').splitlines() if line]
    changed = 0
    base = public_base_url.rstrip('/')
    for row in rows:
        if row.get('avatar_url'):
            row['avatar_url'] = (
                f'{base}/storage/v1/object/public/patient-avatars/'
                f'{row["id"]}.webp'
            )
            changed += 1
    lines = sorted(canonical(row) for row in rows)
    patients_path.write_text('\n'.join(lines) + ('\n' if lines else ''), encoding='utf-8')

    manifest = json.loads((out_dir / 'manifest.json').read_text(encoding='utf-8'))
    manifest['format'] = 'daycare-postgrest-snapshot-v1-avatar-rewritten'
    manifest['created_at'] = datetime.now(timezone.utc).isoformat()
    for table in TABLES:
        payload = (out_dir / f'{table}.jsonl').read_bytes()
        manifest['tables'][table] = {
            'rows': len(payload.splitlines()),
            'sha256': hashlib.sha256(payload).hexdigest(),
            'bytes': len(payload),
        }
    (out_dir / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + '\n',
        encoding='utf-8',
    )
    print(json.dumps({'ok': True, 'avatar_urls_rewritten': changed, 'out': str(out_dir)}))


def compare(left: Path, right: Path) -> None:
    source = json.loads((left / 'manifest.json').read_text(encoding='utf-8'))
    target = json.loads((right / 'manifest.json').read_text(encoding='utf-8'))
    differences = []
    for table in TABLES:
        a = source['tables'].get(table)
        b = target['tables'].get(table)
        if a != b:
            differences.append({'table': table, 'source': a, 'target': b})
    print(json.dumps({'ok': not differences, 'differences': differences}, ensure_ascii=False, indent=2))
    if differences:
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    exp = sub.add_parser('export')
    exp.add_argument('--env-file', type=Path, required=True)
    exp.add_argument('--out', type=Path, required=True)
    imp = sub.add_parser('import')
    imp.add_argument('--env-file', type=Path, required=True)
    imp.add_argument('--snapshot', type=Path, required=True)
    rewrite = sub.add_parser('rewrite-avatar-urls')
    rewrite.add_argument('--source', type=Path, required=True)
    rewrite.add_argument('--out', type=Path, required=True)
    rewrite.add_argument('--public-base-url', required=True)
    cmp = sub.add_parser('compare')
    cmp.add_argument('--source', type=Path, required=True)
    cmp.add_argument('--target', type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'export':
        export_snapshot(args.env_file, args.out)
    elif args.command == 'import':
        import_snapshot(args.env_file, args.snapshot)
    elif args.command == 'rewrite-avatar-urls':
        rewrite_avatar_urls(args.source, args.out, args.public_base_url)
    else:
        compare(args.source, args.target)


if __name__ == '__main__':
    main()
