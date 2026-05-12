import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { parseDischargeInstructions, translateDischargeJSON } from '../services/claude';
import { extractTextFromPDF } from '../services/pdfExtract';

const router = Router();

// All discharge routes require auth
router.use(requireAuth);

// POST /discharge/parse
// Parse discharge instructions via Claude without saving — used for the review step
router.post('/parse', async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, base64, mediaType, text, language } = req.body as {
    type?: string;
    base64?: string;
    mediaType?: string;
    text?: string;
    language?: string;
  };

  if (!type || (type === 'photo' && !base64) || (type === 'pdf' && !base64 && !text)) {
    res.status(400).json({ error: 'Invalid input: provide base64 for photo or pdf' });
    return;
  }

  try {
    let input: Parameters<typeof parseDischargeInstructions>[0];

    if (type === 'photo') {
      input = { type: 'image', base64: base64!, mediaType: (mediaType ?? 'image/jpeg') as 'image/jpeg' };
    } else {
      // PDF: extract text from base64-encoded file, or use pre-extracted text
      const pdfText = text ?? await extractTextFromPDF(base64!);
      input = { type: 'text', content: pdfText };
    }

    const parsedJson = await parseDischargeInstructions(input, language);
    res.json({ data: parsedJson });
  } catch (err: any) {
    console.error('Discharge parse error', err);
    res.status(500).json({ error: err.message ?? 'Failed to parse discharge instructions' });
  }
});

// POST /discharge
// Body: { type: 'photo' | 'pdf', base64?: string, mediaType?: string, text?: string,
//         discharge_date?: string, provider_phone?: string }
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, base64, mediaType, text, discharge_date, provider_phone, language } = req.body as {
    type?: string;
    base64?: string;
    mediaType?: string;
    text?: string;
    discharge_date?: string;
    provider_phone?: string;
    language?: string;
  };

  if (!type || (type === 'photo' && !base64) || (type === 'pdf' && !base64 && !text)) {
    res.status(400).json({ error: 'Invalid input: provide base64 for photo or pdf' });
    return;
  }

  try {
    let input: Parameters<typeof parseDischargeInstructions>[0];
    if (type === 'photo') {
      input = { type: 'image' as const, base64: base64!, mediaType: (mediaType ?? 'image/jpeg') as 'image/jpeg' };
    } else {
      const pdfText = text ?? await extractTextFromPDF(base64!);
      input = { type: 'text' as const, content: pdfText };
    }

    const parsedJson = await parseDischargeInstructions(input, language);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dischargeResult = await client.query(
        `INSERT INTO discharges (id, user_id, raw_input_type, parsed_json, original_parsed_json, discharge_date, provider_phone)
         VALUES ($1, $2, $3, $4, $4, $5, $6)
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

// POST /discharge/latest/translate
router.post('/latest/translate', async (req: AuthRequest, res: Response): Promise<void> => {
  const { language } = req.body as { language?: string };
  if (!language) {
    res.status(400).json({ error: 'language is required' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT * FROM discharges WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'No discharge record found' });
      return;
    }

    const discharge = result.rows[0];
    // Always translate from the original English source; fall back to parsed_json for old records
    const source = (discharge.original_parsed_json ?? discharge.parsed_json) as import('../types').DischargeJSON;

    const translated = language === 'English'
      ? source
      : await translateDischargeJSON(source, language);

    const updated = await pool.query(
      `UPDATE discharges SET parsed_json = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(translated), discharge.id]
    );

    res.json({ data: updated.rows[0] });
  } catch (err: any) {
    console.error('Translate discharge error', err);
    res.status(500).json({ error: err.message ?? 'Failed to translate' });
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
