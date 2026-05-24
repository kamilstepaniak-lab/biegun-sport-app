# Konfiguracja backupu bazy → Google Drive

Workflow `.github/workflows/db-backup.yml` uruchamia się co niedzielę o 03:00 UTC
(≈ 04:00–05:00 czasu polskiego) i wgrywa pełny `pg_dump` z Supabase na Google Drive.

## 1. Connection string Supabase

1. Supabase Dashboard → projekt `biegun-sport-app` → **Project Settings → Database**
2. Sekcja **Connection string** → tryb **URI** (nie pooler — chcemy bezpośrednie połączenie do pg_dump)
3. Skopiuj cały URL: `postgresql://postgres.[ref]:[PASSWORD]@aws-0-...:5432/postgres`
4. Wstaw hasło z menedżera (Supabase nie pokazuje go w UI)

## 2. Service account Google dla Drive

1. <https://console.cloud.google.com/> → nowy projekt (np. `biegunsport-backups`)
2. **APIs & Services → Library** → włącz **Google Drive API**
3. **IAM → Service Accounts → Create Service Account** (np. `drive-backup`)
4. W zakładce **Keys** → **Add Key → JSON** → pobierz plik `.json`
5. Otwórz JSON i skopiuj wartość pola `client_email` (np. `drive-backup@...iam.gserviceaccount.com`)

## 3. Folder na Drive

1. Google Drive → utwórz folder `BS_AI Cowork/backups/db`
2. Kliknij prawym → **Udostępnij** → wklej `client_email` z punktu 2.5 → uprawnienie **Edytor**
3. Skopiuj ID folderu z URL: `drive.google.com/drive/folders/[TO_JEST_ID]`

## 4. GitHub Secrets

Repo GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Nazwa | Wartość |
|---|---|
| `SUPABASE_DB_URL` | connection string z punktu 1 |
| `GCP_SA_KEY` | **cała zawartość** pliku JSON z punktu 2.4 (skopiowana jako tekst) |
| `GDRIVE_FOLDER_ID` | ID folderu z punktu 3 |

## 5. Test ręczny

Repo GitHub → **Actions → „Backup bazy Supabase" → Run workflow → main**

Po ~2–3 min powinien pojawić się plik `biegunsport-backup-YYYY-MM-DDTHH-MM-SSZ.sql.gz`
w folderze Drive. Jeśli błąd — sprawdź logi joba.

## 6. Odtwarzanie z backupu

```bash
# pobierz z Drive
gunzip biegunsport-backup-XXX.sql.gz

# odtwórz na pustej bazie (lub po `DROP SCHEMA public CASCADE`)
psql "$NOWA_BAZA_URL" < biegunsport-backup-XXX.sql
```

Backup zawiera schematy `public`, `auth`, `storage` + pełne dane + RLS + funkcje.

## Retencja

Skrypt automatycznie usuwa najstarsze backupy zostawiając ostatnie **12**
(3 miesiące historii). Zmień `KEEP_LAST` w workflow jeśli chcesz inaczej.
