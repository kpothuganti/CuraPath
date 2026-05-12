import { api } from './client';
import { DischargeJSON, DischargeRecord, ApiResponse } from '../types';

export async function parseDischarge(
  type: 'photo' | 'pdf',
  opts: { base64?: string; mediaType?: string; text?: string; language?: string }
): Promise<ApiResponse<DischargeJSON>> {
  return api.post('/discharge/parse', { type, ...opts });
}

export async function uploadPhoto(
  base64: string,
  mediaType: string,
  opts?: { discharge_date?: string; provider_phone?: string; language?: string }
): Promise<ApiResponse<DischargeRecord>> {
  return api.post('/discharge', {
    type: 'photo',
    base64,
    mediaType,
    ...opts,
  });
}

export async function uploadPDF(
  base64: string,
  opts?: { discharge_date?: string; provider_phone?: string; language?: string }
): Promise<ApiResponse<DischargeRecord>> {
  return api.post('/discharge', { type: 'pdf', base64, ...opts });
}

export async function getLatestDischarge(): Promise<ApiResponse<DischargeRecord>> {
  return api.get('/discharge/latest');
}

export async function getDischarge(id: string): Promise<ApiResponse<DischargeRecord>> {
  return api.get(`/discharge/${id}`);
}

export async function translateDischarge(
  language: string
): Promise<ApiResponse<DischargeRecord>> {
  return api.post('/discharge/latest/translate', { language });
}

export async function updateProviderPhone(
  provider_phone: string | null
): Promise<ApiResponse<DischargeRecord>> {
  return api.patch('/discharge/latest', { provider_phone });
}
