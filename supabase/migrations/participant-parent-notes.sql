-- Notatki rodzica o dziecku (widoczne dla admina, niewidoczne dla innych rodziców)
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS parent_notes_health        TEXT,
  ADD COLUMN IF NOT EXISTS parent_notes_food          TEXT,
  ADD COLUMN IF NOT EXISTS parent_notes_accommodation TEXT,
  ADD COLUMN IF NOT EXISTS parent_notes_additional    TEXT;
