import Anthropic from '@anthropic-ai/sdk';
import { DischargeJSON } from '../types';

const MOCK_DISCHARGE: DischargeJSON = {
  medications: [
    {
      name: 'Metoprolol',
      dose: '25mg',
      frequency: 'twice daily',
      instructions: 'Take with food',
      times: ['08:00', '20:00'],
    },
    {
      name: 'Lisinopril',
      dose: '10mg',
      frequency: 'once daily',
      instructions: 'Take with or without food',
      times: ['12:00'],
    },
  ],
  activity_restrictions: [
    'No lifting over 10 lbs for 2 weeks',
    'No driving for 48 hours after your procedure',
    'Short walks are okay — start slow and rest if you feel tired',
  ],
  red_flags: [
    'Fever above 101°F (38.3°C)',
    'Chest pain or shortness of breath',
    'Wound drainage that is green or has a bad smell',
    'Swelling or redness that gets worse',
  ],
  follow_up_appointments: [
    { type: 'Primary care doctor', timeframe: 'Within 7 days' },
    { type: 'Cardiologist', timeframe: 'Within 2 weeks' },
  ],
  diet_restrictions: [
    'Low sodium diet — avoid salty foods',
    'Limit fluids to 2 liters per day',
  ],
  wound_care: [
    'Keep the wound clean and dry for 48 hours',
    'Change the bandage once a day or if it gets wet',
  ],
  sleeping_instructions: [
    'Sleep with your head and upper body raised — try a recliner or pillow stack',
    'Keep a pillow under your arm for comfort',
  ],
  exercises: [
    'Hand: make a tight fist, then straighten fingers — 5 reps, 5x daily',
    'Wrist: bend hand down then up — 5 reps, 5x daily',
  ],
};

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? 'mock' });

const SYSTEM_PROMPT = `You are a medical document parser. Extract structured information from hospital discharge instructions.
Return ONLY valid JSON — no preamble, no markdown fences — matching this exact schema:
{
  "medications": [{ "name": string, "dose": string, "frequency": string, "instructions": string, "times": string[] }],
  "activity_restrictions": string[],
  "red_flags": string[],
  "follow_up_appointments": [{ "type": string, "timeframe": string }],
  "diet_restrictions": string[],
  "wound_care": string[],
  "sleeping_instructions": string[],
  "exercises": string[]
}
Rewrite all instructions at a 6th-grade reading level. If a field has no data, return an empty array.
Times should be in "HH:MM" 24-hour format inferred from the frequency (e.g. twice daily → ["08:00","20:00"]).
sleeping_instructions: any guidance about sleep position, pillows, or sleeping comfort.
exercises: each exercise as a single string describing what to do (e.g. "Hand: make a tight fist, then straighten fingers — 5 reps, 5x daily").
diet_restrictions: include any dietary guidance AND constipation/hydration tips related to medications.
IMPORTANT: If the image is too blurry, too dark, poorly lit, or otherwise illegible to reliably extract medical information, respond with ONLY this JSON and nothing else: {"parse_error":"illegible"}`;

type ImageInput = {
  type: 'image';
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
};

type TextInput = {
  type: 'text';
  content: string;
};

export async function parseDischargeInstructions(
  input: ImageInput | TextInput,
  language = 'English'
): Promise<DischargeJSON> {
  if (process.env.USE_MOCK_CLAUDE === 'true') {
    console.log('[mock] Skipping Claude API call — returning mock discharge data');
    await new Promise((r) => setTimeout(r, 1500)); // simulate network delay
    return MOCK_DISCHARGE;
  }

  const userContent: Anthropic.MessageParam['content'] =
    input.type === 'image'
      ? [
          {
            type: 'image',
            source: { type: 'base64', media_type: input.mediaType, data: input.base64 },
          },
          {
            type: 'text',
            text: 'These are hospital discharge instructions. Extract all structured information.',
          },
        ]
      : [{ type: 'text', text: input.content }];

  const systemPrompt = language === 'English'
    ? SYSTEM_PROMPT
    : `${SYSTEM_PROMPT}\nOutput all text in ${language}. Do not translate medication names or dosages.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content');
  }

  try {
    let raw = textBlock.text.trim();
    // Strip markdown code fences if present
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    // Extract just the outermost JSON object in case there's surrounding text
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found in response');
    raw = raw.slice(start, end + 1);
    const parsed = JSON.parse(raw) as any;
    if (parsed.parse_error === 'illegible') {
      throw new Error('The photo was too blurry or unclear to read. Please retake in good lighting with the text fully visible.');
    }
    return parsed as DischargeJSON;
  } catch (e: any) {
    if (e.message.startsWith('The photo was')) throw e;
    throw new Error(`Claude returned invalid JSON: ${textBlock.text.slice(0, 200)}`);
  }
}

export async function translateDischargeJSON(
  json: DischargeJSON,
  targetLanguage: string
): Promise<DischargeJSON> {
  if (process.env.USE_MOCK_CLAUDE === 'true') {
    return json;
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: 'You are a precise medical translator. Return only valid JSON with no preamble or markdown fences.',
    messages: [{
      role: 'user',
      content: `Translate the following medical discharge instructions JSON to ${targetLanguage}.
Rules:
- Preserve the exact JSON structure and all keys
- Translate all instructional text, descriptions, and medical guidance
- Do NOT translate medication names (e.g., Oxycodone, Tylenol, Ibuprofen)
- Do NOT change dosage amounts or units (e.g., keep "25mg" as-is)
- Do NOT change time strings (e.g., keep "08:00", "20:00" as-is)
- Return ONLY valid JSON

JSON:
${JSON.stringify(json)}`,
    }],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No translation returned');

  let raw = textBlock.text.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in translation response');
  return JSON.parse(raw.slice(start, end + 1)) as DischargeJSON;
}
