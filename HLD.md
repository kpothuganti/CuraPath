# High-Level Design — ReCharge

**Version:** 1.0  
**Date:** 2026-04-07

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App                               │
│              React Native (iOS + Android)                       │
│                                                                 │
│  Onboarding → Upload → Processing → Home → CheckIn → MedLog    │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS only
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API                                 │
│              Node.js / Express on AWS                           │
│                                                                 │
│  /auth   /discharge   /checkin   /medications   /notifications  │
└──────┬──────────────────┬─────────────────────────────────────┬─┘
       │                  │                                     │
       ▼                  ▼                                     ▼
┌──────────┐    ┌─────────────────┐                  ┌──────────────┐
│ AWS      │    │  Anthropic      │                  │  AWS SNS /   │
│ Cognito  │    │  Claude API     │                  │  Expo Push   │
│ (Auth)   │    │  (Sonnet 4.6)   │                  │  Notifications│
└──────────┘    └─────────────────┘                  └──────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AWS (BAA signed)                            │
│                                                                 │
│  RDS PostgreSQL          S3 (encrypted)                         │
│  (encrypted at rest)     raw discharge files                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Platform

**React Native with TypeScript** (Expo managed workflow for v1)

Rationale: Single codebase for iOS and Android. Expo simplifies camera, file picker, and push notification setup. Eject to bare workflow if App Orchard / deep native integrations are required in v2.

---

## 3. Frontend Architecture

### Navigation

```
AppNavigator (Stack)
├── AuthStack
│   ├── Welcome
│   ├── Register
│   └── Login
└── AppStack (authenticated)
    ├── BottomTabNavigator
    │   ├── Home (today's tasks + meds)
    │   ├── Instructions (full plain-language view)
    │   ├── MedLog (adherence history)
    │   └── Settings
    ├── Upload (modal)
    ├── Processing (modal)
    ├── CheckIn (modal, push-triggered)
    └── RedFlagAlert (modal)
```

### State Management

Zustand (lightweight, no boilerplate). Two stores:

- `authStore` — user session, JWT tokens, refresh logic
- `dischargeStore` — parsed discharge JSON, medications, check-in history

### Key Screens

| Screen          | Purpose                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| `Onboarding/`   | Welcome, notification permission request, account creation                             |
| `Upload/`       | Camera capture or PDF file picker                                                      |
| `Processing/`   | "Reading your instructions..." skeleton/loader while Claude API runs                   |
| `Home/`         | Today's date, today's tasks (activity restrictions), medication schedule with checkoff |
| `CheckIn/`      | Morning symptom questions derived from `red_flags` array                               |
| `RedFlagAlert/` | Warning card + tap-to-call provider button                                             |
| `MedLog/`       | Adherence calendar / history list                                                      |
| `Instructions/` | Full plain-language instruction dump (all parsed fields)                               |
| `Settings/`     | Push notification times, emergency contact, account, delete account                    |

### Key Components

| Component         | Props                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| `TaskCard`        | `title`, `done`, `onToggle`                                                          |
| `MedReminderCard` | `medication`, `scheduledTime`, `status` (pending/taken/skipped), `onTaken`, `onSkip` |
| `RedFlagAlert`    | `flags[]`, `providerPhone`                                                           |
| `CheckInQuestion` | `question`, `onYes`, `onNo`                                                          |

---

## 4. Backend Architecture

### Stack

| Layer        | Choice                                      | Reason                                                            |
| ------------ | ------------------------------------------- | ----------------------------------------------------------------- |
| Runtime      | Node.js + Express                           | Familiar, fast iteration                                          |
| Hosting      | AWS ECS (Fargate)                           | HIPAA-eligible, serverless containers                             |
| Auth         | AWS Cognito                                 | MFA, HIPAA-aligned, managed                                       |
| Database     | Amazon RDS PostgreSQL                       | Relational hierarchy fits data model; encryption at rest built-in |
| File storage | S3 + SSE-KMS                                | HIPAA-eligible; versioning enabled                                |
| Push         | Expo Push Notifications (v1) → AWS SNS (v2) | Expo is simpler for MVP; SNS scales                               |
| Secrets      | AWS Secrets Manager                         | Anthropic API key never in code or mobile binary                  |

**Do not use Firebase** — not HIPAA-eligible without special configuration.

### API Routes

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
DELETE /auth/account

POST   /discharge           # Upload + trigger Claude parse
GET    /discharge/:id       # Fetch parsed discharge
GET    /discharge/latest    # Current active discharge

GET    /checkin/today       # Get today's check-in questions
POST   /checkin             # Submit check-in responses

GET    /medications         # All meds for current discharge
POST   /medications/:id/log # Log taken/skipped with timestamp
GET    /medications/logs    # Adherence history
```

### Claude API Integration

The mobile app **never calls Anthropic directly**. All Claude calls are proxied through the backend.

```
Mobile → POST /discharge (image base64 or PDF text)
       → Backend calls Anthropic API with API key from Secrets Manager
       → Backend parses and validates response JSON
       → Backend stores to RDS + returns structured data to mobile
```

Prompt structure:

```
System: You are a medical document parser. Extract structured information from the
following hospital discharge instructions. Return ONLY valid JSON — no preamble,
no markdown fences — matching this exact schema: [schema].
Rewrite all instructions at a 6th-grade reading level. If a field has no data, return [].

User: [base64 image block OR extracted PDF text]
```

Model: `claude-sonnet-4-6` (best document parsing + vision)

---

## 5. Data Model

```sql
-- Users
users (
  id          UUID PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  timezone    TEXT NOT NULL DEFAULT 'America/New_York',
  created_at  TIMESTAMPTZ DEFAULT NOW()
)

