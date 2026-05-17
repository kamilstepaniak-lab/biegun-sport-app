-- Usuwa nieużywaną tabelę bufora importu wyjazdów.
-- Import wyjazdów działa teraz przez upload pliku CSV w aplikacji,
-- a nie przez tę tabelę pośredniczącą.
DROP TABLE IF EXISTS trips_import_buffer;
