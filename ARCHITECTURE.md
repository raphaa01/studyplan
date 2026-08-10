# Fokusplan architecture

## Current local version

The UI consumes identity through `AccountProvider` and learning data through `StudyProvider`. Device-local accounts use a versioned account store and PBKDF2-derived password hashes; no plaintext password is stored. `LocalStorageRepository` scopes each study-data document to an account ID. Planner modules under `lib/planner` are deterministic, side-effect free, and know nothing about React or storage.

## Future API and PostgreSQL migration

1. Replace the local account repository with a hosted identity provider or server-side session system, then add a backend exposing preferences, availability, exams, topics, sessions, plans, and feedback as authenticated resources.
2. Implement an `ApiStorageRepository` with the same application-facing methods and swap it at the provider boundary.
3. Normalize the current interfaces into PostgreSQL tables with UUID primary keys and foreign keys. Keep generated study sessions immutable enough to audit planner decisions.
4. Configure the connection only through `DATABASE_URL`; never hard-code a host. A local Docker Compose file can start frontend, API, and PostgreSQL, while the same API can later point at Supabase, Neon, RDS, or any standard PostgreSQL host.
5. Run planner calculation in the API when multi-device synchronization is introduced. Keep the pure planner package shared so identical inputs remain reproducible and testable.

No database, Docker runtime, external identity provider, or cloud dependency is included in the current prototype. Local accounts are intentionally limited to one browser profile.
