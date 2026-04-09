import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /medications — all meds for current discharge
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT m.*
       FROM medications m
       JOIN discharges d ON d.id = m.discharge_id
       WHERE d.user_id = $1
       ORDER BY d.created_at DESC, m.name`,
      [req.userId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get medications error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /medications/:id/log — log taken or skipped
// Body: { scheduled_time: ISO string, action: 'taken' | 'skipped' }
router.post('/:id/log', async (req: AuthRequest, res: Response): Promise<void> => {
  const { scheduled_time, action } = req.body as {
    scheduled_time?: string;
    action?: 'taken' | 'skipped';
  };

  if (!scheduled_time || !action || !['taken', 'skipped'].includes(action)) {
    res.status(400).json({ error: 'scheduled_time and action (taken|skipped) are required' });
    return;
  }

  const medicationId = req.params.id;

  try {
    // Verify the medication belongs to this user
    const ownership = await pool.query(
      `SELECT m.id FROM medications m
       JOIN discharges d ON d.id = m.discharge_id
       WHERE m.id = $1 AND d.user_id = $2`,
      [medicationId, req.userId]
    );

    if (!ownership.rows[0]) {
      res.status(404).json({ error: 'Medication not found' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO medication_logs (id, medication_id, user_id, scheduled_time, taken_at, skipped)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (medication_id, scheduled_time) DO UPDATE
         SET taken_at = EXCLUDED.taken_at,
             skipped  = EXCLUDED.skipped
       RETURNING *`,
      [
        uuidv4(),
        medicationId,
        req.userId,
        scheduled_time,
        action === 'taken' ? new Date().toISOString() : null,
        action === 'skipped',
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Log medication error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /medications/logs — adherence history
router.get('/logs', async (req: AuthRequest, res: Response): Promise<void> => {
  const { days = '30' } = req.query as { days?: string };

  try {
    const result = await pool.query(
      `SELECT ml.*, m.name AS medication_name, m.dose
       FROM medication_logs ml
       JOIN medications m ON m.id = ml.medication_id
       WHERE ml.user_id = $1
         AND ml.scheduled_time >= NOW() - ($2 || ' days')::INTERVAL
       ORDER BY ml.scheduled_time DESC`,
      [req.userId, parseInt(days, 10)]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get logs error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
