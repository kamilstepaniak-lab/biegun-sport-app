-- Dodaje pola z listą rzeczy do zabrania i dodatkowymi informacjami do wyjazdu
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS packing_list text,
  ADD COLUMN IF NOT EXISTS additional_info text;
