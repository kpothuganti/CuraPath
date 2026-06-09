# CuraPath — Complete Technical Overview

**Author:** Krishna Pothuganti  
**Purpose:** Deep technical reference — how the entire system works end-to-end, written to be shared with engineers or used as a personal mental model of the codebase.  
**Last updated:** May 2026

---

## Table of Contents

1. [What CuraPath Does — The One-Paragraph Summary](#1-what-curapath-does--the-one-paragraph-summary)
2. [System Architecture Map — How Everything Connects](#2-system-architecture-map--how-everything-connects)
3. [Tech Stack Choices and Why](#3-tech-stack-choices-and-why)
4. [Repository Layout](#4-repository-layout)
5. [The Backend in Depth](#5-the-backend-in-depth)
   - 5.1 Server Startup
   - 5.2 Express App Setup
   - 5.3 Database Layer
   - 5.4 Database Schema (Every Table Explained)
   - 5.5 Auth Routes
   - 5.6 Discharge Routes
   - 5.7 Medications Routes
   - 5.8 Check-In Routes
   - 5.9 Auth Middleware
   - 5.10 The Claude AI Service
   - 5.11 The PDF Extraction Service
   - 5.12 TypeScript Types
6. [The Mobile App in Depth](#6-the-mobile-app-in-depth)
   - 6.1 App Entry Point
   - 6.2 Navigation Architecture
   - 6.3 Zustand Stores
   - 6.4 The API Client Layer
   - 6.5 The Theme System
   - 6.6 The Notifications System
   - 6.7 Language / Translation System
   - 6.8 Each Screen Explained
7. [Key User Flows — Step by Step](#7-key-user-flows--step-by-step)
   - 7.1 First-Time Registration Flow
   - 7.2 Returning User Login + Session Persistence Flow
   - 7.3 Discharge Upload Flow (The Core Feature)
   - 7.4 Daily Check-In Flow
   - 7.5 Medication Logging Flow
   - 7.6 Red Flag Alert Flow
   - 7.7 Language Translation Flow
   - 7.8 Token Refresh Flow
8. [AWS Infrastructure In Depth](#8-aws-infrastructure-in-depth)
9. [HIPAA Compliance — What It Means and How It's Implemented](#9-hipaa-compliance--what-it-means-and-how-its-implemented)
10. [The Website](#10-the-website)
11. [Build, Deploy, and Release Process](#11-build-deploy-and-release-process)
12. [Environment Variables Reference](#12-environment-variables-reference)
13. [Common Developer Tasks — How To's](#13-common-developer-tasks--how-tos)
14. [Known Patterns, Conventions, and Design Decisions](#14-known-patterns-conventions-and-design-decisions)

---

## 1. What CuraPath Does — The One-Paragraph Summary

CuraPath is a HIPAA-compliant iOS mobile app that solves a real problem: most post-surgery patients leave the hospital with dense, confusing discharge paperwork that they either misread or ignore. The app lets users photograph or upload that paperwork, sends it to Claude AI (Anthropic's large language model), and converts it into a clean, plain-English structured recovery plan. That plan includes a personalized medication schedule with per-dose reminders, daily symptom check-ins built from the actual red flags in the discharge instructions, activity restrictions, wound care guidance, diet notes, follow-up appointment reminders, and more. Everything is persisted in a HIPAA-covered PostgreSQL database on AWS. The system is fully authenticated with JWTs and is designed to hold real protected health information (PHI).

---

## 2. System Architecture Map — How Everything Connects

Understanding the architecture at a high level before diving into any individual component is critical. Here is the full picture:

```
User's iPhone
  │
  │  React Native (Expo SDK 54)
  │  Zustand state management
  │  expo-notifications (Time Sensitive)
  │  expo-image-picker / expo-document-picker
  │
  │  HTTPS (ACM cert, .app TLD)
  ▼
AWS Application Load Balancer (ALB)
  │  api.curapath.app → aliased in Route 53
  ▼
AWS Elastic Beanstalk
  │  Environment: curapath-backend-env (us-east-2)
  │  Node.js 24 on Amazon Linux 2023
  │  1–2 t3.micro instances
  │  Nginx as reverse proxy
  │
  │  Node.js + Express + TypeScript (compiled to dist/)
  │  JWT authentication
  │  Anthropic Claude API (@anthropic-ai/sdk)
  │  pdf-parse for PDF text extraction
  │
  │  VPC-only connection (port 5432)
  ▼
Amazon RDS PostgreSQL
  │  curapath-prod.crsus44ywyku.us-east-2.rds.amazonaws.com
  │  AES-256 encryption at rest (AWS managed key)
  │  Not publicly accessible
  │  Security group: curapath-rds-sg
  │    → inbound 5432 only from Beanstalk EC2 security group
  │
  Tables: users, discharges, medications,
          check_ins, medication_logs, refresh_tokens
  │
  └── S3: curapath-raw-inputs (raw discharge uploads)

DNS + Hosting
  Route 53 → curapath.app
  GitHub Pages → curapath.app (marketing site)
  ACM certificate → curapath.app + api.curapath.app
```

The key insight is that the mobile app never talks directly to the database. All database access goes through the Express API on Elastic Beanstalk. The RDS instance is isolated inside AWS's VPC and only accepts connections from the Beanstalk EC2 instances — nobody can reach it from the public internet.

Claude AI is a third-party API call (Anthropic's API) that the backend makes on behalf of the user. The image or PDF text is sent to Claude, and the structured JSON comes back. The mobile app never calls the Anthropic API directly.

---

## 3. Tech Stack Choices and Why

### Mobile: React Native + Expo

**React Native** was chosen so the app could eventually ship on both iOS and Android from one codebase. For the initial TestFlight/App Store launch, iOS is the focus.

**Expo SDK 54** (managed workflow) removes the need to maintain Xcode project files manually. EAS (Expo Application Services) handles cloud builds, code signing, and App Store submission. This is critical because it means you do not need a Mac with Xcode to produce a production `.ipa` file — EAS builds in the cloud.

**TypeScript** is used throughout. It catches type errors at compile time, and since the backend and mobile app share a `shared/types/` folder, the same type definitions (like `DischargeJSON`, `MedicationRecord`) are used in both places, eliminating drift.

**React Navigation** is the standard navigation library. The app uses a native stack navigator (hardware-accelerated screen transitions on iOS) combined with a bottom tab navigator. More on this in the navigation section.

**Zustand** is the state management library. It was chosen over Redux because it has no boilerplate — a store is just a function that returns state and actions. There are two stores: `authStore` (user identity + tokens) and `dischargeStore` (the current discharge + medications). Zustand's `.getState()` method also allows accessing state outside React components, which is critical for the API client that needs the current access token without being inside a component.

### Backend: Node.js + Express + TypeScript

A deliberately minimal, well-understood stack. Express is simple, fast, and the npm ecosystem for auth (bcrypt, jsonwebtoken), database (pg), and AI (anthropic) is excellent.

TypeScript on the backend mirrors the mobile app so types can be shared. The TypeScript is compiled (`tsc`) to `dist/` at deploy time. The Elastic Beanstalk Procfile runs `node dist/server.js` — it does not use `ts-node` in production, which is correct because `ts-node` is a development tool that transpiles on the fly.

**Helmet** adds security headers (prevents XSS, clickjacking, MIME sniffing). **CORS** is configured to only allow the app's origins (or localhost during development).

### Database: PostgreSQL on RDS

PostgreSQL was chosen for its JSONB column type, which is perfect for the `parsed_json` column — the discharge JSON blob can be queried with SQL operators if needed, and it stores structured data without needing to define a rigid schema for every possible field Claude might return.

RDS on AWS means managed backups (7-day retention), automatic patching, failover, and encryption at rest — all of which are needed for HIPAA compliance. Running your own Postgres server on an EC2 instance would require you to manage all of that yourself.

### Claude AI: `claude-sonnet-4-5`

The model used is `claude-sonnet-4-5` (via `@anthropic-ai/sdk`). Sonnet is chosen over Haiku (too fast/cheap, less capable for complex medical document parsing) and Opus (unnecessarily expensive for this structured extraction task). Claude's multimodal capability — being able to accept base64-encoded images directly — is the key technical enabler for the photo upload feature. For PDFs, the text is extracted on the server first (via `pdf-parse`) and sent as text.

---

## 4. Repository Layout

```
recharge/                      ← monorepo root
├── backend/                   ← Express API
│   ├── src/
│   │   ├── server.ts          ← entry: dotenv + app.listen
│   │   ├── app.ts             ← Express setup: middleware + routes
│   │   ├── middleware/
│   │   │   └── auth.ts        ← JWT verification middleware
│   │   ├── routes/
│   │   │   ├── auth.ts        ← /auth/* endpoints
│   │   │   ├── discharge.ts   ← /discharge/* endpoints
│   │   │   ├── medications.ts ← /medications/* endpoints
│   │   │   └── checkin.ts     ← /checkin/* endpoints
│   │   ├── services/
│   │   │   ├── claude.ts      ← Anthropic API calls
│   │   │   └── pdfExtract.ts  ← pdf-parse wrapper
│   │   ├── db/
│   │   │   ├── index.ts       ← pg Pool singleton
│   │   │   └── schema.sql     ← full DDL (run once to set up tables)
│   │   └── types/
│   │       └── index.ts       ← TypeScript types (mirrors shared/types)
│   ├── dist/                  ← compiled JS output (git-ignored, built at deploy)
│   ├── .ebextensions/
│   │   └── nodecommand.config ← sets NODE_ENV=production on Beanstalk
│   ├── Procfile               ← "web: node dist/server.js" (Beanstalk process)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                   ← local dev secrets (never committed)
│
├── mobile/                    ← React Native / Expo app
│   ├── App.tsx                ← root component: loads auth from storage
│   ├── index.ts               ← Expo entry point (registers App component)
│   ├── app.json               ← Expo config (bundle ID, entitlements, permissions)
│   ├── eas.json               ← EAS build profiles + App Store submission config
│   ├── src/
│   │   ├── api/               ← typed fetch wrappers for each backend route group
│   │   │   ├── client.ts      ← base fetch wrapper with JWT + 401 refresh logic
│   │   │   ├── auth.ts
│   │   │   ├── discharge.ts
│   │   │   ├── medications.ts
│   │   │   └── checkin.ts
│   │   ├── store/
│   │   │   ├── authStore.ts   ← Zustand: user + tokens + AsyncStorage persistence
│   │   │   └── dischargeStore.ts ← Zustand: discharge + medications (session only)
│   │   ├── hooks/
│   │   │   ├── useTheme.ts    ← returns dark/light Colors based on system setting
│   │   │   ├── useNotifications.ts ← schedules/cancels all notification types
│   │   │   └── useLanguage.ts ← language preference, SUPPORTED_LANGUAGES list
│   │   ├── theme/
│   │   │   └── index.ts       ← Colors type + dark/light palette objects (30+ tokens)
│   │   ├── navigation/
│   │   │   └── AppNavigator.tsx ← RootStack + Tab navigator + notification routing
│   │   ├── screens/
│   │   │   ├── Onboarding/    ← Welcome, Register, Login, Permissions
│   │   │   ├── Home/          ← HomeScreen (main dashboard)
│   │   │   ├── Instructions/  ← full discharge instructions view
│   │   │   ├── Upload/        ← camera / library / PDF picker
│   │   │   ├── Processing/    ← AI parsing progress UI
│   │   │   ├── Review/        ← confirm parsed results before saving
│   │   │   ├── CheckIn/       ← daily symptom questionnaire
│   │   │   ├── RedFlagAlert/  ← warning screen + tap-to-call
│   │   │   ├── MedLog/        ← 30-day medication adherence history
│   │   │   └── Settings/      ← notifications, language, provider phone, account
│   │   ├── components/
│   │   │   └── Disclaimer.tsx ← reusable "not medical advice" text
│   │   └── types/
│   │       └── index.ts       ← re-exports everything from shared/types
│
├── shared/
│   └── types/
│       └── index.ts           ← canonical type definitions used by both sides
│
└── docs/                      ← GitHub Pages website
    ├── index.html             ← marketing landing page
    ├── privacy-policy.html
    └── CNAME                  ← "curapath.app" (GitHub Pages custom domain)
```

The `shared/types/index.ts` file is the single source of truth for types like `DischargeJSON`, `MedicationRecord`, `CheckIn`, etc. The mobile app imports from `../../../shared/types` via `mobile/src/types/index.ts` (which simply re-exports everything). The backend has its own copy in `backend/src/types/index.ts` — it mirrors shared types but is self-contained so the backend can be zipped and deployed independently without needing the shared folder.

---

## 5. The Backend in Depth

### 5.1 Server Startup

**File:** `backend/src/server.ts`

```typescript
import dotenv from 'dotenv';
dotenv.config();
import app from './app';
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`ReCharge API running on port ${PORT} [${process.env.NODE_ENV}]`);
});
```

This is intentionally the thinnest possible entry point. `dotenv.config()` is called first — before anything else — so that `process.env` is populated before any modules that read it at import time (like the database pool). The app logic itself lives in `app.ts` to keep things testable. On Elastic Beanstalk, the `PORT` environment variable is set by Nginx's proxy configuration. Locally it defaults to 3000.

### 5.2 Express App Setup

**File:** `backend/src/app.ts`

The app uses three middleware layers applied globally before any routes:

1. **`helmet()`** — Sets 11 security-related HTTP response headers automatically. This includes things like `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and a strict `Content-Security-Policy`. You never have to think about these — Helmet handles them.

2. **`cors({...})`** — Only allows requests from origins listed in the `ALLOWED_ORIGINS` environment variable (comma-separated), falling back to `http://localhost:8081` (Expo's default dev port) if the env var isn't set. `credentials: true` allows the browser to include cookies in cross-origin requests, though the app currently uses Authorization headers rather than cookies.

3. **`express.json({ limit: '10mb' })`** — The 10MB limit is critical. Without it, Express defaults to a very small body limit (usually 100kb), and a base64-encoded hospital discharge photo (which can be 1-3MB raw, so ~1.3-4MB as base64) would be rejected with a 413 error.

There is also a `/health` endpoint that returns `{ status: 'ok', timestamp }`. This is used by the Elastic Beanstalk health check — if this endpoint returns 200, Beanstalk considers the instance healthy. If it stops responding, Beanstalk restarts the instance.

### 5.3 Database Layer

**File:** `backend/src/db/index.ts`

```typescript
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host, port, database, user, password, ssl: ... }
);
```

This is a `pg.Pool` — a connection pool that manages multiple simultaneous PostgreSQL connections. Rather than opening and closing a connection for every request, the pool keeps connections open and reuses them. The pool is created once when the module is first imported and then shared across all route handlers (it's a singleton by virtue of Node.js module caching).

**Why `rejectUnauthorized: false`?** AWS RDS uses a self-signed certificate for SSL. `rejectUnauthorized: false` tells Node.js not to reject the connection because the cert isn't signed by a trusted CA. This is a common RDS pattern. The connection is still encrypted — it just doesn't verify the certificate's chain of trust. For intra-VPC traffic where the attacker would need to already be inside AWS's network, this is acceptable.

**Connection string vs. individual vars:** When `DATABASE_URL` is set (the production pattern on Elastic Beanstalk), it uses that. Otherwise it falls back to individual `DB_HOST`, `DB_PORT`, etc. for local development.

### 5.4 Database Schema (Every Table Explained)

**File:** `backend/src/db/schema.sql`

All tables use UUID primary keys generated by `gen_random_uuid()` from the `pgcrypto` extension. UUIDs are better than auto-incrementing integers for PHI data because they're not guessable — an attacker can't enumerate records by incrementing an ID.

---

#### `users` table

```sql
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  timezone      TEXT NOT NULL DEFAULT 'America/New_York',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `email` is stored lowercase (normalized during registration and login) to prevent duplicate accounts from `User@email.com` and `user@email.com`.
- `password_hash` stores the bcrypt hash — the raw password is never stored anywhere.
- `timezone` stores the user's IANA timezone string (e.g., `America/Chicago`). This is captured from `Intl.DateTimeFormat().resolvedOptions().timeZone` at registration time on the device. It's used to localize notification times, though the notification scheduling itself also uses local device time.
- All foreign keys in other tables reference `users.id` with `ON DELETE CASCADE`, so deleting a user automatically deletes all their data — this is critical for the "Delete my account & data" feature.

---

#### `discharges` table

```sql
CREATE TABLE IF NOT EXISTS discharges (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_input_type       TEXT NOT NULL CHECK (raw_input_type IN ('photo', 'pdf', 'fhir')),
  raw_input_url        TEXT,                 -- S3 key (never a public URL)
  parsed_json          JSONB NOT NULL,
  original_parsed_json JSONB,               -- always the English source
  discharge_date       DATE,
  provider_phone       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discharges_user_id_idx ON discharges(user_id);
```

This is the central table. The most important columns:

- **`parsed_json`** (JSONB): The structured output from Claude — all medications, red flags, activity restrictions, etc. This is what the mobile app renders everywhere. It may be in a translated language if the user has selected a non-English language.
- **`original_parsed_json`** (JSONB): Always stores the English version of the parsed output. When a user changes language, the backend translates from `original_parsed_json` (not from `parsed_json`), so if they switch from Spanish back to English, they always get the correct original text rather than a back-translation.
- **`raw_input_url`**: Intended to hold the S3 key pointing to the original uploaded image or PDF. This is for audit trail / HIPAA purposes. It's currently populated as null in the implementation (the S3 upload step is scaffolded but not yet wired).
- **`provider_phone`**: The doctor's/clinic's phone number. This is stored in its own column (not inside `parsed_json`) so it can be easily queried, patched, and displayed without parsing the JSON blob. The backend explicitly strips `provider_phone` out of `parsed_json` before storing to avoid duplication.
- **`discharge_date`**: The actual date of the hospital discharge, used to calculate "Day X of Recovery" on the Home screen.
- The `'fhir'` value in the `raw_input_type` check constraint is scaffolded for future HL7 FHIR integration (receiving structured data directly from hospital EHR systems).

---

#### `medications` table

```sql
CREATE TABLE IF NOT EXISTS medications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discharge_id  UUID NOT NULL REFERENCES discharges(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  dose          TEXT,
  frequency     TEXT,
  times         TEXT[] NOT NULL DEFAULT '{}',
  instructions  TEXT
);
```

Medications are stored both inside `discharges.parsed_json` (as part of the full JSON blob) and here in their own table. This is called denormalization — storing the same data in two places for query performance. The reason: to look up today's medications for a user, you can do a simple `JOIN` on `medications.discharge_id → discharges.user_id` rather than extracting from JSONB, which is less efficient for frequent queries.

The `times` column is a PostgreSQL text array (e.g., `{08:00,20:00}`). These are 24-hour time strings inferred by Claude from the medication frequency. They drive notification scheduling on the mobile side.

---

#### `check_ins` table

```sql
CREATE TABLE IF NOT EXISTS check_ins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discharge_id        UUID NOT NULL REFERENCES discharges(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  responses_json      JSONB NOT NULL DEFAULT '[]',
  red_flag_triggered  BOOLEAN NOT NULL DEFAULT false,
  completed_at        TIMESTAMPTZ,
  UNIQUE (user_id, date)
);
```

The `UNIQUE (user_id, date)` constraint ensures one check-in per user per calendar day. The `POST /checkin` endpoint uses `ON CONFLICT (user_id, date) DO UPDATE` — so if a user somehow submits twice in a day (a network retry, for example), it updates rather than erroring.

`responses_json` stores the full array of question/answer pairs (e.g., `[{"question": "Have you experienced: Fever above 101°F?", "answer": false}]`). `red_flag_triggered` is a denormalized boolean: `true` if any single answer was `true`. This makes it easy to query "did any red flags trigger today?" without parsing the JSON.

---

#### `medication_logs` table

```sql
CREATE TABLE IF NOT EXISTS medication_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id   UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_time  TIMESTAMPTZ NOT NULL,
  taken_at        TIMESTAMPTZ,
  skipped         BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (medication_id, scheduled_time)
);
```

The `UNIQUE (medication_id, scheduled_time)` constraint is important. Each dose of each medication at each scheduled time is one row. The `ON CONFLICT DO UPDATE` in the insert means you can "take" and then "re-take" the same dose (it just overwrites). `taken_at` is null when `skipped = true`. `skipped` is false when it's been taken. There's a third state: `taken_at = null` AND `skipped = false` — this represents a "missed" dose that was logged in the past but never acted on.

---

#### `refresh_tokens` table

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Raw refresh tokens are never stored. Only the SHA-256 hash of the token is stored. This means that even if the database is fully compromised, an attacker cannot use the stored hashes to impersonate users — they'd need to reverse SHA-256, which is computationally infeasible. The raw token is returned to the client once (at login/register) and never re-derivable from the database.

Refresh tokens expire after 30 days. The query to validate a refresh token is: `WHERE token_hash = $1 AND expires_at > NOW()`.

### 5.5 Auth Routes

**File:** `backend/src/routes/auth.ts`

There are four endpoints.

#### POST /auth/register

1. Validates that `email`, `password`, and `firstName` are present.
2. Validates the email against a regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
3. Calls `bcrypt.hash(password, 12)` — 12 rounds means ~240ms of compute to hash, which makes brute-force attacks much slower.
4. Inserts the user into the `users` table with `uuidv4()` as the ID.
5. Generates a JWT access token: `jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' })`. The `sub` (subject) claim is the user's UUID.
6. Generates a random refresh token: `randomBytes(64).toString('hex')` — 128 characters of cryptographic randomness.
7. Stores `sha256(refreshToken)` in `refresh_tokens` with a 30-day expiry.
8. Returns `{ user, accessToken, refreshToken }`.

If the email is already registered, PostgreSQL throws error code `23505` (unique constraint violation), which is caught and returned as a 409 Conflict.

#### POST /auth/login

1. Looks up the user by email (case-insensitive via `.toLowerCase()`).
2. Calls `bcrypt.compare(password, user.password_hash)`. This is safe even if the user doesn't exist — the code still calls bcrypt.compare with a dummy hash to prevent timing attacks (though the current code uses `!user || !await verifyPassword(...)`, which short-circuits on missing user — a subtle timing side channel, but low risk for a patient-facing app).
3. On success, generates new tokens (same as registration) and stores the new refresh token.
4. Strips `password_hash` from the returned user object: `const { password_hash: _, ...userPublic } = user`.

#### POST /auth/refresh

This is the token rotation endpoint. It:
1. Hashes the incoming refresh token with SHA-256.
2. Queries `refresh_tokens` for a matching, non-expired row.
3. **Rotates the token:** deletes the old one and inserts a new one. This is a security best practice — if a refresh token is stolen and used, the next time the legitimate client uses their copy, it'll be rejected (the hash won't exist anymore), and you can detect the theft.
4. Returns a new access token and new refresh token.

#### DELETE /auth/account

Protected by `requireAuth`. Runs `DELETE FROM users WHERE id = $1`. Because of the `ON DELETE CASCADE` foreign keys, this single delete removes all the user's discharges, medications, check-ins, medication logs, and refresh tokens. This is how "Delete my account & data" works — one SQL statement.

### 5.6 Discharge Routes

**File:** `backend/src/routes/discharge.ts`

All routes are protected by `router.use(requireAuth)` at the top, so there's no risk of forgetting to protect an individual route.

#### POST /discharge/parse (preview without saving)

This endpoint is called by `ProcessingScreen` on the mobile app. It calls Claude to parse the discharge document but does **not** write anything to the database. It returns the raw `DischargeJSON` so the user can see and review it on the Review screen before committing.

Flow:
- If `type === 'photo'`: passes the base64 directly to `parseDischargeInstructions` as an image.
- If `type === 'pdf'`: extracts text via `extractTextFromPDF(base64)` first, then passes as text to Claude.
- The language parameter is passed through so Claude can output in the user's preferred language directly.

#### POST /discharge (save confirmed discharge)

This is called when the user taps "Looks good — save my plan" on the Review screen. It runs the same Claude parsing again (yes, a second API call — this avoids needing to pass the full parsed JSON through the app URL navigation parameters) and then saves everything to the database.

The database write uses a **transaction** (explicit `BEGIN`/`COMMIT`/`ROLLBACK`). This is important: if the `discharges` insert succeeds but one of the `medications` inserts fails halfway through, the `ROLLBACK` ensures no partial data is left behind. The database is always in a consistent state.

The `provider_phone` handling: Claude may extract a phone number from the document. The backend code does `const resolvedPhone = parsedJson.provider_phone ?? provider_phone ?? null` — it prefers what Claude found, falls back to what the client sent, falls back to null. Then `delete parsedJson.provider_phone` strips it from the JSON blob before storing, so it lives in the dedicated column only.

The discharge is stored with `parsed_json = $4` AND `original_parsed_json = $4` — the same value for both initially. This means the English version is preserved as `original_parsed_json` for future translation use.

#### POST /discharge/latest/translate

Called from `SettingsScreen` when the user switches language. It:
1. Fetches the latest discharge.
2. Reads `original_parsed_json` (the English source) — not `parsed_json` — to avoid compounding translation errors.
3. If language is English, returns the original unchanged.
4. Otherwise calls `translateDischargeJSON(source, targetLanguage)` — a separate Claude call with translation-specific instructions.
5. Updates `parsed_json` with the translated version (leaves `original_parsed_json` untouched).

#### PATCH /discharge/latest

Simple update to `provider_phone`. Called from `SettingsScreen` when the user edits the care team phone number field.

#### GET /discharge/latest

Fetches the most recent discharge record for the logged-in user. The `ORDER BY created_at DESC LIMIT 1` pattern is used throughout the backend when "the current discharge" is needed. Each new upload creates a new discharge row, so the latest one is always current.

### 5.7 Medications Routes

**File:** `backend/src/routes/medications.ts`

#### GET /medications

Joins `medications` to `discharges` on `discharge_id` and filters by `d.user_id = $1`. Orders by `d.created_at DESC, m.name` — so if a user has uploaded multiple discharges, they get the medications from the most recent one, sorted alphabetically.

#### POST /medications/:id/log

Before logging, it runs an ownership check: `SELECT m.id FROM medications m JOIN discharges d ON d.id = m.discharge_id WHERE m.id = $1 AND d.user_id = $2`. This prevents one user from logging doses for another user's medication. The `medication_id` in the URL is not enough — it must belong to the authenticated user.

The insert uses `ON CONFLICT (medication_id, scheduled_time) DO UPDATE` — idempotent by design. If you tap "Take" twice, you get one row, not two.

`scheduled_time` is an ISO 8601 string constructed on the mobile device: the current date plus the scheduled `HH:MM` time. So if it's May 26th and the medication is scheduled at `08:00`, the `scheduled_time` is `2026-05-26T08:00:00.000Z` (in the device's local time zone, converted to ISO string via `toISOString()`).

#### GET /medications/logs

Returns medication logs for the past N days (default 30). The join to `medications` adds `medication_name` and `dose` to each row so the `MedLogScreen` can display medication names without a separate query.

### 5.8 Check-In Routes

**File:** `backend/src/routes/checkin.ts`

#### GET /checkin/today

This endpoint does two things depending on state:
1. If a check-in already exists for today (`WHERE user_id = $1 AND date = $2`), returns `{ completed: true, check_in: ... }`.
2. If not, fetches the latest discharge and builds the questions list from `parsed_json.red_flags`. Each red flag becomes a question: `"Have you experienced: ${flag}?"`. Returns `{ completed: false, discharge_id: ..., questions: [...] }`.

The `today` string is `new Date().toISOString().slice(0, 10)` — always UTC date. This means "today" is based on server time (UTC), not the user's local time. This is a known simplification — a user in Hawaii doing a check-in at 10pm might technically get "tomorrow's" check-in on the server. For a V1 this is acceptable.

#### POST /checkin

Takes `discharge_id` and `responses[]`. Checks `responses.some((r) => r.answer === true)` to set `red_flag_triggered`. Uses `ON CONFLICT (user_id, date) DO UPDATE` for idempotency.

### 5.9 Auth Middleware

**File:** `backend/src/middleware/auth.ts`

```typescript
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json(...); return; }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

`jwt.verify` both decodes the token and validates the signature (using `JWT_SECRET`) and the expiry. If the token is expired or tampered with, it throws. `req.userId = payload.sub` attaches the user's UUID to the request object so route handlers can access it as `req.userId` without re-parsing the token.

The `AuthRequest` interface extends `Request` to add the optional `userId` field. TypeScript requires this because the base `Request` type doesn't have `userId`.

### 5.10 The Claude AI Service

**File:** `backend/src/services/claude.ts`

This is the most important service in the entire backend. Understanding it deeply is critical.

#### The Client

```typescript
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? 'mock' });
```

A single Anthropic client instance is created at module load time. The `?? 'mock'` fallback means the module loads without throwing even if `ANTHROPIC_API_KEY` isn't set — but actual API calls will fail with an auth error. For local development without hitting the API, set `USE_MOCK_CLAUDE=true` in `.env`.

#### The Mock System

```typescript
if (process.env.USE_MOCK_CLAUDE === 'true') {
  console.log('[mock] Skipping Claude API call — returning mock discharge data');
  await new Promise((r) => setTimeout(r, 1500)); // simulate network delay
  return MOCK_DISCHARGE;
}
```

`MOCK_DISCHARGE` is a hardcoded `DischargeJSON` at the top of the file with realistic medication names, red flags, etc. Setting `USE_MOCK_CLAUDE=true` skips the real API call and returns this instantly (with a 1.5s artificial delay to simulate realistic network behavior). This lets you develop and test the full UI flow without consuming Claude API credits.

#### The System Prompt

The system prompt is the key to making Claude return structured, usable data. Every line is deliberate:

- `"Return ONLY valid JSON — no preamble, no markdown fences"` — Without this, Claude often wraps JSON in ```json ... ``` markdown code fences, which breaks JSON.parse(). There's also stripping logic as a defensive fallback.
- The schema definition tells Claude exactly what fields to populate. If a field has no data, return an empty array — this prevents undefined errors in the mobile app.
- `"Rewrite all instructions at a 6th-grade reading level"` — Discharge paperwork is often written for clinicians, not patients. This single instruction dramatically improves comprehension.
- `"Times should be in 'HH:MM' 24-hour format inferred from the frequency"` — Claude infers times from phrases like "twice daily" → `["08:00","20:00"]`. These times drive notification scheduling.
- `"provider_phone: the doctor's... phone number if present anywhere in the document"` — Claude searches the entire document for a phone number so the tap-to-call feature works without the user manually entering it.
- `"If the image is too blurry... respond with ONLY this JSON: {'parse_error':'illegible'}"` — The illegibility detection. Claude returns a specific error marker instead of hallucinating data from a bad image.

#### Language Support

The language parameter modifies the system prompt:
```typescript
const systemPrompt = language === 'English'
  ? SYSTEM_PROMPT
  : `${SYSTEM_PROMPT}\nOutput all text in ${language}. Do not translate medication names or dosages.`;
```

The key constraint — "Do not translate medication names or dosages" — prevents Claude from translating "Metoprolol 25mg" into a Spanish equivalent that doesn't exist, which could confuse patients at the pharmacy.

#### JSON Extraction

After Claude returns text, several defensive parsing steps run:
1. Strip markdown code fences if present: `raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')`
2. Find the outermost JSON object: `start = raw.indexOf('{')`, `end = raw.lastIndexOf('}')`. This handles cases where Claude adds a sentence like "Here is the extracted data: {...}".
3. `JSON.parse(raw.slice(start, end + 1))` — actual parsing.
4. Check for `parsed.parse_error === 'illegible'` — if found, throw a user-friendly error message.

#### The Translation Function

`translateDischargeJSON` is a separate Claude call specifically for translating existing discharge data. The rules passed to Claude are strict:
- Preserve exact JSON structure and all keys.
- Translate instructional text.
- Do NOT translate medication names.
- Do NOT change dosage amounts or units.
- Do NOT change time strings.

This ensures that medication times (`"08:00"`) remain parseable by the notification scheduler after translation.

### 5.11 The PDF Extraction Service

**File:** `backend/src/services/pdfExtract.ts`

```typescript
export async function extractTextFromPDF(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  const data = await pdfParse(buffer);
  if (!data.text?.trim()) {
    throw new Error('No readable text found in PDF. The file may be scanned or image-only.');
  }
  return data.text;
}
```

`pdf-parse` is a Node.js library that reads PDF binary data and extracts the text layer. PDFs come in two types:
- **Text PDFs** (generated digitally, e.g., exported from a hospital portal): have a text layer that `pdf-parse` extracts perfectly.
- **Scanned PDFs** (a physical document photographed and saved as PDF): are essentially images inside a PDF wrapper. `pdf-parse` cannot extract text from these.

If `data.text?.trim()` is empty, it throws with a user-friendly message. When this happens, the user should be told to take a photo of the document instead of uploading the PDF.

The function receives the PDF as a base64 string (since that's how the mobile app sends it), converts it to a `Buffer`, and passes it to `pdf-parse`.

### 5.12 TypeScript Types

**File:** `backend/src/types/index.ts` (mirrors `shared/types/index.ts`)

The key types:

- **`DischargeJSON`** — The exact schema Claude is asked to produce. Every field maps directly to something displayed in the mobile app. `provider_phone` is optional (`?`) because it may not be present in all discharge documents.

- **`DischargeRecord`** — What the `discharges` table row looks like when returned from the API. Includes the UUID, timestamps, and the `parsed_json` blob.

- **`MedicationRecord`** — A single row from the `medications` table. The `times` field is a string array of `"HH:MM"` strings.

- **`MedicationLog`** — A row from `medication_logs`. Note `taken_at` is nullable and `skipped` is boolean. The Home screen derives status from these: `skipped=true` → "Skipped", `taken_at != null` → "Taken", both null/false → "Missed".

- **`CheckIn`** — A row from `check_ins`. The `responses_json` field holds the full question/answer array.

- **`ApiResponse<T>`** — The standard API response wrapper. Every successful endpoint returns `{ data: T }`. Errors return `{ error: string }`. This consistent envelope makes the mobile-side `api.get/post` wrappers trivial to type.

---

## 6. The Mobile App in Depth

### 6.1 App Entry Point

**File:** `mobile/App.tsx`

```typescript
export default function App() {
  const { loadFromStorage } = authStore();
  useEffect(() => {
    async function init() {
      await loadFromStorage();
      const { refreshToken, refresh, logout } = authStore.getState();
      if (refreshToken) {
        const success = await refresh();
        if (!success) await logout();
      }
    }
    init();
  }, []);
  return <><StatusBar style="light" /><AppNavigator /></>;
}
```

On mount, `App.tsx` does two things:
1. **Loads persisted auth from AsyncStorage** — `loadFromStorage()` reads `accessToken`, `refreshToken`, and `user` from `@react-native-async-storage/async-storage` and hydrates the Zustand `authStore`. This is how the app remembers the user across app restarts.
2. **Proactively refreshes the access token** — If there's a refresh token in storage, it immediately calls `refresh()` to get a fresh access token. This prevents the first API call after app launch from hitting a 401 because the stored access token expired overnight. If the refresh fails (the 30-day refresh token itself expired), it calls `logout()`, which clears storage and forces the user back to the Welcome screen.

The `StatusBar style="light"` makes the iOS status bar text white, which works on CuraPath's dark backgrounds.

### 6.2 Navigation Architecture

**File:** `mobile/src/navigation/AppNavigator.tsx`

The navigation system has two conceptually separate "worlds":

**Unauthenticated world** (when `user` is null in `authStore`):
- `Welcome` → `Register` → `Permissions` → `Tabs`
- `Welcome` → `Login` → `Tabs`

**Authenticated world** (when `user` is set):
- `Tabs` (the tab navigator, always the base)
- Modal screens presented on top of Tabs: `Upload`, `Processing`, `Review`, `CheckIn`, `RedFlagAlert`
- `Permissions` (also accessible post-login for first-time notification setup)

The conditional logic in `AppNavigator`:
```typescript
{user ? (
  <>
    <Stack.Screen name="Tabs" component={TabNavigator} />
    {/* modal screens */}
  </>
) : (
  <>
    <Stack.Screen name="Welcome" component={WelcomeScreen} />
    {/* auth screens */}
  </>
)}
```

Because React Navigation only renders screens that exist in the current navigator, when `user` changes from `null` to a value (on login), React Navigation automatically transitions from the auth screens to the `Tabs` screen. No explicit `navigation.navigate('Tabs')` call is needed — the state change triggers the re-render which changes which screens are in the navigator.

**Modal presentations:** Several screens are presented as modals (`presentation: 'modal'`). This gives them the iOS slide-up-from-bottom animation. `gestureEnabled: false` on `Processing` and `Review` prevents the user from swiping down to dismiss while AI processing is happening or while on the review screen before confirming.

**The Tab Navigator:** Four tabs — Home, Instructions, MedLog, Settings — with emoji icons. The `TabIcon` component maps route names to emoji and applies `opacity: focused ? 1 : 0.4` for the active/inactive state. The `tabBarStyle`, `tabBarActiveTintColor`, and `tabBarInactiveTintColor` all pull from the theme so they adapt to dark/light mode.

**Notification deep linking:** `AppNavigator` sets up a notification response listener:
```typescript
const sub = Notifications.addNotificationResponseReceivedListener((response) => {
  handleNotificationData(response.notification.request.content.data);
});
```
When a user taps a notification, this fires. The notification's `data` object (set when the notification was scheduled) contains a `screen` key. If `screen === 'CheckIn'`, it navigates directly to the CheckIn screen. If `screen === 'MedReminder'`, it navigates to the Tabs (so the user lands on the Home screen where they can take the medication). `Notifications.getLastNotificationResponseAsync()` handles the case where the app was closed and the user launched it by tapping the notification.

### 6.3 Zustand Stores

#### `authStore` — `mobile/src/store/authStore.ts`

This is the most important store. It manages:
- `user: UserProfile | null` — the logged-in user's profile
- `accessToken: string | null` — the current JWT (expires in 1 hour)
- `refreshToken: string | null` — the long-lived token (expires in 30 days)
- `isLoading: boolean` — true while `loadFromStorage` is running, used by `AppNavigator` to render `null` (blank screen) instead of briefly flashing the wrong auth state

**`setAuth(user, accessToken, refreshToken)`:** Called on login/register. Saves all three values to `AsyncStorage` (for persistence) and to in-memory Zustand state (for reactive UI updates) in one atomic operation. `AsyncStorage.multiSet([...])` writes all keys in a single operation.

**`refresh()`:** Makes a raw `fetch` call (not the `api` wrapper, to avoid circular dependency) to `POST /auth/refresh`. If successful, updates both AsyncStorage and in-memory state with the new tokens. Returns `true` or `false` so callers know whether the refresh succeeded.

**`logout()`:** Removes all three AsyncStorage keys with `multiRemove` and clears the in-memory state. Because `user` becomes `null`, `AppNavigator` re-renders and the auth screens appear.

**`loadFromStorage()`:** Called once at app startup (in `App.tsx`). Uses `AsyncStorage.multiGet(['accessToken', 'refreshToken', 'user'])` to read all three values in one round trip. Sets `isLoading: false` when done so the navigator can render.

Note that `authStore` is used directly in `api/client.ts` via `authStore.getState()`. This is valid Zustand usage — `.getState()` is a synchronous read of the current state outside of a React component. It's the reason `authStore` is exported as a bare `create(...)` result rather than wrapped in `useAuthStore()`.

#### `dischargeStore` — `mobile/src/store/dischargeStore.ts`

```typescript
export const dischargeStore = create<DischargeState>((set) => ({
  discharge: null,
  medications: [],
  setDischarge: (discharge) => set({ discharge }),
  setMedications: (medications) => set({ medications }),
  clear: () => set({ discharge: null, medications: [] }),
}));
```

Intentionally simple — just an in-memory cache. There is no AsyncStorage persistence here. On app cold start, `HomeScreen` fetches the latest discharge from the API and populates this store. This is why `HomeScreen` does `if (!discharge)` before fetching — on warm restarts (app still in memory), the store is already populated.

`clear()` is called on logout and on account deletion to wipe the in-memory discharge data.

### 6.4 The API Client Layer

**File:** `mobile/src/api/client.ts`

This is the core of all network communication. Every API call in the app goes through this single `request<T>()` function.

```typescript
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
```

The `EXPO_PUBLIC_` prefix is Expo's convention for environment variables that are embedded into the app bundle at build time. In production builds (`eas.json` production profile), `EXPO_PUBLIC_API_URL` is set to `https://api.curapath.app`. During local development, it falls back to localhost.

**The request flow:**
1. Gets the current `accessToken` from `authStore.getState()` (synchronous Zustand read).
2. Injects `Authorization: Bearer <accessToken>` into headers.
3. Creates an `AbortController` and sets a 60-second timeout with `setTimeout`. This handles the case where the Claude API call takes a long time — without this, the request could hang indefinitely.
4. Makes the `fetch` call with `signal: controller.signal`.
5. Clears the timeout in `finally` regardless of outcome.
6. If the response is `401`:
   - Calls `authStore.getState().refresh()`.
   - If refresh succeeds, retries the original request with the new token.
   - If refresh fails, calls `logout()` and throws `"Session expired"`.
7. If any other non-OK status: parses the error body and throws.
8. Otherwise: returns `res.json()`.

The API module exports a typed object:
```typescript
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

All four REST verbs, all returning the generic `T`. Usage: `api.get<ApiResponse<MedicationRecord[]>>('/medications')` — TypeScript infers the response type.

The route-specific modules (`api/discharge.ts`, `api/medications.ts`, etc.) are thin wrappers over `api.post/get/patch` that:
1. Encode the correct path.
2. Provide named functions with typed parameters.
3. Return the correct `ApiResponse<T>` type.

### 6.5 The Theme System

**Files:** `mobile/src/theme/index.ts` and `mobile/src/hooks/useTheme.ts`

The theme system is the backbone of CuraPath's polished UI. Understanding it is necessary before reading any screen code.

**The `Colors` type** defines 30+ semantic color tokens — not raw colors like "dark blue," but role-based names like:
- `bg` — primary background
- `bgAlt` — slightly different background (for modal sheets, form screens)
- `bgWelcome` — deep indigo background used only on the welcome screen
- `bgAlert` — dark red tint, used on `RedFlagAlertScreen`
- `surface` / `surfaceStrong` — card backgrounds (translucent white on dark, translucent black on light)
- `surfaceAccent` / `surfaceDanger` / `surfaceSuccess` — tinted card backgrounds
- `border` / `borderMed` / `borderAccent` / `borderDanger` — border colors at different opacities
- `textPrimary` / `textSecondary` / `textTertiary` / `textMuted` — four levels of text hierarchy
- `accent` — the primary brand color (`#4f7eff`, a periwinkle blue, same in both themes)
- `success` — green (`#34d399` dark / `#10b981` light)
- `danger` — red (`#ef4444`, same in both themes)

**Why semantic tokens instead of hardcoded colors:** Every screen does `const C = useTheme()` and then uses `C.textPrimary`, `C.surface`, etc. If you ever want to change the brand color, you change it in one place (`theme/index.ts`) and it updates everywhere. More importantly, dark/light mode is handled automatically — screens don't need `if (isDark) ... else ...` logic anywhere.

**The `useTheme` hook:**
```typescript
export function useTheme() {
  const scheme = useColorScheme();
  return scheme === 'light' ? light : dark;
}
```

`useColorScheme()` is a React Native hook that returns `'light'`, `'dark'`, or `null`. The hook returns the `dark` palette by default (when `null`, or when the system is in dark mode). This means CuraPath defaults to dark mode even if the system preference is unknown.

**The `makeStyles` pattern:** Every screen follows this exact pattern:
```typescript
const C = useTheme();
const styles = useMemo(() => makeStyles(C), [C]);
```

`makeStyles` is a function at the bottom of each screen file that takes the `Colors` object and returns a `StyleSheet.create({...})` result. The `useMemo` ensures `StyleSheet.create` is only called when the color scheme actually changes (which is rare — maybe once or twice during a session at most). Without `useMemo`, it would run on every render.

### 6.6 The Notifications System

**File:** `mobile/src/hooks/useNotifications.ts`

The notifications module exports standalone async functions (not a React hook, despite the file location). This is because notifications need to be scheduled from inside `ReviewScreen`'s `handleConfirm` function — not from a hook's `useEffect`.

#### Check-In Reminders

`scheduleCheckInReminder(hour, minute)`:
1. Cancels any existing check-in notification (to avoid duplicates).
2. Checks/requests notification permissions.
3. Schedules a `DAILY` notification at the specified hour and minute.
4. Saves the notification ID to AsyncStorage (`checkin_notif_id`) so it can be cancelled later.

The notification content:
- Title: "Morning check-in"
- Body: "How are you feeling today? Tap to complete your daily symptom check."
- Data: `{ screen: 'CheckIn' }` — this is what `AppNavigator`'s notification handler uses to navigate to CheckIn when tapped.

Settings (enabled, hour, minute) are persisted in AsyncStorage (`checkin_enabled`, `checkin_time`) so the Settings screen can restore them after an app restart.

#### Medication Reminders

`scheduleMedReminders(medications)`:

This function does something clever — it groups medications by time slot:
```typescript
const timeMap = new Map<string, MedicationRecord[]>();
for (const med of medications) {
  for (const time of med.times) {
    if (!timeMap.has(time)) timeMap.set(time, []);
    timeMap.get(time)!.push(med);
  }
}
```

If Metoprolol is at 08:00 and Lisinopril is also at 08:00, instead of two separate notifications at 8am, one notification fires: "Time to take your medications: Metoprolol 25mg · Lisinopril 10mg". This reduces notification fatigue.

For each time slot, two notifications are scheduled:
1. **The reminder itself** at the exact scheduled time.
2. **A missed-dose nudge** at 30 minutes past the scheduled time: "Did you take your medications? [list] — due 30 minutes ago."

Both are scheduled with `interruptionLevel: 'timeSensitive'`. This is a critical iOS feature — Time Sensitive notifications break through Focus modes (Do Not Disturb, Sleep, Work Focus, etc.) and appear on the lock screen even when other notifications are suppressed. This is the correct behavior for medication reminders to a recovering patient.

The Time Sensitive entitlement (`com.apple.developer.usernotifications.time-sensitive`) must be declared in `app.json`:
```json
"entitlements": {
  "com.apple.developer.usernotifications.time-sensitive": true
}
```
Without this entitlement, the app would not be allowed to schedule Time Sensitive notifications, and the `interruptionLevel` setting would be silently ignored.

All notification IDs are saved to AsyncStorage (`med_notif_ids`) as a JSON array. `cancelAllMedReminders()` reads this list and cancels each notification individually. This is called before rescheduling (when a new discharge is uploaded with different medications) to clear old notifications.

### 6.7 Language / Translation System

**File:** `mobile/src/hooks/useLanguage.ts`

14 languages are supported: English, Spanish, French, Chinese (Simplified), Arabic, Hindi, Portuguese, Russian, Japanese, Korean, Vietnamese, Tagalog, German, Italian.

Each language has three properties: `code` (e.g., `'es'`), `name` (e.g., `'Spanish'` — this is what's sent to Claude), and `nativeName` (e.g., `'Español'` — this is what's displayed in the UI).

The preferred language is persisted to AsyncStorage under the key `preferred_language`. On `SettingsScreen`, the language picker opens a bottom sheet modal (`Modal` with `animationType="slide"`) listing all languages. Selecting one:
1. Saves the new preference to AsyncStorage.
2. Calls `translateDischarge(item.name)` — the API call that triggers Claude translation.
3. Updates `dischargeStore` with the translated discharge.
4. Shows an `ActivityIndicator` while translation is in progress.

If a user changes language and the translation fails, an `Alert.alert` shows and the language preference is reverted in storage.

### 6.8 Each Screen Explained

#### WelcomeScreen

The entry point for unauthenticated users. Dark indigo background (`C.bgWelcome`). Two buttons: "Get started" → Register, "I already have an account" → Login. Contains the `Disclaimer` component which shows the "not medical advice" text. The logo is a 🏥 emoji inside a rounded square.

#### RegisterScreen

Fields: first name, last name (optional), email, password. Client-side validation (email regex, password length ≥ 8) before making the API call. Captures the device timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` and sends it with the registration. On success: calls `authStore.setAuth(...)` which persists tokens and navigates to `Permissions`.

#### LoginScreen

Simpler than Register — just email and password. On success: calls `authStore.setAuth(...)`. The navigator picks up the `user` state change and renders the authenticated stack automatically.

#### PermissionsScreen

Shown after registration to explain the notification benefits before requesting permission. Lists three benefits (daily check-in, medication reminders, missed-dose alerts). Two buttons: "Enable notifications" (calls `Notifications.requestPermissionsAsync()`) and "Not now" (skips). Both navigate to `Tabs`. This is a one-time screen — it's not accessible from the main app after permissions are granted or denied.

#### HomeScreen

The main dashboard. On mount, `useEffect` calls:
1. `getLatestDischarge()` (if not already in store)
2. `getMedications()`
3. `getMedicationLogs(1)` (last 1 day, to know which doses are already taken today)
4. `getTodayCheckIn()` (to know if check-in is done)

If no discharge exists, shows the empty state with an "Upload instructions" button.

If a discharge exists, shows:
- **Greeting:** "Good Morning, {firstName}" (firstName from `user.first_name` or falls back to email prefix)
- **Day counter:** "Day X of Recovery" — calculated as `Math.floor((Date.now() - new Date(discharge.created_at).getTime()) / 86400000)`
- **Progress bar:** A visual track showing progress through a 30-day recovery window
- **Check-in card:** Only shown if `!checkInDone`. Shows the number of red flag questions.
- **Today's Medications:** Each medication with per-time-slot "Take {time}" buttons. The `takenKeys` Set uses `${medicationId}_${time}` as keys so each individual dose slot can be tracked. Already-taken slots show "✓ {time}" instead of a button.
- **Activity Reminders:** The `activity_restrictions` array from `parsed_json`, shown as list items.
- **Disclaimer** at the bottom.

`handleMedAction` constructs the ISO timestamp for `logMedication`: takes today's date, sets hours/minutes from the time string, calls `logMedication(med.id, today.toISOString(), action)`.

#### InstructionsScreen

A scrollable read-only view of all discharge instructions. Shows all eight fields from `parsed_json`:
- Red flags as red-tinted pills
- Medications in cards with name, dose, frequency, times
- Activity restrictions as pills
- Follow-up appointments (type + timeframe)
- Diet restrictions as green-tinted pills
- Wound care as pills
- Sleeping instructions as pills
- Exercises in cards

An "Update instructions" button navigates to the Upload screen. The discharge date is shown in the header.

#### UploadScreen

Three options: camera, photo library, PDF. Uses `expo-image-picker` for photos and `expo-document-picker` + `expo-file-system` for PDFs.

For camera/library: `launchCameraAsync/launchImageLibraryAsync` with `quality: 0.8` (80% JPEG quality — good balance of quality vs. file size) and `base64: true` (the base64 flag tells expo-image-picker to include the base64 data in the result). On success, navigates to `Processing` with `{ type: 'photo', base64 }`.

For PDF: `DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true })`. The `copyToCacheDirectory: true` ensures the file is copied to a location the app can read. Then `FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })` converts the file to base64. Navigates to `Processing` with `{ type: 'pdf', base64 }`.

#### ProcessingScreen

This screen serves two purposes: showing the user something while the Claude API call runs (which takes 5-20 seconds), and actually making the API call.

There's an animated step list that advances every 1800ms:
1. "Document received"
2. "Reading text from image"
3. "Extracting medications & instructions"
4. "Building your daily plan"

Meanwhile, `process()` async function:
1. Gets the preferred language.
2. Calls `parseDischarge(type, { base64, text, mediaType, language })` → `POST /discharge/parse`.
3. On success: clears the interval, sets step to the last step, waits 600ms (so the user sees "Building your daily plan" briefly), then navigates to `Review`.
4. On error: shows an alert with the error message and a "Try again" button that goes back to `Upload`.

**Why parse first without saving?** The two-step approach (parse → review → save) lets the user verify Claude's output before it's committed to the database. This is critical for a medical context — if Claude misreads "20mg" as "200mg", the user can catch it before it's saved.

#### ReviewScreen

Shows the parsed `DischargeJSON` from `Processing`'s navigation params in a readable format. The user sees exactly what will be saved.

Two actions:
- **"Looks good — save my plan"** → `handleConfirm()`: calls `uploadPhoto()` or `uploadPDF()` (the actual save endpoint), fetches medications, schedules notifications, replaces to `Tabs`.
- **"Something's wrong — re-enter instructions"** → `navigation.replace('Upload')`.

Note that `handleConfirm` calls Claude again (via `uploadPhoto`/`uploadPDF` → `POST /discharge`) — this is a second Claude API call on the same document. This is a tradeoff: it keeps the API surface clean (the save endpoint always parses) and avoids passing the full `parsedJson` blob through the navigation stack to the save endpoint.

After saving, `scheduleMedReminders(medsRes.data)` is called with the freshly-fetched medications. This is when iOS medication notifications are registered.

#### CheckInScreen

A one-question-at-a-time quiz interface. On mount, calls `getTodayCheckIn()`. If already completed, immediately goes back. Otherwise loads the questions array.

Each question is displayed individually with "Yes" and "No" buttons. The "Yes" button has a danger-red tint because answering yes means a red flag is present. The "No" button has a success-green tint (no red flag).

On the last question, `answer()` calls `submitCheckIn(dischargeId, responses)`. If `res.data.red_flag_triggered` is true, it navigates to `RedFlagAlertScreen` passing the triggered flags and the `provider_phone` from `dischargeStore`. Otherwise it just goes back to Home.

A progress bar at the top fills as the user advances through questions.

#### RedFlagAlertScreen

A high-urgency screen with:
- Dark red background (`C.bgAlert`)
- "Contact Your Care Team" heading in danger-red
- List of the specific triggered red flags
- A big "Call {providerPhone}" button if the phone number is available
- If no phone number: a "Add Your Doctor's Number" button that navigates to Settings
- A "I'll handle this later" dismiss button
- An emergency disclaimer ("call 911")

The call button uses `Linking.openURL('tel:${providerPhone}')` — the native iOS phone dialer.

This screen has `gestureEnabled: false` in its stack options, meaning the user cannot swipe it away. They must explicitly tap "I'll handle this later." This is intentional — it forces them to consciously acknowledge the warning.

#### MedLogScreen

A 30-day adherence history. Calls `getMedicationLogs(30)` on focus (using `useFocusEffect` so it refreshes every time the tab is visited). Renders a `FlatList` of log entries showing:
- A colored status dot (green = taken, amber = skipped, red = missed)
- Medication name and dose
- Scheduled time (formatted with `toLocaleString()`)
- Status label ("Taken", "Skipped", "Missed")

Status derivation: `item.skipped ? 'skip' : item.taken_at ? 'taken' : 'pending'` — where 'pending' represents a past scheduled dose that was neither taken nor skipped (missed).

#### SettingsScreen

The most complex screen. Sections:
- **Account:** Shows the user's email (read-only).
- **Care team:** An editable `TextInput` for the provider phone number. Uses `onBlur` (when the field loses focus) to call `updateProviderPhone()` → `PATCH /discharge/latest`. This auto-saves without a separate "Save" button.
- **Notifications:** A `Switch` to enable/disable daily check-in reminders. When enabled, a custom time picker appears (hour, minute, AM/PM with up/down buttons in 1-hour/5-minute increments). Changes are saved immediately via `saveCheckInNotifSettings()`.
- **Language:** Shows the current language's `nativeName`. Tapping opens a bottom sheet `Modal` with a `FlatList` of all 14 supported languages. Selecting one triggers translation.
- **Legal:** The medical disclaimer text.
- **Actions:** "Log out" and "Delete my account & data" buttons.

Account deletion shows a destructive `Alert.alert` confirmation. On confirm: calls `deleteAccount()` → `DELETE /auth/account`, then `logout()` and `clear()`.

---

## 7. Key User Flows — Step by Step

### 7.1 First-Time Registration Flow

1. App launches → `App.tsx` runs `loadFromStorage()` → `user = null` → `isLoading: false`.
2. `AppNavigator` renders the auth stack with `Welcome` as the initial screen.
3. User taps "Get started" → `RegisterScreen`.
4. User fills in first name, email, password, taps "Create account".
5. Client-side validation passes.
6. `register(email, password, timezone, firstName, lastName)` → `POST /auth/register`.
7. Backend: hashes password, inserts user, generates tokens, stores refresh token hash.
8. Response: `{ data: { user, accessToken, refreshToken } }`.
9. `authStore.setAuth(user, accessToken, refreshToken)` → writes to AsyncStorage + in-memory state.
10. `navigation.navigate('Permissions')`.
11. User taps "Enable notifications" → `Notifications.requestPermissionsAsync()` → iOS permission dialog.
12. `navigation.replace('Tabs')` — the app is now in the authenticated state, `HomeScreen` appears.
13. `HomeScreen` fetches latest discharge (gets 404 because no discharge yet) → shows empty state.

### 7.2 Returning User Login + Session Persistence Flow

**Cold start (app was killed):**
1. `App.tsx` runs `loadFromStorage()` → reads `accessToken`, `refreshToken`, `user` from AsyncStorage → `authStore` is hydrated.
2. Since `refreshToken` exists, `refresh()` is called → `POST /auth/refresh` with the stored refresh token.
3. Backend validates the hash, rotates the refresh token, returns new tokens.
4. New tokens saved to AsyncStorage.
5. `AppNavigator` sees `user !== null` → renders authenticated stack → `HomeScreen`.

**Warm start (app still in memory):**
1. `authStore` is already populated from last session.
2. `App.tsx` calls `loadFromStorage()` again but this just re-reads AsyncStorage — it doesn't break anything, just redundantly confirms state.
3. The token refresh still runs — this ensures freshness even for very long-running app sessions.

### 7.3 Discharge Upload Flow (The Core Feature)

1. User is on `HomeScreen` → taps "Upload instructions" (empty state) or goes to `Upload` tab via Instructions screen's "Update instructions" button.
2. `UploadScreen` presents three options.
3. **Photo path:** User takes photo or picks from library. `expo-image-picker` returns base64 at 80% quality. `navigation.replace('Processing', { type: 'photo', base64 })`.
4. **PDF path:** User picks PDF. `expo-document-picker` returns URI. `expo-file-system` reads it as base64. `navigation.replace('Processing', { type: 'pdf', base64 })`.
5. `ProcessingScreen` mounts. The step animation starts. `process()` runs:
   - Gets preferred language from AsyncStorage.
   - Calls `parseDischarge(type, { base64, mediaType: 'image/jpeg', language })` → `POST /discharge/parse`.
6. Backend `/discharge/parse`:
   - If photo: passes base64 image to Claude with multimodal content.
   - If PDF: `extractTextFromPDF(base64)` → `pdf-parse` extracts text → sends text to Claude.
   - Claude's response is stripped of markdown fences, JSON-extracted, parsed.
   - If `parse_error === 'illegible'`, throws user-friendly error.
   - Returns `DischargeJSON`.
7. If Claude fails (illegible, or network error): `ProcessingScreen` shows alert "Could not read instructions" with "Try again" → back to `Upload`.
8. If Claude succeeds: navigate to `Review` with `{ parsedJson, uploadParams }`.
9. `ReviewScreen` shows all extracted data in grouped sections.
10. User reviews and taps "Looks good — save my plan".
11. `handleConfirm()`:
    - Calls `uploadPhoto(base64, 'image/jpeg', { language })` or `uploadPDF(base64, { language })` → `POST /discharge`.
    - Backend: parses with Claude (second call), wraps in transaction, inserts discharge + medications.
    - Returns the saved `DischargeRecord`.
    - `setDischarge(res.data)` → updates `dischargeStore`.
    - `getMedications()` → fetches the newly-created medication rows.
    - `setMedications(medsRes.data)`.
    - `scheduleCheckInReminder(hour, minute)` — registers daily 8am reminder.
    - `scheduleMedReminders(medsRes.data)` — registers per-medication Time Sensitive notifications.
    - `navigation.replace('Tabs')` → `HomeScreen`.

### 7.4 Daily Check-In Flow

1. `HomeScreen` shows check-in card if `!checkInDone`.
2. User taps the card → `navigation.navigate('CheckIn')`.
3. `CheckInScreen` calls `getTodayCheckIn()` → `GET /checkin/today`.
4. If already completed: `navigation.goBack()` immediately.
5. Otherwise: displays questions from red flags.
6. User answers each question one by one with Yes/No buttons.
7. On final question: `submitCheckIn(dischargeId, responses)` → `POST /checkin`.
8. Backend: stores responses, sets `red_flag_triggered = responses.some(r => r.answer === true)`.
9. If `red_flag_triggered`: `navigation.replace('RedFlagAlert', { triggeredFlags, providerPhone })`.
10. If not: `navigation.goBack()` to Home, where `checkInDone` becomes true (the card disappears).

### 7.5 Medication Logging Flow

1. `HomeScreen` shows medication cards with per-time-slot "Take {time}" buttons.
2. User taps a Take button for, say, "Metoprolol 08:00".
3. `handleMedAction(med, '08:00', 'taken')`:
   - Constructs ISO timestamp: today's date with hours=8, minutes=0.
   - Calls `logMedication(med.id, isoTimestamp, 'taken')` → `POST /medications/{id}/log`.
4. Backend verifies ownership (the medication must belong to the current user via discharge join).
5. `ON CONFLICT (medication_id, scheduled_time) DO UPDATE` — idempotent.
6. Sets `taken_at = now()`, `skipped = false`.
7. `setTakenKeys((prev) => new Set(prev).add('${med.id}_08:00'))` — local state update.
8. The button immediately re-renders as "✓ 08:00" (optimistic-style update via local state).

### 7.6 Red Flag Alert Flow

1. CheckIn completes with at least one `answer = true`.
2. `navigation.replace('RedFlagAlert', { triggeredFlags: [...], providerPhone: '555-867-5309' })`.
3. `RedFlagAlertScreen` shows the triggered flags and a "Call 555-867-5309" button.
4. If user taps call: `Linking.openURL('tel:555-867-5309')` → native iOS phone dialer opens.
5. If `providerPhone` is null: "Add Your Doctor's Number" button navigates to Settings.
6. User can dismiss with "I'll handle this later" → `navigation.popToTop()` (returns to Tabs).
7. `gestureEnabled: false` prevents accidental swipe dismissal.

### 7.7 Language Translation Flow

1. User opens Settings → taps "Instructions language" → language picker modal opens.
2. User selects, say, "Español".
3. `setPreferredLanguage({ code: 'es', name: 'Spanish', nativeName: 'Español' })` → saved to AsyncStorage.
4. `setTranslating(true)` → spinner shows in the language row.
5. `translateDischarge('Spanish')` → `POST /discharge/latest/translate { language: 'Spanish' }`.
6. Backend:
   - Fetches latest discharge.
   - Reads `original_parsed_json` (English source).
   - Calls `translateDischargeJSON(source, 'Spanish')` → Claude translation call.
   - Claude rule: "Do NOT translate medication names or dosages, preserve all time strings."
   - Updates `parsed_json` with Spanish content.
   - Returns updated discharge row.
7. `setDischarge(res.data)` → `dischargeStore` updated with Spanish discharge.
8. `setTranslating(false)`.
9. All screens that read from `dischargeStore` now show Spanish content.

Next time the user uploads a new discharge with Spanish set as preference, the `parseDischargeInstructions` call includes `language: 'Spanish'` and Claude outputs Spanish directly.

### 7.8 Token Refresh Flow

**Triggered automatically in `api/client.ts`:**
1. Any API call returns 401 (access token expired after 1 hour).
2. `authStore.getState().refresh()` is called.
3. `POST /auth/refresh { refreshToken: storedRefreshToken }`.
4. Backend: SHA-256 hashes the incoming token, queries `refresh_tokens`.
5. If found and not expired: delete old token, insert new token (rotation), return new access token + new refresh token.
6. `authStore` updates both AsyncStorage and in-memory with new tokens.
7. The original failed request is retried with the new access token.
8. The retry result is returned to the original caller — the caller never knows a refresh happened.

**If refresh fails (30-day token expired):**
1. `authStore.getState().logout()` → clears AsyncStorage + in-memory state.
2. `throw new Error('Session expired')`.
3. `AppNavigator` sees `user = null` → auth screens appear.
4. User sees the login screen and must log in again.

---

## 8. AWS Infrastructure In Depth

### Elastic Beanstalk

**Environment name:** `curapath-backend-env`  
**Region:** `us-east-2` (Ohio)  
**Platform:** Node.js 24 on Amazon Linux 2023  
**Tier:** Web Server (load-balanced), 1-2 instances  
**Instance type:** t3.micro (2 vCPU, 1GB RAM — appropriate for low-medium traffic)  

Elastic Beanstalk abstracts EC2, Auto Scaling Groups, and the Application Load Balancer. You deploy by running `eb deploy` (after `npm run build`), and Beanstalk:
1. Zips the application code.
2. Uploads it to S3.
3. Signals each EC2 instance to download and run the new version.
4. Performs a rolling deployment by default (keeps old version running until new version is healthy).

**The Procfile:** `web: node dist/server.js` tells Beanstalk which command to run to start the web process. Beanstalk's Nginx proxy forwards HTTP traffic to this Node.js process on whatever port the `PORT` environment variable specifies (Beanstalk sets this automatically).

**`.ebextensions/nodecommand.config`:** Sets `NODE_ENV=production` as an environment variable. This is important because some libraries behave differently in production mode (e.g., Express error handling, logging verbosity).

### Application Load Balancer (ALB)

Beanstalk creates and manages the ALB automatically. It has two listeners:
- **HTTP:80** — redirects to HTTPS:443.
- **HTTPS:443** — terminates SSL and forwards to the backend EC2 instances.

SSL termination at the ALB means the EC2 instances receive plain HTTP traffic internally (which is fine because it's within AWS's private VPC network). The ACM certificate covers both `curapath.app` and `api.curapath.app` so both domains are HTTPS.

### Route 53

The hosted zone for `curapath.app` has:
- **A record for `api.curapath.app`** — aliased to the ALB's DNS name. An alias record is AWS-specific and preferred over CNAME because it's free and has better health-check integration.
- **A records for `curapath.app`** — pointing to GitHub Pages' IP addresses (for the marketing website).
- **CNAME for `www.curapath.app`** — pointing to `kpothuganti.github.io`.

### ACM Certificate

An AWS Certificate Manager (ACM) certificate was issued for `curapath.app` and `api.curapath.app` using DNS validation (ACM creates a CNAME record in Route 53 to prove domain ownership). The certificate auto-renews every 13 months with no action required.

**Why the `.app` TLD matters for HIPAA:** `.app` is an HSTS-preloaded top-level domain, meaning all browsers automatically enforce HTTPS for any `.app` URL without needing an explicit HSTS header. This provides an extra layer of assurance that PHI cannot be transmitted over an unencrypted connection.

### Amazon RDS

**Instance:** `curapath-prod.crsus44ywyku.us-east-2.rds.amazonaws.com`  
**Engine:** PostgreSQL  
**Not publicly accessible** — no public IP, only accessible from within the VPC.  

The security group `curapath-rds-sg` has a single inbound rule:
- Protocol: TCP
- Port: 5432
- Source: The Beanstalk EC2 security group (not an IP range)

Using a security group as the source (rather than an IP range like `10.0.0.0/8`) is the correct approach — it means any EC2 instance with the Beanstalk security group attached can reach the database, and automatically stops working if the instance is decommissioned.

**Backups:** 7-day automated backup retention. Point-in-time recovery is possible to any second within the last 7 days.

**Encryption at rest:** AES-256 using an AWS-managed key. This means the storage volumes holding PostgreSQL data files, transaction logs, and backups are all encrypted. Even if someone physically removed a hard drive from the AWS data center, the data would be unreadable.

### S3

**Bucket:** `curapath-raw-inputs`  
Purpose: Store the original discharge uploads (photos/PDFs) for audit trail purposes (HIPAA requires maintaining records of PHI access and processing). The bucket stores raw uploaded files with S3-managed server-side encryption (SSE-S3). The `raw_input_url` column in the `discharges` table stores the S3 object key (not a presigned URL) — access requires AWS credentials, not just the key string.

---

## 9. HIPAA Compliance — What It Means and How It's Implemented

### What HIPAA Requires

HIPAA (the Health Insurance Portability and Accountability Act) requires covered entities handling Protected Health Information (PHI) to implement:
- **Administrative safeguards** — policies, training, access controls
- **Physical safeguards** — physical security of data centers
- **Technical safeguards** — encryption, audit controls, access controls, transmission security

For a software application, the technical safeguards are the primary concern.

### The Business Associate Agreement (BAA)

A BAA is a legal contract between a covered entity (CuraPath) and a "business associate" (AWS) that specifies how the business associate will handle PHI. AWS signed a BAA on May 26, 2026 via AWS Artifact. This is a prerequisite for HIPAA compliance — without a BAA, you cannot legally store PHI on AWS services.

**What the BAA covers:** All AWS services used by CuraPath that touch PHI — RDS, S3, Elastic Beanstalk, the ALB. Notably, the Anthropic API does not have a BAA. This means technically, when discharge photos are sent to Claude, PHI may be crossing a non-BAA boundary. This is a compliance gap to address in a future version, either by using a HIPAA-covered AI service or by having users agree to specific data processing terms.

### Encryption in Transit

All traffic between the mobile app and the backend is over HTTPS (TLS 1.2+). This is enforced by:
- The ACM certificate on the ALB.
- The `.app` TLD's HSTS preloading (browsers refuse unencrypted connections).
- The mobile app's `EXPO_PUBLIC_API_URL` pointing to `https://...` (not `http://`).

### Encryption at Rest

- **RDS:** AES-256 at the storage level using AWS KMS managed key. Every file on the RDS storage volume is encrypted.
- **S3:** Server-side encryption (SSE-S3) on the `curapath-raw-inputs` bucket.
- **Mobile device:** iOS encrypts all app data (including AsyncStorage) using the device passcode. This is hardware-enforced on modern iPhones with the Secure Enclave.

### Access Controls

- **Database:** Not publicly accessible. Only reachable from Beanstalk EC2 security group. No direct developer access in production (requires AWS bastion host or RDS Proxy for emergency access).
- **API:** All endpoints (except `/health`) require a valid JWT. Medication and discharge endpoints perform ownership checks.
- **Passwords:** bcrypt with 12 rounds. Even if the `users` table is dumped, passwords cannot be recovered.
- **Refresh tokens:** SHA-256 hashed before storage. Even if `refresh_tokens` is dumped, the raw tokens cannot be recovered.
- **JWT short-lived tokens:** 1-hour expiry minimizes the window of exposure if an access token is intercepted.

### Audit Controls

The `created_at` timestamps on all tables create an implicit audit trail. The `medication_logs` table records every dose action. The `check_ins` table records every daily check-in. The `discharges` table records every upload event. These records are immutable (no `DELETE` routes for these tables, only cascade delete on user deletion).

---

## 10. The Website

**Location:** `docs/` directory in the root of the repository  
**Hosting:** GitHub Pages from the `docs/` folder of the `main` branch  
**Custom domain:** `curapath.app` via the `docs/CNAME` file (which contains `curapath.app`)  

The website is purely static HTML/CSS/JavaScript — no build step, no framework. It serves as the marketing landing page for CuraPath.

`docs/index.html` contains:
- App description and feature highlights
- Screenshots from `docs/screenshots/` (medlog.PNG, instructions.PNG, home.PNG, upload.PNG, checkin.PNG)
- An early access email signup form (Google Form, field ID `entry.182712028`)
- Links to the App Store (when available)

`docs/privacy-policy.html` contains the full HIPAA-required privacy policy explaining what data is collected and how it's used.

DNS routing:
- Route 53 A records for `curapath.app` point to GitHub Pages' IP addresses.
- Route 53 CNAME `www.curapath.app` → `kpothuganti.github.io`.
- GitHub Pages is configured to serve the `docs/` folder as the website root.

---

## 11. Build, Deploy, and Release Process

### Backend Deployment

The backend is deployed to Elastic Beanstalk via the EB CLI or the AWS Console.

**Build step:** `npm run build` → runs `rimraf dist && tsc` → compiles TypeScript to `backend/dist/`.

**Deploy step:** `eb deploy` (from the `backend/` directory) — Beanstalk zips `dist/`, `package.json`, `Procfile`, and `.ebextensions/`, uploads to S3, and deploys to the EC2 instances.

**Environment variables on Beanstalk:**
All secrets (`JWT_SECRET`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`) are configured in the Beanstalk environment configuration (not in code or Procfile). They appear as environment variables to the Node.js process.

**Zero-downtime deploys:** Beanstalk's rolling update policy keeps old instances running while new ones are deployed and pass health checks, then swaps traffic.

### Mobile Build and Release (EAS)

**Local development:** `npx expo start` — starts the Expo Metro bundler. Connect a physical device via Expo Go or the dev client.

**Production build for TestFlight:**
```bash
cd mobile
eas build --platform ios --profile production
```
EAS:
1. Reads `eas.json` to get the production profile config.
2. Bundles the React Native app with `EXPO_PUBLIC_API_URL=https://api.curapath.app` injected.
3. Compiles and signs the iOS binary using Apple credentials (Apple ID: `kspothuganti@gmail.com`, Team ID: `MCR43HSC5P`, ASC App ID: `6773452586`).
4. Produces a `.ipa` file and uploads it to App Store Connect.

**Submit to App Store:**
```bash
eas submit --platform ios --profile production
```
Uses the `ascAppId` from `eas.json` to upload the already-built `.ipa` to App Store Connect's TestFlight, or all the way to the App Store for review.

**`autoIncrement: true`** in the production build profile means EAS automatically increments the build number (CFBundleVersion) with each build. The version string (CFBundleShortVersionString) is whatever is in `app.json`.

**Expo Project ID:** `18d1a7c4-85b8-4cbb-87d1-558020432957` (in `app.json`'s `extra.eas.projectId`) — this identifies the app in the Expo/EAS dashboard and is used for push notification infrastructure.

**`newArchEnabled: true`** in `app.json` enables React Native's "New Architecture" (Fabric renderer + TurboModules + JSI), which is the direction of RN's future and improves performance.

---

## 12. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port for Express server | `3000` |
| `NODE_ENV` | Runtime environment | `production` or `development` |
| `JWT_SECRET` | Secret for signing JWTs | `<random 64-char hex string>` |
| `JWT_EXPIRY` | Access token lifetime | `1h` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host/db?sslmode=require` |
| `ANTHROPIC_API_KEY` | API key for Claude | `sk-ant-...` |
| `ALLOWED_ORIGINS` | CORS whitelist | `https://api.curapath.app,http://localhost:8081` |
| `USE_MOCK_CLAUDE` | Skip Claude API calls in dev | `true` or `false` |
| `DB_HOST` | DB host (if not using DATABASE_URL) | `localhost` |
| `DB_PORT` | DB port | `5432` |
| `DB_NAME` | Database name | `curapath` |
| `DB_USER` | DB user | `postgres` |
| `DB_PASSWORD` | DB password | `...` |
| `DB_SSL` | Enable SSL for local DB | `false` |

### Mobile (`mobile/.env`)

| Variable | Description | Example |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `https://api.curapath.app` |

In production EAS builds, `EXPO_PUBLIC_API_URL` is hardcoded in `eas.json` under the `production.env` section and overrides the `.env` file.

---

## 13. Common Developer Tasks — How To's

### Run the backend locally

```bash
cd backend
cp .env.example .env  # fill in values
npm install
npm run dev           # nodemon + ts-node, auto-restarts on file changes
```

Set `USE_MOCK_CLAUDE=true` to skip Claude API calls. Set `DATABASE_URL` to point at a local Postgres instance.

### Run the mobile app locally

```bash
cd mobile
cp .env.example .env  # set EXPO_PUBLIC_API_URL=http://localhost:3000
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone. The app will connect to the local backend at `localhost:3000`.

### Set up the database (first time)

```bash
psql -U postgres -d curapath -f backend/src/db/schema.sql
```

Or run the contents of `schema.sql` in any PostgreSQL client (TablePlus, pgAdmin, etc.).

### Add a new migration (schema change)

The project currently uses manual SQL migrations. Write the `ALTER TABLE ...` or `CREATE TABLE ...` SQL, run it against the production RDS instance (via AWS RDS Query Editor or a secure bastion connection), and add it to the bottom of `schema.sql` for documentation purposes.

### Deploy backend to Elastic Beanstalk

```bash
cd backend
npm run build         # compiles TypeScript to dist/
eb deploy             # upload and deploy to Beanstalk
```

### Build and submit mobile app to TestFlight

```bash
cd mobile
eas build --platform ios --profile production
# Wait for build to complete (5-15 minutes in EAS cloud)
eas submit --platform ios --profile production
```

### Check backend health

```bash
curl https://api.curapath.app/health
# Should return: {"status":"ok","timestamp":"..."}
```

### View production logs

In the AWS Elastic Beanstalk console → Environment → Logs → Request last 100 lines.

Or via EB CLI: `eb logs`

### Rotate JWT_SECRET

1. Generate a new secret: `openssl rand -hex 64`
2. Update the `JWT_SECRET` environment variable in Beanstalk.
3. All existing access tokens signed with the old secret will be immediately invalid. All users will be prompted to re-login.
4. Refresh tokens use SHA-256 hashing (not JWT signatures), so they remain valid until they expire naturally.

---

## 14. Known Patterns, Conventions, and Design Decisions

### The Two-Step Parse/Save

The discharge upload uses two API calls to Claude: one to preview (`POST /discharge/parse`) and one to save (`POST /discharge`). This was a deliberate UX decision — medical data must be reviewable before saving. The cost is two Claude API calls per upload. A future optimization would be to pass the `parsedJson` from the Review screen directly to the save endpoint via a dedicated "confirm" endpoint that takes the pre-parsed JSON plus the original upload params, saving one Claude call.

### No Redux — Zustand Only

Redux was intentionally avoided. The app has only two stores (auth and discharge), neither of which requires the complexity of Redux's action/reducer pattern. Zustand's API is closer to React's `useState` but with global scope, which is exactly what's needed here.

### Screens Own Their Styles via `makeStyles`

Every screen file contains a `makeStyles(C: Colors)` function at the bottom. This is intentional: styles are co-located with the component that uses them, making screens self-contained. The alternative (a global styles file) creates a tangled dependency graph. The `useMemo(() => makeStyles(C), [C])` pattern ensures `StyleSheet.create` is only called when the color scheme changes.

### All API Responses Are `{ data: T }` or `{ error: string }`

This consistent envelope means the API client can always look at `res.error` for errors and `res.data` for success data. It also makes it easy to add global response processing (like logging) in one place.

### `ON CONFLICT DO UPDATE` Throughout

Both `medication_logs` and `check_ins` use upsert patterns. This handles mobile edge cases like network retries, double-taps, and reconnections gracefully. The database enforces idempotency at the constraint level, not just in application code.

### No Client-Side Discharge Parsing

The mobile app never tries to parse discharge documents itself. All parsing happens on the server. This is important for two reasons: (1) the Anthropic API key is kept server-side (never in the app bundle), and (2) the server-side parsing can be updated (system prompt changes, model upgrades) without requiring an app update.

### The `isLoading` Pattern in `authStore`

The initial value of `isLoading` is `true`. While it's true, `AppNavigator` returns `null` (blank screen). This is intentional — it prevents the user from briefly seeing the Welcome screen flash before the app realizes they're already logged in. Once `loadFromStorage` completes (even if it errors), `isLoading` is set to `false` and the correct screen renders.

### `provider_phone` Stored Outside `parsed_json`

Although `provider_phone` is returned in the Claude JSON response and is part of `DischargeJSON`, it's stripped out and stored in its own column in the `discharges` table. Reasons:
1. It can be updated independently (via `PATCH /discharge/latest`) without re-parsing the entire discharge.
2. It's needed for the red flag alert screen even when the display language is changed — if `provider_phone` were inside `parsed_json`, a translation might modify it.
3. SQL queries that just need the phone number don't have to parse the JSONB blob.

### `original_parsed_json` Preserves the English Source

Whenever a translation is applied, only `parsed_json` is updated. `original_parsed_json` always holds the original English Claude output. This prevents translation degradation — going English → Spanish → French → English would degrade accuracy with each round-trip. By always translating from `original_parsed_json`, you're always translating from the highest-quality source.

### The `dischargeStore` Is Not Persisted to AsyncStorage

Unlike `authStore`, `dischargeStore` does not write to AsyncStorage. The discharge data is fetched from the API on every cold start (in `HomeScreen`'s `useEffect`). This is intentional: discharge data can be large, it can change (if the user uploads a new discharge), and it's always available from the API. Persisting it to AsyncStorage would require cache invalidation logic that isn't worth the complexity. The trade-off is a brief loading spinner on cold start — acceptable for a medical app where showing stale data is worse than showing a spinner.

---

*This document was written to reflect the state of the CuraPath codebase as of the initial TestFlight release (May 2026). All file paths are relative to the repository root at `/Users/ksp/Desktop/recharge/`.*
