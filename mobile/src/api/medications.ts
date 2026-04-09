import { api } from './client';
import { MedicationRecord, MedicationLog, ApiResponse } from '../types';

export async function getMedications(): Promise<ApiResponse<MedicationRecord[]>> {
  return api.get('/medications');
}

export async function logMedication(
  medicationId: string,
  scheduled_time: string,
  action: 'taken' | 'skipped'
): Promise<ApiResponse<MedicationLog>> {
  return api.post(`/medications/${medicationId}/log`, { scheduled_time, action });
}

export async function getMedicationLogs(days = 30): Promise<ApiResponse<MedicationLog[]>> {
  return api.get(`/medications/logs?days=${days}`);
}
