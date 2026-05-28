-- Grupa "Bez kategorii" — dla dzieci nieprzypisanych do żadnej grupy treningowej
-- (np. zewnętrzne zapisy na jednorazowe eventy).
-- Migracja: tworzy grupę i przypisuje do niej wszystkich uczestników bez grupy.

INSERT INTO groups (name, description, display_order, is_selectable_by_parent)
SELECT
  'Bez kategorii',
  'Dzieci nieprzypisane do stałej grupy treningowej (np. jednorazowe zapisy na obozy / eventy).',
  9999,
  false
WHERE NOT EXISTS (SELECT 1 FROM groups WHERE name = 'Bez kategorii');

-- Backfill: każdy uczestnik bez wpisu w participant_groups trafia do "Bez kategorii".
INSERT INTO participant_groups (participant_id, group_id, assigned_at)
SELECT p.id, g.id, NOW()
FROM participants p
CROSS JOIN groups g
LEFT JOIN participant_groups pg ON pg.participant_id = p.id
WHERE g.name = 'Bez kategorii'
  AND pg.id IS NULL;
