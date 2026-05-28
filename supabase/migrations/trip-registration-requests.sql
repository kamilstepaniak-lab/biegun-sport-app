-- Kolejka zgloszen z formularza WordPress. Admin moderuje w /admin/registrations.
-- Insert: tylko service role (z publicznego endpointu). Select/Update: tylko admin.

CREATE TABLE IF NOT EXISTS trip_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  child_first_name TEXT NOT NULL,
  child_last_name  TEXT NOT NULL,
  child_birth_date DATE NOT NULL,
  child_height_cm  INT,

  parent_email TEXT NOT NULL,
  parent_phone TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  rejection_reason TEXT,
  admin_note TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),

  created_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  raw_payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_trr_status_submitted
  ON trip_registration_requests (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_trr_trip
  ON trip_registration_requests (trip_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trr_pending_dedup
  ON trip_registration_requests (
    trip_id,
    lower(parent_email),
    lower(child_first_name),
    lower(child_last_name),
    child_birth_date
  )
  WHERE status = 'pending';

ALTER TABLE trip_registration_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trr_admin_select ON trip_registration_requests;
CREATE POLICY trr_admin_select ON trip_registration_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS trr_admin_update ON trip_registration_requests;
CREATE POLICY trr_admin_update ON trip_registration_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE trip_registration_requests IS
  'Kolejka zgloszen z formularza WP. Po approve: tworzony participant + trip_registration. Service role insertuje z /api/public/trip-registrations.';
