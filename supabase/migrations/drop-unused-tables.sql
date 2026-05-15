-- Usunięcie nieużywanych tabel
-- notifications, notification_logs, custom_field_definitions nie mają żadnych zapytań w kodzie aplikacji

DROP TABLE IF EXISTS notification_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS custom_field_definitions;
