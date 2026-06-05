ALTER TABLE trip_registration_requests
ADD COLUMN IF NOT EXISTS organizer_notes TEXT;
