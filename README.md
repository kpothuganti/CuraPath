# ReCharge

A mobile app that helps patients navigate the 30 days after hospital discharge. Takes confusing discharge paperwork and turns it into plain-English daily tasks, medication reminders, and morning check-ins.

## How it works

1. Patient photographs or uploads their discharge paperwork
2. Claude AI parses it into structured data (medications, red flags, restrictions)
3. App surfaces daily tasks, fires medication reminders, and runs a short morning symptom check-in
4. If a red flag is detected, the patient gets a tap-to-call alert for their care team

## Project structure

```
discharge/
  mobile/     React Native app (Expo + TypeScript)
  backend/    Node.js + Express API (TypeScript)
  shared/     Shared TypeScript types used by both
  mockup/     Static HTML mockup of all screens (open in browser)
```

---

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- [Expo Go](https://expo.dev/go) on your iOS or Android device
- [Postgres.app](https://postgresapp.com) (macOS) or any PostgreSQL 14+ instance

---

## Backend setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `backend/.env` and fill in:

```env
# Required
JWT_SECRET=any-long-random-string-you-make-up

# Database — defaults work with Postgres.app on macOS
DB_HOST=localhost
DB_PORT=5432
DB_NAME=discharge
DB_USER=your-mac-username   # run: whoami
DB_PASSWORD=                # blank for Postgres.app default

# Mock mode — keeps true until you have a real Anthropic key
USE_MOCK_CLAUDE=true
ANTHROPIC_API_KEY=          # leave blank while USE_MOCK_CLAUDE=true
```

### 3. Create the database

**Using Postgres.app (macOS):**

```bash
# Add CLI tools to path — copy the exact line shown in Postgres.app after clicking Initialize
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

createdb discharge
psql -d discharge -f src/db/schema.sql
```

### 4. Start the backend

```bash
npm run dev
```

You should see: `Discharge API running on port 3000 [development]`

---

## Mobile app setup

### 1. Install dependencies

```bash
cd mobile
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `mobile/.env` and set your Mac's local IP address:

```env
EXPO_PUBLIC_API_URL=http://YOUR_MAC_IP:3000
```

**To find your Mac's IP:**

```bash
ipconfig getifaddr en0
```

> If running in an iOS Simulator (not a physical device), use `http://localhost:3000` instead.

### 3. Start the app

```bash
npx expo start
```

Scan the QR code with your iPhone camera (iOS) or the Expo Go app (Android).

---

## Running on other devices

### Physical iPhone or Android (same WiFi)

1. Make sure your phone and Mac are on the same WiFi network
2. Set `EXPO_PUBLIC_API_URL=http://YOUR_MAC_IP:3000` in `mobile/.env`
3. Run `npx expo start` and scan the QR code

### iOS Simulator (no phone needed)

1. Install [Xcode](https://developer.apple.com/xcode/) from the Mac App Store
2. Run `npx expo start`, then press `i` to open the simulator
3. Use `http://localhost:3000` in `mobile/.env`

### Android Emulator

1. Install [Android Studio](https://developer.android.com/studio)
2. Create a virtual device in the AVD Manager
3. Run `npx expo start`, then press `a`
4. Use `http://10.0.2.2:3000` in `mobile/.env` (Android emulator maps `10.0.2.2` → host `localhost`)

---

## Switching from mock to real AI parsing

By default the backend returns fake discharge data so you can develop without an Anthropic API key.

When you're ready to test real document parsing:

1. Get a free API key at [console.anthropic.com](https://console.anthropic.com)
2. Update `backend/.env`:
   ```env
   USE_MOCK_CLAUDE=false
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
3. Restart the backend (`rs` in the nodemon terminal)

---

## Tech stack

| Layer    | Choice                           |
| -------- | -------------------------------- |
| Mobile   | React Native (Expo) + TypeScript |
| Backend  | Node.js + Express + TypeScript   |
| Database | PostgreSQL (RDS in production)   |
| AI       | Claude API (Anthropic)           |
| Auth     | JWT with refresh token rotation  |
| State    | Zustand + AsyncStorage           |

## HIPAA note

This app handles Protected Health Information (PHI). Before onboarding any real patients:

- Sign a Business Associate Agreement (BAA) with your cloud provider
- Deploy the backend to AWS with RDS + S3 (see `HLD.md` for the full architecture)
- Enable encryption at rest on all datastores
- Complete the checklist in `PRD.md`
