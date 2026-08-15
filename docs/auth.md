# Authentication (Supabase Auth)

Supabase provides authentication; our own PostgreSQL/Prisma database remains the
source of truth for application data.

## How it fits together
- The browser signs in/registers via `@supabase/ssr` (`src/lib/supabase/client.ts`).
- `middleware.ts` refreshes the session cookie on every request and redirects
  unauthenticated users to `/login`.
- Server code reads the verified session with `supabase.auth.getUser()`
  (`src/lib/session.ts`). It validates the JWT server-side — client-supplied ids
  are never trusted.
- On first sign-in, `getOrCreateUserFromAuth` (`src/server/services/user-service.ts`)
  creates a `User` row and links it via `User.authId` (the Supabase auth id).
  Everything else (expenses, memberships) references the internal `User.id`.

## Files
- `src/lib/supabase/server.ts`, `client.ts`, `middleware.ts`
- `middleware.ts` (root) — session refresh + route protection
- `src/app/(auth)/login`, `(auth)/register` — forms
- `src/app/auth/callback/route.ts` — email-confirmation / OAuth code exchange
- `src/app/auth/signout/route.ts` — POST to end the session
- `src/app/api/me/route.ts` — current user + their households

## Setup
1. Create a Supabase project. Copy the API URL + anon key + service role key and
   the Postgres connection string into `.env`.
2. In Supabase → Authentication → URL Configuration, add your site URL and the
   redirect `http://localhost:3000/auth/callback` (and your deployed equivalent).
3. `npm run db:push` to apply the schema (adds `User.authId`).
4. `npm run dev`, open `/register`, create an account. If email confirmation is
   enabled you'll get a link; otherwise you're signed straight in.

## Note on email confirmation
If confirmation is ON (Supabase default), registration shows a "check your email"
screen and the account activates when the link (→ `/auth/callback`) is opened.
Turn it OFF in Authentication → Providers → Email for a faster local loop.
