# Product Requirements Document — ReCharge

**Version:** 1.0  
**Date:** 2026-04-07  
**Status:** Draft

---

## 1. Problem Statement

Hospital discharge instructions are a 6-page PDF written at a 12th-grade reading level, handed to a patient who just had surgery and is likely on pain medication. The result: patients don't understand what to do, skip medications, miss warning signs, and get readmitted — costing them their health and costing hospitals CMS Medicare readmission penalties.

---

## 2. Solution

**ReCharge** is a mobile app (iOS + Android) that:

1. Ingests discharge paperwork via photo or PDF upload
2. Uses Claude AI to translate instructions into plain-language daily tasks (6th-grade reading level)
3. Sends condition-aware daily symptom check-ins to catch red flags before they become emergencies
4. Delivers medication reminders and logs adherence

---

## 3. Users

| User                 | v1           | Notes                               |
| -------------------- | ------------ | ----------------------------------- |
| Patient              | Primary      | Directly manages their own recovery |
| Caregiver / Family   | Out of scope | v2                                  |
| Care team / Provider | Out of scope | v2 B2B2C                            |

**User profile:** Adults discharged from a hospital stay, ranging from post-surgical recovery to cardiac events. Significant portion are elderly — design must accommodate large tap targets, high contrast, and system font size settings.

---

## 4. Go-to-Market

- **v1:** B2C — patients find the app after going home scared, no hospital deal required
- **v2:** Use readmission data and engagement metrics to pitch hospitals for B2B2C partnerships
- **v3:** Epic App Orchard listing, care team monitoring portal

---

## 5. Core Features (v1 Scope)

### Feature 1 — Instruction Translator (AI-powered)

**What it does:** Patient uploads or photographs their discharge paperwork. Claude API parses it and returns structured data that drives the rest of the app.

**Output schema:**

```json
{
  "medications": [
    {
      "name": "string",
      "dose": "string",
      "frequency": "string",
      "instructions": "string",
      "times": ["HH:MM"]
    }
  ],
  "activity_restrictions": ["string"],
  "red_flags": ["string"],
  "follow_up_appointments": [{ "type": "string", "timeframe": "string" }],
  "diet_restrictions": ["string"],
  "wound_care": ["string"]
}
```

**Input methods:**

| Method              | v1  | Notes                                        |
| ------------------- | --- | -------------------------------------------- |
| Photo / camera scan | Yes | Base64 JPEG/PNG to Claude vision API         |
| PDF upload          | Yes | File picker, extract text, send to Claude    |
| Epic FHIR auto-pull | No  | v2 — requires App Orchard + hospital sponsor |

**Review step:** After parsing, patient sees extracted tasks before they are saved and can flag corrections. This mitigates OCR/parsing errors.

**Acceptance criteria:**

- Patient can photograph a document and receive structured output in < 30 seconds
- Patient can upload a PDF and receive structured output in < 30 seconds
- All output is written at a 6th-grade reading level
- A "review your instructions" screen is shown before saving
- Parse errors surface a friendly retry state, not a crash

---

### Feature 2 — Daily Check-In

**What it does:** A short morning push notification triggers a symptom check. Questions are dynamically generated from the patient's specific `red_flags` array — not a generic wellness survey.

**Example:** If red flags include "Temperature above 101°F" → morning check-in asks "Have you had a fever today?" → If yes → nudge with provider's tap-to-call number.

**Acceptance criteria:**

- One check-in notification per day, sent at a user-configurable morning time (default 8 AM)
- Check-in questions derived from parsed `red_flags`, not hardcoded
- Red flag triggered → show `RedFlagAlert` screen with tap-to-call button
- No check-in notification if user has already completed that day's check-in
- Check-in responses stored in `check_ins` table with `red_flag_triggered` boolean

---

### Feature 3 — Medication Reminders + Log

**What it does:** Push notifications fire at each medication's scheduled times. Patient taps "Taken" or "Skip." History is viewable.

**Acceptance criteria:**

- Notifications sent at each time in medication `times[]` array
- One-tap "Taken" checkoff from the notification or in-app
- "Skip" option with no required reason
- Missed dose nudge fires 30 minutes after scheduled time if not logged
- Log view shows full adherence history by day
- Reminders persist across app restarts (local notifications for v1, AWS SNS for v2)

---

## 6. Out of Scope for v1

- Caregiver / family visibility dashboard
- Epic FHIR auto-pull
- Care team monitoring portal
- In-app chat with providers
- Wearable integrations
- Condition-specific check-in templates (cardiac, ortho) — general only
- Marketing push notifications

---

## 7. Non-Functional Requirements

### HIPAA Compliance (non-negotiable from day one)

- Signed BAA with cloud provider before any PHI is stored
- All health data encrypted at rest (AES-256) and in transit (TLS 1.2+)
- JWT tokens short-lived with refresh token rotation
- Audit logging: who accessed what, when
- No PHI in crash logs or analytics events — log behavior only, never content
- Delete-my-account flow implemented before launch

### Accessibility

- Minimum tap target size: 44×44pt
- High contrast mode support
- Respects system font size / Dynamic Type (iOS) / font scale (Android)
- No timed interactions

### Legal / App Store

- "This is not medical advice" disclaimer on every health content screen
- Privacy policy and Terms of Service completed before submission
- App Store privacy nutrition label accurately reflects PHI collection
- Do not use the word "diagnose" anywhere in the app or store listing

### Performance

- Instruction parsing: < 30s end-to-end (p95)
- Home screen load: < 1s on 4G
- App size: < 50MB

---

## 8. Risks & Mitigations

| Risk                         | Mitigation                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------ |
| OCR / parsing errors         | "Review your instructions" confirmation screen before saving                   |
| Liability for health content | Disclaimer on every health screen; "follow your doctor's instructions" framing |
| Notification fatigue         | Cap to one morning check-in + scheduled med reminders only in v1               |
| Elderly user friction        | Large tap targets, high contrast, system font size compliance                  |
| App Store rejection          | Pre-prepare HIPAA docs, privacy policy, medical disclaimer before submission   |

---

## 9. Success Metrics (v1)

| Metric                                              | Target                                           |
| --------------------------------------------------- | ------------------------------------------------ |
| D7 retention                                        | > 40%                                            |
| Check-in completion rate                            | > 60% of scheduled check-ins completed           |
| Medication adherence rate                           | > 70% of doses logged as taken                   |
| Parse success rate                                  | > 95% of uploads produce valid structured output |
| Red flags triggered that result in provider contact | Tracked (baseline TBD)                           |
