import pool from './index';

// Runs on every boot. Each statement must be safe to execute repeatedly —
// `IF NOT EXISTS` guards for structural changes, and a fixed cutoff date
// (not "all rows so far") for one-time data backfills, so re-running this
// on a later deploy never re-touches rows it shouldn't.
export async function runMigrations(): Promise<void> {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash   TEXT NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      used        BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Grandfather in every account that existed before email verification
  // shipped, so existing users and test/reviewer accounts aren't locked out.
  // The cutoff is fixed to this feature's deploy time, so later boots never
  // touch accounts created after it.
  await pool.query(`
    UPDATE users SET email_verified = true
    WHERE created_at < '2026-09-27 16:00:00+00' AND email_verified = false;
  `);
}
