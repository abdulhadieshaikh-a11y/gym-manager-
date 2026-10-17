# Supabase setup

This is a one-time setup, roughly 20 minutes. Supabase is the online database and login service that Gym Manager uses. The free plan is enough to start.

> Supabase sometimes renames menu items. If a label below doesn't match exactly, look for the closest equivalent.

## 1. Create the project

1. Go to https://supabase.com and sign up or log in.
2. Click **New project**.
   - **Name:** e.g. `gym-manager`
   - **Database password:** generate a strong one and **save it in a password manager**. You need it only if you use the Supabase CLI.
   - **Region:** pick the one closest to the gym. For Pakistan, **Mumbai (ap-south-1)** or **Singapore** are usually fastest.
3. Wait until the project finishes setting up (1–2 minutes).

## 2. Copy the two public values into `.env.local`

1. Open **Project Settings → API** (sometimes called **Data API**) and copy the **Project URL**.
2. Open **Project Settings → API Keys** and copy the **Publishable key**. It starts with `sb_publishable_`. If you only see "anon / public" legacy keys, copy the `anon` key instead.
3. In the project folder, copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

**Do not copy the `secret` / `service_role` key anywhere.** This app doesn't need it.

## 3. Apply the database migrations

The four files in `supabase/migrations/` create every table, rule, function, security policy and the logo storage bucket. Apply them **once, in order**.

### Option A: SQL Editor (easiest)

1. In Supabase, open **SQL Editor → New query**.
2. Open `supabase/migrations/20261018000001_core_schema.sql` in VS Code, select all (`Ctrl + A`), copy, paste it into the SQL Editor and click **Run**. You should see "Success. No rows returned".
3. Repeat for the next files, **in this order**:
   - `20261018000002_functions.sql`
   - `20261018000003_security.sql`
   - `20261018000004_storage.sql`

If a file fails part-way, read the error message. The most common cause is running files out of order. On a brand-new project you can delete the project and start again. That's the cleanest way to recover.

### Option B: Supabase CLI (for future updates)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>     # the xxxxxxxx part of your URL
npx supabase db push                                   # applies supabase/migrations in order
```

The CLI remembers which migrations have been applied, so later updates are safe to push. Don't mix the two options for the same files: if you used Option A, keep using the SQL Editor for future migration files.

## 4. Configure authentication

1. **Turn off public sign-ups.** Go to **Authentication → Sign In / Providers** and switch **Allow new users to sign up** to **off**. Keep the **Email** provider enabled. Even if someone did sign up, they would see no data, but there is no reason to allow it.
2. **URLs.** Go to **Authentication → URL Configuration**.
   - **Site URL:** `http://localhost:3000` for now. Change it to your live address after deployment.
   - **Redirect URLs:** add `http://localhost:3000/**`. Later, add `https://your-live-domain/**` as well.
3. **Password-reset email template (recommended).** Go to **Authentication → Emails → Reset Password** (or **Email Templates → Reset Password**) and replace the link in the template with:
   ```html
   <h2>Reset your Gym Manager password</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
   <p>If you didn't ask for this, you can ignore this email.</p>
   ```
   With this link, a reset works even if it's opened on a different device from the one that requested it. The default template also works, but only when the link is opened in the same browser.
4. **Email sending.** Supabase's built-in email service is heavily rate-limited (a few emails per hour) and meant for testing. For a live gym, set up custom SMTP (for example Resend, Brevo or your Microsoft 365 / Google mailbox) under **Project Settings → Authentication → SMTP Settings**. Until then, password resets can also be done by you from the dashboard (see the owner guide).

## 5. Create the owner's login

1. Go to **Authentication → Users → Add user → Create new user**.
   - Email: the owner's email.
   - Password: a strong temporary password. Give it to the owner privately and ask them to change it under **Settings → Your account** after their first login.
   - Tick **Auto Confirm User**.
2. Grant that user access to the gym. Open **SQL Editor**, paste the following (also in `supabase/snippets/01_grant_owner_access.sql`), change the email and name, then run it:
   ```sql
   select public.grant_gym_access('owner@example.com', 'owner', 'Owner Name');
   ```
   This function can **only** be run from the SQL Editor. The app cannot call it, so nobody can promote themselves.
3. Optional front-desk account: create another user the same way, then run
   `select public.grant_gym_access('frontdesk@example.com', 'staff', 'Front Desk');`
4. To remove someone's access later: `select public.revoke_gym_access('their@email.com');`

There are no default or built-in passwords anywhere in the app.

## 6. Verify everything

1. In **SQL Editor**, run `supabase/snippets/02_verify_setup.sql`. Check that:
   - every table shows `rls_enabled = true`;
   - the "anon privileges" query returns **no rows**;
   - the functions query returns 7 rows;
   - the settings row shows `Asia/Karachi` and today's date;
   - the `gym-branding` bucket exists.
2. Start the app (`npm run dev`), open the URL shown in the terminal, and log in as the owner. You should land on the dashboard with empty states.
3. Quick security check: open a **private / incognito** window and go to `http://localhost:3000/members`. You must be sent to the login page.
4. Open **Settings**, enter the gym name, save, then refresh the page. The name should still be there. That confirms data is saved in Supabase.

## Updating the database later

New features may come with new files in `supabase/migrations/` (with a newer date in the name). Apply only the new files, in order, using the same method you used before. Never edit a migration that has already been applied. Add a new one instead.

## Backups

Free projects do not include point-in-time recovery. Paid plans include daily backups. At minimum, export a backup occasionally from **Database → Backups**, or with `npx supabase db dump`.
