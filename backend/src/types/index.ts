// Re-export shared types so backend imports stay within src/
export type {
  DischargeJSON,
  Medication,
  FollowUpAppointment,
  DischargeRecord,
  MedicationRecord,
  CheckIn,
  CheckInResponse,
  MedicationLog,
  AuthTokens,
  UserProfile,
  ApiResponse,
  ApiError,
} from '../../../shared/types';
