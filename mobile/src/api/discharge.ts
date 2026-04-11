import { api } from './client';
import { DischargeRecord, ApiResponse } from '../types';

export async function uploadPhoto(
  base64: string,
  mediaType: string,
  opts?: { discharge_date?: string; provider_phone?: string }
): Promise<ApiResponse<DischargeRecord>> {
  return api.post('/discharge', {
    type: 'photo',
    base64,
    mediaType,
    ...opts,
  });
}

export async function uploadPDF(
  text: string,
  opts?: { discharge_date?: string; provider_phone?: string }
): Promise<ApiResponse<DischargeRecord>> {
  return api.post('/discharge', { type: 'pdf', text, ...opts });
}

export async function getLatestDischarge(): Promise<ApiResponse<DischargeRecord>> {
  return api.get('/discharge/latest');
}

export async function getDischarge(id: string): Promise<ApiResponse<DischargeRecord>> {
  return api.get(`/discharge/${id}`);
}

export async function updateProviderPhone(
  provider_phone: string | null
): Promise<ApiResponse<DischargeRecord>> {
  return api.patch('/discharge/latest', { provider_phone });
}
