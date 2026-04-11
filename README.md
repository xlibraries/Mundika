# Mundika

Local-first inventory, billing, purchases, and ledger workflow built with Next.js
and Supabase auth/sync.

## Getting started

1. Copy `.env.local.example` to `.env.local`.
2. Start the app:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

## Google auth setup

Mundika uses Supabase Auth for Google sign-in/sign-up. The app code already sends
users through Supabase OAuth and back to `/auth/callback`, but the provider must
be configured in Supabase and Google Cloud first.

1. In Supabase, open `Authentication -> Providers -> Google` and enable Google.
2. Paste your Google OAuth client ID and client secret into the Google provider.
3. In Supabase, open `Authentication -> URL Configuration` and add:
   `http://localhost:3000/auth/callback`
4. In Google Cloud Console, add this Authorized JavaScript origin:
   `http://localhost:3000`
5. In Google Cloud Console, add this Authorized redirect URI:
   `https://jtqvahhamlvywzgpokbv.supabase.co/auth/v1/callback`

`NEXT_PUBLIC_SITE_URL` should match the URL where the app is running. For local
development, keep it as `http://localhost:3000`.

## Notes

- Google OAuth through Supabase handles both sign-in and first-time sign-up.
- Do not commit Google client secrets into the repo. Keep them in Google Cloud
  and Supabase provider settings only.