-- Discharge records
discharges (
  id                UUID PRIMARY KEY,
  user_id           UUID REFERENCES users(id),
  raw_input_type    TEXT CHECK (raw_input_type IN ('photo', 'pdf', 'fhir')),
  raw_input_url     TEXT,           -- S3 key (encrypted)
  parsed_json       JSONB,          -- full Claude output
  discharge_date    DATE,
  provider_phone    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
)

-- Medications (denormalized from parsed_json for querying)
medications (
  id             UUID PRIMARY KEY,
  discharge_id   UUID REFERENCES discharges(id),
  name           TEXT NOT NULL,
  dose           TEXT,
  frequency      TEXT,
  times          TEXT[],           -- ["08:00", "20:00"]
  instructions   TEXT
)

-- Daily check-ins
check_ins (
  id                  UUID PRIMARY KEY,
  user_id             UUID REFERENCES users(id),
  discharge_id        UUID REFERENCES discharges(id),
  date                DATE NOT NULL,
  responses_json      JSONB,        -- { question: string, answer: bool }[]
  red_flag_triggered  BOOLEAN DEFAULT FALSE,
  completed_at        TIMESTAMPTZ
)

-- Medication adherence log
medication_logs (
  id              UUID PRIMARY KEY,
  medication_id   UUID REFERENCES medications(id),
  user_id         UUID REFERENCES users(id),
  scheduled_time  TIMESTAMPTZ,
  taken_at        TIMESTAMPTZ,
  skipped         BOOLEAN DEFAULT FALSE
)
```

All tables: encryption at rest via RDS storage encryption (AES-256). All queries over TLS.

---

## 6. Security Architecture

| Requirement         | Implementation                                                     |
| ------------------- | ------------------------------------------------------------------ |
| HTTPS only          | ALB with TLS 1.2+ termination; HSTS header                         |
| Encryption at rest  | RDS storage encryption + S3 SSE-KMS                                |
| Auth tokens         | Cognito JWT, 1hr expiry, refresh token rotation                    |
| API key security    | Stored in AWS Secrets Manager, fetched at runtime                  |
| Audit logging       | CloudTrail + RDS audit log                                         |
| No PHI in analytics | Analytics events log screen names / tap counts only, never content |
| No PHI in logs      | Structured logging strips all patient fields before writing        |

---

## 7. Push Notification Flow

```
1. Backend scheduler (cron) fires at user's configured check-in time
2. Sends push via Expo Push API → APNs / FCM
3. User taps → app opens to CheckIn screen
4. Questions generated from current discharge's red_flags[]
5. User answers → POST /checkin
6. If red_flag_triggered → show RedFlagAlert with provider tap-to-call

Medication reminders:
1. When discharge is saved → schedule local notifications for each med time
2. 30 min after scheduled time → if no log entry → send missed-dose nudge
```

---

## 8. Project File Structure

```
/src
  /api
    claude.ts             # Backend: Anthropic API call + response parse
    auth.ts               # Login, register, token refresh
    discharge.ts          # Save/fetch discharge records
    checkin.ts            # Submit daily check-in
    medications.ts        # Fetch meds, log taken/skipped
  /screens
    Onboarding/
      WelcomeScreen.tsx
      RegisterScreen.tsx
      PermissionsScreen.tsx
    Upload/
      UploadScreen.tsx    # Camera + PDF picker
    Processing/
      ProcessingScreen.tsx
    Home/
      HomeScreen.tsx
    CheckIn/
      CheckInScreen.tsx
    RedFlagAlert/
      RedFlagAlertScreen.tsx
    MedLog/
      MedLogScreen.tsx
    Instructions/
      InstructionsScreen.tsx
    Settings/
      SettingsScreen.tsx
  /components
    TaskCard.tsx
    MedReminderCard.tsx
    RedFlagAlert.tsx
    CheckInQuestion.tsx
    Disclaimer.tsx        # "This is not medical advice" — used everywhere
  /hooks
    useDischarge.ts
    useCheckIn.ts
    useMedications.ts
    useNotifications.ts
  /utils
    pdfExtract.ts         # PDF → text (react-native-pdf-lib or similar)
    imageToBase64.ts
    parseClaudeResponse.ts
  /navigation
    AppNavigator.tsx
    AuthNavigator.tsx
  /store
    authStore.ts          # Zustand
    dischargeStore.ts     # Zustand
```

---

## 9. Implementation Phases

### Phase 1 — Core loop (weeks 1–4)

1. React Native + TypeScript project setup (Expo)
2. HIPAA-compliant backend on AWS (BAA, RDS, Cognito, Secrets Manager)
3. Photo capture + PDF upload screens
4. Claude API integration routed through backend
5. Parsed instruction display screen + review/confirm step

### Phase 2 — Engagement loop (weeks 5–8)

6. Medication reminder system (local push notifications)
7. Medication log + checkoff UI
8. Daily check-in flow (dynamic questions from `red_flags`)
9. Red flag alert screen + tap-to-call

### Phase 3 — Polish + launch (weeks 9–12)

10. Onboarding flow
11. Settings screen (notifications, emergency contact, delete account)
12. TestFlight / Play Store internal testing
13. App Store + Play Store submission

### Phase 4 — v2 (post-launch)

14. Epic FHIR integration (App Orchard application)
15. Caregiver sharing / family visibility
16. Care team dashboard (B2B2C pivot)
17. Condition-specific check-in templates (cardiac, ortho, etc.)
