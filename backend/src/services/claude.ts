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
  "wound_care": string[]
}
Rewrite all instructions at a 6th-grade reading level. If a field has no data, return an empty array.
Times should be in "HH:MM" 24-hour format inferred from the frequency (e.g. twice daily → ["08:00","20:00"]).`;

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
  input: ImageInput | TextInput
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

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content');
  }

  try {
    return JSON.parse(textBlock.text) as DischargeJSON;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${textBlock.text.slice(0, 200)}`);
  }
}
