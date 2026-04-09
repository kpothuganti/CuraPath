-- Discharge app schema
-- Run against a PostgreSQL database (RDS in prod, local for dev)
-- All tables use UUID primary keys; encryption at rest handled at the RDS level

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,             -- bcrypt; swap for Cognito sub in prod
  timezone    TEXT NOT NULL DEFAULT 'America/New_York',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Discharges ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discharges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_input_type    TEXT NOT NULL CHECK (raw_input_type IN ('photo', 'pdf', 'fhir')),
  raw_input_url     TEXT,                  -- S3 key (never a public URL)
  parsed_json       JSONB NOT NULL,
  discharge_date    DATE,
  provider_phone    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discharges_user_id_idx ON discharges(user_id);

-- ─── Medications (denormalized from parsed_json for query performance) ────────
CREATE TABLE IF NOT EXISTS medications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discharge_id   UUID NOT NULL REFERENCES discharges(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  dose           TEXT,
  frequency      TEXT,
  times          TEXT[] NOT NULL DEFAULT '{}',
  instructions   TEXT
);

CREATE INDEX IF NOT EXISTS medications_discharge_id_idx ON medications(discharge_id);

-- ─── Daily check-ins ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS check_ins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discharge_id        UUID NOT NULL REFERENCES discharges(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  responses_json      JSONB NOT NULL DEFAULT '[]',
  red_flag_triggered  BOOLEAN NOT NULL DEFAULT false,
  completed_at        TIMESTAMPTZ,
  UNIQUE (user_id, date)
);

-- ─── Medication adherence log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id   UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_time  TIMESTAMPTZ NOT NULL,
  taken_at        TIMESTAMPTZ,
  skipped         BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (medication_id, scheduled_time)
);

CREATE INDEX IF NOT EXISTS med_logs_user_id_idx ON medication_logs(user_id);
CREATE INDEX IF NOT EXISTS med_logs_medication_id_idx ON medication_logs(medication_id);

-- ─── Refresh tokens ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,        -- SHA-256 hash; never store raw
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
