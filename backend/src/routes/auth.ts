import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

function hashPassword(password: string): string {
  // TODO: replace with bcrypt before production
  return createHash('sha256').update(password + process.env.JWT_SECRET).digest('hex');
}

function signAccess(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRY ?? '1h') as jwt.SignOptions['expiresIn'],
  });
}

function signRefresh(): string {
  return randomBytes(64).toString('hex');
}

// POST /auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, timezone } = req.body as {
    email?: string;
    password?: string;
    timezone?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, timezone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, timezone, created_at`,
      [uuidv4(), email.toLowerCase(), hashPassword(password), timezone ?? 'America/New_York']
    );

    const user = result.rows[0];
    const accessToken = signAccess(user.id);
    const refreshToken = signRefresh();

    await pool.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
      [uuidv4(), user.id, createHash('sha256').update(refreshToken).digest('hex')]
    );

    res.status(201).json({ data: { user, accessToken, refreshToken } });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    console.error('Register error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, email, timezone, created_at, password_hash FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user || user.password_hash !== hashPassword(password)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = signAccess(user.id);
    const refreshToken = signRefresh();

    await pool.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
      [uuidv4(), user.id, createHash('sha256').update(refreshToken).digest('hex')]
    );

    const { password_hash: _, ...userPublic } = user;
    res.json({ data: { user: userPublic, accessToken, refreshToken } });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }

  const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

  try {
    const result = await pool.query(
      `SELECT user_id FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );

    if (!result.rows[0]) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const { user_id } = result.rows[0];

    // Rotate refresh token
    await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
    const newRefreshToken = signRefresh();
    await pool.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
      [uuidv4(), user_id, createHash('sha256').update(newRefreshToken).digest('hex')]
    );

    res.json({
      data: {
        accessToken: signAccess(user_id),
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    console.error('Refresh error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /auth/account
router.delete('/account', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1`, [req.userId]);
    res.json({ data: { deleted: true } });
  } catch (err) {
    console.error('Delete account error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
