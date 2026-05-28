-- Dodaje kategorię wyjazdu: 'summer_camp' (obóz letni), 'winter_camp' (obóz zimowy, domyślny), 'family_camp' (obóz rodzinny)
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'winter_camp';
