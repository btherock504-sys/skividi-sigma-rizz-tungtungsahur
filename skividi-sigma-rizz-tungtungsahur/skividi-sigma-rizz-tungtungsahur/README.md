# Skividi sigma rizz tungtungsahur

A private, members-only group chat with a ChatGPT-inspired terminal interface. **It does not use an AI model** and is **not end-to-end encrypted**. All signed-in members share the same `#general` room.

## Existing Supabase users: do not reset your project

If you already successfully ran `schema.sql` in Supabase, **you do not need to run it again**. This rebuild retains the original `public.messages` table and row-level security policies.

## Deploy

1. Create a private GitHub repository and upload the **contents** of this project directory (not the ZIP).
2. In Supabase, create a project if you do not already have one. Run `schema.sql` once in the SQL Editor. If you have already run it, skip this step.
3. In Supabase Authentication, enable Email sign-in, **disable public signups**, and manually add/confirm authorized users.
4. In Supabase Project Settings, copy your **Project URL** and **publishable/anon public key**. Never use a secret or `service_role` key in the browser.
5. Import the GitHub repository at https://vercel.com/new and choose the Next.js framework.
6. Set the following Vercel Environment Variables for Production (and Preview if needed):

   `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL

   `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase publishable/anon public key

7. Deploy (or redeploy after adding variables). Visit your Vercel URL. Click the centered logo to reveal the sign-in form, then sign in using a manually created member.
8. Test with two member accounts in separate browser sessions: send/receive messages, presence, typing, own-message deletion, and mobile layout.

## Run locally

Requires Node.js 18.17+ (Node.js 20 recommended).

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your own Supabase URL and public key
npm run dev
```

Open http://localhost:3000. `npm run build` checks the production build.

## Notes

- This project uses Next.js 14 App Router, plain JavaScript, and `@supabase/supabase-js`.
- Supabase RLS allows authenticated members to read messages, insert their own, and delete their own. There is no UPDATE policy.
- Realtime is used for messages, presence and typing; polling every four seconds is a fallback when realtime is disconnected.
- Message history displays the latest 100 messages. This is a single shared room; the sidebar is not a multi-room system.
- Hidden logo, `robots.txt` and `noindex` are not access controls. Supabase Authentication and RLS enforce member access.
- Presence and typing are ephemeral signals, not durable records. Realtime channels should be configured with appropriate authorization for sensitive deployments; this starter is not an end-to-end encrypted or enterprise-grade messenger.
- Never commit `.env.local` or server-side secret keys to GitHub.
