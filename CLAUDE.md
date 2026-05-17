# CLAUDE.md

Wskazówki dla Claude przy pracy nad projektem `biegun-sport-app`
(Next.js App Router + Supabase + Vercel).

## Baza danych i migracje

- Migracje to zwykłe pliki `.sql` w `supabase/migrations/`.
- **Nie są uruchamiane automatycznie** — każdą nową migrację użytkownik musi
  ręcznie wykonać na bazie Supabase.
- Po dodaniu kolumny lub tabeli, od której zależy kod (np. nowe pole w
  INSERT/UPDATE), zawsze **wyraźnie ostrzeż użytkownika**, że musi uruchomić
  migrację — inaczej powiązana funkcja przestanie działać do czasu jej wykonania.

## Wdrożenie (Vercel)

- Projekt ma integrację Vercel ↔ GitHub.
- Push dowolnej gałęzi → automatyczny **deployment preview** (nie trzeba
  niczego deployować ręcznie).
- **Produkcja wdrażana jest wyłącznie z gałęzi `main`.**
- Aby zmiany trafiły na produkcję: scal gałąź do `main` przez pull request —
  Vercel sam zbuduje produkcję.
- Jeśli zmiany wymagają migracji bazy — migracja musi być uruchomiona, zanim
  produkcja zostanie zbudowana.
