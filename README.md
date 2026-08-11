# Password Gate (Next.js App Router)

Drop-in password protection for a Next.js App Router project. No user
accounts — just one shared password, checked server-side.

## Files

```
middleware.ts                  # gates every request except /login and /api/login
lib/auth.ts                    # password check + signed session token helpers
app/login/page.tsx             # the login screen
app/login/login.module.css     # its styles
app/api/login/route.ts         # server-side password check (only place APP_PASSWORD is read)
.env.local.example             # documents the required env var
```

## Install

1. Copy `middleware.ts`, `lib/auth.ts`, `app/login/`, and `app/api/login/`
   into your project, merging with any existing `app/` or `lib/` folders.
   - If you already have a root `middleware.ts`, merge the two — you can't
     have more than one.
   - The imports in `app/api/login/route.ts` and `middleware.ts` use
     relative paths (no `@/` alias assumed), so they work regardless of
     your tsconfig path setup. Adjust them if you move the files.
2. Add `APP_PASSWORD` to your environment. Locally, copy
   `.env.local.example` to `.env.local` and set a real value:

   ```
   APP_PASSWORD=your-shared-password
   ```

   In production, set it in your host's environment variable settings
   (e.g. Vercel project settings) — never commit it.
3. Restart the dev server so the new env var and middleware take effect.

## How it works

- On submit, the login page POSTs the password to `/api/login`.
- The API route hashes the submitted password and the real `APP_PASSWORD`
  and compares the hashes in constant time, so response timing can't be
  used to guess the password character-by-character.
- On success, it sets an `httpOnly`, `SameSite=Lax` cookie containing a
  token signed with HMAC-SHA256 (keyed by `APP_PASSWORD`). The password
  itself never leaves the API route, and the cookie can't be read or
  forged from client-side JS.
- The cookie has no `maxAge`, so it's a browser-session cookie: it survives
  page loads and navigation but clears when the browser closes. The signed
  token also carries its own 24-hour expiry as a server-side backstop.
- `middleware.ts` runs on the server for every request except `/login`,
  `/api/login`, and static assets. It verifies the cookie's signature and
  expiry and redirects to `/login` if it's missing or invalid. Because this
  check happens in middleware, before any page or layout renders, there's
  no way to reach app content by viewing page source or disabling
  JavaScript — the gate is enforced server-side.

## Notes

- This protects the whole app equally, including any pages you add later —
  the middleware matcher covers everything by default rather than
  allow-listing specific routes.
- This is a shared-password gate, not per-user authentication: anyone with
  the password gets full access.
- Consider adding rate limiting in front of `/api/login` (e.g. at your
  host/WAF level) if you're concerned about brute-force attempts.
