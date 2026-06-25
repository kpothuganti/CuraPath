import { api } from './client';
import { AuthTokens, UserProfile, ApiResponse } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function register(
  email: string,
  password: string,
  timezone: string,
  firstName: string,
  lastName: string
): Promise<ApiResponse<{ user: UserProfile; accessToken: string; refreshToken: string }>> {
  return api.post('/auth/register', { email, password, timezone, firstName, lastName });
}

export async function login(
  email: string,
  password: string
): Promise<ApiResponse<{ user: UserProfile; accessToken: string; refreshToken: string }>> {
  return api.post('/auth/login', { email, password });
}

export async function refreshTokens(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  return res.json();
}

export async function forgotPassword(email: string): Promise<ApiResponse<{ sent: boolean }>> {
  return api.post('/auth/forgot-password', { email });
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<ApiResponse<{ reset: boolean }>> {
  return api.post('/auth/reset-password', { email, code, newPassword });
}

export async function deleteAccount(): Promise<ApiResponse<{ deleted: boolean }>> {
  return api.delete('/auth/account');
}
