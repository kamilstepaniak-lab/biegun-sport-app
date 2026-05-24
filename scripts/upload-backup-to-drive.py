#!/usr/bin/env python3
"""
Upload pg_dump backup do Google Drive + rotacja starych plików.

Env:
- GCP_SA_KEY: JSON klucza service accountu (jako string)
- GDRIVE_FOLDER_ID: ID folderu na Drive
- BACKUP_FILE: ścieżka do pliku backupu (np. biegunsport-backup-...sql.gz)
- KEEP_LAST: ile ostatnich backupów zostawić (domyślnie 12)
"""

import json
import os
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ['https://www.googleapis.com/auth/drive.file']

FILE_PREFIX = 'biegunsport-backup-'


def main() -> int:
    sa_key_raw = os.environ['GCP_SA_KEY']
    folder_id = os.environ['GDRIVE_FOLDER_ID']
    backup_file = os.environ['BACKUP_FILE']
    keep_last = int(os.environ.get('KEEP_LAST', '12'))

    if not os.path.exists(backup_file):
        print(f'BŁĄD: plik {backup_file} nie istnieje', file=sys.stderr)
        return 1

    creds = service_account.Credentials.from_service_account_info(
        json.loads(sa_key_raw),
        scopes=SCOPES,
    )
    drive = build('drive', 'v3', credentials=creds, cache_discovery=False)

    # Upload
    file_size = os.path.getsize(backup_file)
    print(f'Uploaduje {backup_file} ({file_size / 1024 / 1024:.2f} MB) do folderu {folder_id}...')

    media = MediaFileUpload(
        backup_file,
        mimetype='application/gzip',
        resumable=True,
    )
    metadata = {
        'name': os.path.basename(backup_file),
        'parents': [folder_id],
    }
    uploaded = drive.files().create(
        body=metadata,
        media_body=media,
        fields='id, name, size',
        supportsAllDrives=True,
    ).execute()
    print(f'OK: id={uploaded["id"]}, name={uploaded["name"]}, size={uploaded.get("size", "?")}')

    # Rotacja — usuwaj najstarsze backupy poza limitem KEEP_LAST
    print(f'\nSprawdzam rotację (zostawiam ostatnie {keep_last})...')
    query = (
        f"'{folder_id}' in parents "
        f"and name contains '{FILE_PREFIX}' "
        f'and trashed = false'
    )
    result = drive.files().list(
        q=query,
        fields='files(id, name, createdTime)',
        orderBy='createdTime desc',
        pageSize=200,
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
    ).execute()
    files = result.get('files', [])
    print(f'Znaleziono {len(files)} backupów w folderze.')

    to_delete = files[keep_last:]
    for f in to_delete:
        print(f'Usuwam stary backup: {f["name"]} ({f["createdTime"]})')
        drive.files().delete(fileId=f['id'], supportsAllDrives=True).execute()

    print(f'\nZakończono. Backupów aktywnych: {min(len(files), keep_last)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
