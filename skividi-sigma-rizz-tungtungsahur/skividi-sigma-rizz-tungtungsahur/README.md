# Skividi sigma rizz tungtungsahur

A members-only shared chat built with Next.js 14 (App Router, JavaScript) and Supabase. Deploy on Vercel.

## Important security notes

- The hidden logo is a convenience, not an access-control mechanism. Anyone can discover the form; only valid Supabase accounts can sign in.
- Create member accounts yourself in Supabase. Do not add a public sign-up flow.
- The browser uses only the Supabase publishable/anon key. Never put a Supabase `service_role` or secret key in a `NEXT_PUBLIC_` variable or commit it to GitHub.
- RLS protects the `messages` table. Authenticated users can read messages, insert only rows with their own `user_id`, and delete only their own rows.
- Do not store highly sensitive information in chat. This starter does not include end-to-end encryption, file uploads, moderation, backups, or rate limiting.

## 1. Create your Supabase project

1. Go to https://supabase.com and create an account.
2. Create a new project. Choose a project name, a strong database password, and a region near your members.
3. Wait for the project to finish provisioning.

## 2. Create the messages table and security rules

1. In your Supabase project, open **SQL Editor**.
2. Choose **New query**.
3. Open `schema.sql` from this project, copy its entire contents, and paste it into the SQL Editor.
4. Click **Run**.
5. In **Database > Replication** (or the Realtime settings for your project), verify that the `messages` table is included in the `supabase_realtime` publication. The SQL file attempts to enable it for you.

## 3. Add member accounts and disable public registration

1. In Supabase, open **Authentication > Users**.
2. Click **Add user** / **Create new user**.
3. Enter the member's email and a temporary or agreed password. Enable **Auto Confirm User** if that option is shown.
4. Repeat for each invited member. Share credentials securely and ask members to use a unique password.
5. Open **Authentication > Settings** (sometimes shown under **Sign In / Providers**).
6. Find the user sign-up setting and turn **Allow new users to sign up** off. Save changes.

Only accounts you manually create should be able to use the site. Test with a member account after deployment.

## 4. Get your Supabase URL and browser key

1. In Supabase, open **Project Settings > API** (the exact navigation label may vary).
2. Copy the **Project URL**. It must begin with `https://`.
3. Copy the **publishable key** (or the legacy `anon` / public key if that is what your project displays).
4. The browser must use this public key only. Never use the `service_role` or secret key in this project.

## 5. Upload the project to GitHub

1. Download and unzip this project.
2. Create a new **private** repository on https://github.com (recommended for source-code privacy).
3. Upload the project files and folders to the repository root. The root should contain `package.json`, `schema.sql`, `README.md`, and the `app` and `lib` folders.
4. Do not upload `.env.local`. The `.gitignore` file excludes it.

To test locally, create `.env.local` in the project root using the values from Supabase, then run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 6. Deploy on Vercel

1. Go to https://vercel.com and sign in with GitHub.
2. Click **Add New > Project**.
3. Import the GitHub repository you just created.
4. Keep the detected framework as **Next.js** and the default build command.
5. Before deploying, open **Environment Variables**.
6. Add the first variable:
   - **Key / Name:** `NEXT_PUBLIC_SUPABASE_URL`
   - **Value:** paste your full Supabase Project URL, such as `https://your-project-ref.supabase.co`
7. Add the second variable:
   - **Key / Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value:** paste your Supabase publishable key (or legacy anon/public key).
8. Enable the variables for **Production**. Enable Preview/Development too only if you want those deployments to connect to the same Supabase project.
9. Click **Deploy**.
10. When deployment finishes, open the Vercel URL. Click the logo to reveal the form and sign in with a manually created member account.

If you add or change environment variables later, go to **Vercel > Project > Settings > Environment Variables**, save the changes, then go to **Deployments** and redeploy the latest deployment. Environment variables are read at build/deploy time.

## 7. Optional: require five logo clicks

Open `app/page.js` and change:

```js
const LOGO_CLICKS_TO_REVEAL = 1;
```

to:

```js
const LOGO_CLICKS_TO_REVEAL = 5;
```

The value is the one setting to change the gesture. With `5`, click the logo five times to reveal the sign-in form. This is only concealment, not security.

## Features and behavior

- One shared room backed by `public.messages`.
- Supabase email/password sign-in.
- Realtime inserts/deletes through `postgres_changes`.
- Presence for online members and Broadcast for typing indicators.
- Polling every four seconds when Realtime is not subscribed.
- Own-message deletion enforced by RLS.
- Message grouping, local timestamps, day dividers, URL links, Enter-to-send, Shift+Enter newline.
- Scroll-to-latest and unread count in the browser tab title.
- Optional notification tone (browser audio may require a user gesture).
- Responsive layout and `prefers-color-scheme` theme.
- `noindex` metadata and `public/robots.txt` disallow all crawlers.

## Troubleshooting

**"Site setup is incomplete"**
- Check both Vercel environment variable names and values.
- Make sure the URL includes `https://`.
- Redeploy after changing environment variables.

**Login fails**
- Confirm the user exists in **Authentication > Users** and is confirmed.
- Check the email and password.
- Ensure the Supabase email/password provider is enabled.
- The app intentionally shows the same generic error for all failed sign-in attempts.

**Messages do not appear**
- Confirm `schema.sql` ran successfully.
- Check that RLS is enabled and the three policies exist on `public.messages`.
- Confirm `messages` is included in the `supabase_realtime` publication.
- The app polls every four seconds while Realtime is disconnected, but database permissions must still be correct.

**Security reminder**
- `robots.txt` and `noindex` ask compliant crawlers not to index the site; they do not make the site private.
- Keep Supabase Auth and RLS enabled. Never expose the Supabase secret/service-role key.
- This is a practical starter, not a hardened enterprise messenger. Consider rate limits, abuse controls, retention rules, backups, and a security review before using it for sensitive communications.
