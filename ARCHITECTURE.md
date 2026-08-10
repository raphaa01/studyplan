# Fokusplan architecture

## Production architecture

The Next.js application is deployed on Vercel and consumes Supabase through its publishable browser key. `AccountProvider` owns the validated Supabase Auth session. `StudyProvider` loads and optimistically updates a single study document through `SupabaseStudyRepository`, while `LocalStorageRepository` keeps an offline cache and migrates data from the earlier local-only prototype.

Planner modules under `lib/planner` remain deterministic, side-effect free, and independent of React and storage. This keeps plan generation reproducible and directly testable.

## Data isolation

Each `public.study_data` row is keyed by the corresponding `auth.users.id`. PostgreSQL Row Level Security is enabled and forced. Separate select, insert, update, and delete policies compare `(select auth.uid())` with `user_id`; update includes both `USING` and `WITH CHECK`. The anonymous role has no table privileges and the browser never receives a secret or service-role key.

## Deployment

Vercel is linked to the GitHub repository and receives `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Development, Preview, and Production. The committed `.env.example` documents required keys without containing values. The Supabase schema is versioned under `supabase/migrations/`.
