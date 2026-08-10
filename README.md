# Fokusplan

Fokusplan is a local-first study-planning application for students. It turns weekly availability, exam deadlines, topic confidence, scope, and importance into concrete study blocks with active recall, spaced repetitions, realistic workload limits, and visible breaks.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Create a device-local account on first launch, then complete the three-step setup for workload, study days, and preferred times. Each local account receives separate exams, availability, completion state, and feedback through the versioned repository abstraction.

## Quality checks

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
npm run test:render
```

## Structure

- `app/` — dashboard, weekly plan, exams, availability, settings, and onboarding routes
- `components/` — shared shell, session cards, feedback, and application state
- `components/providers/account-provider.tsx` — local account session and profile state
- `lib/planner/` — pure deterministic priority, spacing, session, and break logic
- `lib/storage/` — replaceable persistence interface and local implementation
- `types/` — planner and product domain model
- `tests/` — planner scenarios and rendered-app verification
- `ARCHITECTURE.md` — migration path to an API and standard PostgreSQL through `DATABASE_URL`

The current version uses device-local accounts with PBKDF2-derived password hashes. It has no database, cloud persistence, external identity provider, or external AI API. These accounts do not synchronize across browsers or devices.
