import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { parseDischargeInstructions } from '../services/claude';

const router = Router();

// All discharge routes require auth
router.use(requireAuth);

// POST /discharge
// Body: { type: 'photo' | 'pdf', base64?: string, mediaType?: string, text?: string,
//         discharge_date?: string, provider_phone?: string }
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, base64, mediaType, text, discharge_date, provider_phone } = req.body as {
    type?: string;
    base64?: string;
    mediaType?: string;
    text?: string;
    discharge_date?: string;
    provider_phone?: string;
  };

  if (!type || (type === 'photo' && !base64) || (type === 'pdf' && !text)) {
    res.status(400).json({ error: 'Invalid input: provide base64 for photo or text for pdf' });
    return;
  }

  try {
    const input =
      type === 'photo'
        ? { type: 'image' as const, base64: base64!, mediaType: (mediaType ?? 'image/jpeg') as 'image/jpeg' }
        : { type: 'text' as const, content: text! };

    const parsedJson = await parseDischargeInstructions(input);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dischargeResult = await client.query(
        `INSERT INTO discharges (id, user_id, raw_input_type, parsed_json, discharge_date, provider_phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          uuidv4(),
          req.userId,
          type,
          JSON.stringify(parsedJson),
          discharge_date ?? null,
          provider_phone ?? null,
        ]
      );

      const discharge = dischargeResult.rows[0];

      // Denormalize medications into medications table
      for (const med of parsedJson.medications) {
        await client.query(
          `INSERT INTO medications (id, discharge_id, name, dose, frequency, times, instructions)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [uuidv4(), discharge.id, med.name, med.dose, med.frequency, med.times, med.instructions]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ data: discharge });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Discharge parse error', err);
    res.status(500).json({ error: 'Failed to parse discharge instructions' });
  }
});

// PATCH /discharge/latest
router.patch('/latest', async (req: AuthRequest, res: Response): Promise<void> => {
  const { provider_phone } = req.body as { provider_phone?: string };

  try {
    const result = await pool.query(
      `UPDATE discharges SET provider_phone = $1
       WHERE id = (
         SELECT id FROM discharges WHERE user_id = $2 ORDER BY created_at DESC LIMIT 1
       )
       RETURNING *`,
      [provider_phone ?? null, req.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'No discharge record found' });
      return;
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Patch discharge error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /discharge/latest
router.get('/latest', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM discharges WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'No discharge record found' });
      return;
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get latest discharge error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /discharge/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM discharges WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Discharge not found' });
      return;
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get discharge error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
