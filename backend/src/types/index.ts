// Backend-local type definitions (mirrors shared/types but self-contained for deployment)

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  instructions: string;
  times: string[];
}

export interface FollowUpAppointment {
  type: string;
  timeframe: string;
}

export interface DischargeJSON {
  medications: Medication[];
  activity_restrictions: string[];
  red_flags: string[];
  follow_up_appointments: FollowUpAppointment[];
  diet_restrictions: string[];
  wound_care: string[];
  sleeping_instructions: string[];
  exercises: string[];
  provider_phone?: string | null;
}

export interface DischargeRecord {
  id: string;
  user_id: string;
  raw_input_type: 'photo' | 'pdf' | 'fhir';
  raw_input_url: string | null;
  parsed_json: DischargeJSON;
  discharge_date: string | null;
  provider_phone: string | null;
  created_at: string;
}

export interface MedicationRecord {
  id: string;
  discharge_id: string;
  name: string;
  dose: string;
  frequency: string;
  times: string[];
  instructions: string;
}

export interface CheckInResponse {
  question: string;
  answer: boolean;
}

export interface CheckIn {
  id: string;
  user_id: string;
  discharge_id: string;
  date: string;
  responses_json: CheckInResponse[];
  red_flag_triggered: boolean;
  completed_at: string | null;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  user_id: string;
  scheduled_time: string;
  taken_at: string | null;
  skipped: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  timezone: string;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
