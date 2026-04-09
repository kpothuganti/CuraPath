import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /checkin/today — returns today's check-in status + questions derived from red_flags
router.get('/today', async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Check if already completed today
    const existing = await pool.query(
      `SELECT * FROM check_ins WHERE user_id = $1 AND date = $2`,
      [req.userId, today]
    );
    if (existing.rows[0]) {
      res.json({ data: { completed: true, check_in: existing.rows[0] } });
      return;
    }

    // Get latest discharge to build questions from red_flags
    const discharge = await pool.query(
      `SELECT id, parsed_json FROM discharges WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );

    if (!discharge.rows[0]) {
      res.status(404).json({ error: 'No discharge record found' });
      return;
    }

    const redFlags: string[] = discharge.rows[0].parsed_json?.red_flags ?? [];
    const questions = redFlags.map((flag: string) => ({
      question: `Have you experienced: ${flag}?`,
      red_flag: flag,
    }));

    res.json({
      data: {
        completed: false,
        discharge_id: discharge.rows[0].id,
        questions,
      },
    });
  } catch (err) {
    console.error('Get today checkin error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /checkin — submit today's check-in responses
// Body: { discharge_id, responses: [{ question, answer: boolean }] }
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { discharge_id, responses } = req.body as {
    discharge_id?: string;
    responses?: Array<{ question: string; answer: boolean }>;
  };

  if (!discharge_id || !Array.isArray(responses)) {
    res.status(400).json({ error: 'discharge_id and responses[] are required' });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const redFlagTriggered = responses.some((r) => r.answer === true);

  try {
    const result = await pool.query(
      `INSERT INTO check_ins (id, user_id, discharge_id, date, responses_json, red_flag_triggered, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, date) DO UPDATE
         SET responses_json = EXCLUDED.responses_json,
             red_flag_triggered = EXCLUDED.red_flag_triggered,
             completed_at = EXCLUDED.completed_at
       RETURNING *`,
      [uuidv4(), req.userId, discharge_id, today, JSON.stringify(responses), redFlagTriggered]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Submit checkin error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
