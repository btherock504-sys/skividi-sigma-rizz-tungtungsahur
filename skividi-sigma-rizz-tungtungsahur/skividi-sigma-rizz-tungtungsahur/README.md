# V4 — Open Atlas Cover / Hidden Members Chat

This is the V3 app with a new fictional encyclopedia-style public cover. It is **not affiliated with Wikipedia**. The actual member chat, authentication, access requests, admin approval and Supabase schema remain unchanged.

## Hidden entry

Scroll to the bottom of the article and tap the small ✣ article marker **five times**. Alternatively type `knock` while the article has focus (not in the search input). The sign-in/request-access dialog opens. Once unlocked, a Member access shortcut appears. Change `SECRET_KEY_SEQUENCE` and `LOGO_CLICKS_TO_REVEAL` in `app/page.js` before publishing. This gesture is visual obscurity, **not** security; Supabase Auth, admin approval and RLS enforce actual access.

## Deploy

1. Back up your existing GitHub repository and Supabase database before changes.
2. Replace project files with V4 contents. Preserve the same Vercel Root Directory configuration.
3. Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to your actual Supabase project URL and publishable/anon key (never the secret/service role key).
4. Deploy to Vercel. No new SQL is required if V3 membership tables and policies were already installed. Otherwise run `schema.sql` and bootstrap your administrator as described in V3.
5. Test hidden entry, account registration, approval, login, messaging and signout on desktop and mobile. Email verification/recovery still requires correctly configured Supabase email and redirect URLs.

The sample article text is fictional placeholder copy, not an encyclopedia citation.
