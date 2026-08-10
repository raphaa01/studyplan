# Fokusplan

Fokusplan turns availability, exam deadlines, topic confidence, scope, and importance into a realistic weekly study plan with active recall, spaced repetition, workload limits, and visible breaks.

## Run locally

Requirements: Node.js 22.13 or newer and a Supabase project.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Create an online account on first launch, confirm the email when required, and complete the three-step setup. Study data is synchronized through Supabase and cached locally for short connection interruptions.

## Database

The production schema is stored in `supabase/migrations/`. `public.study_data` stores one JSONB study document per authenticated user. Row Level Security and explicit grants restrict every operation to `auth.uid() = user_id`; no service-role key is exposed to the browser.

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
- `components/providers/account-provider.tsx` — Supabase Auth session and profile state
- `lib/planner/` — pure deterministic priority, spacing, session, and break logic
- `lib/storage/` — Supabase persistence plus a local offline cache
- `lib/supabase/` — browser client configuration
- `supabase/migrations/` — versioned PostgreSQL schema and RLS policies
- `types/` — planner, product, and generated database types
- `tests/` — planner scenarios and production-render verification
