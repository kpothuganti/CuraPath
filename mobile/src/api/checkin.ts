import { api } from './client';
import { CheckIn, CheckInResponse, ApiResponse } from '../types';

export interface TodayCheckInData {
  completed: boolean;
  check_in?: CheckIn;
  discharge_id?: string;
  questions?: Array<{ question: string; red_flag: string }>;
}

export async function getTodayCheckIn(): Promise<ApiResponse<TodayCheckInData>> {
  return api.get('/checkin/today');
}

export async function submitCheckIn(
  discharge_id: string,
  responses: CheckInResponse[]
): Promise<ApiResponse<CheckIn>> {
  return api.post('/checkin', { discharge_id, responses });
}
