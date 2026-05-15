-- Usuwa nieużywane moduły:
--  1. Formularze embed (trip_embed_forms, embed_form_submissions) — zrezygnowano z zapisów z zewnątrz
--  2. Stary system powiadomień (notifications, notification_logs) — zastąpiony przez messages + email_logs
-- Uruchom w Supabase SQL Editor.

DROP TABLE IF EXISTS embed_form_submissions CASCADE;
DROP TABLE IF EXISTS trip_embed_forms CASCADE;

DROP TABLE IF EXISTS notification_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
