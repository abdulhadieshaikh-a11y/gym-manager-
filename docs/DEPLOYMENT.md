# Deploying Gym Manager (GitHub + Vercel)

Once this is done, the owner can open the gym system from any browser at an address like `https://iron-temple.vercel.app`, or your own domain.

**Before you start:** the app runs locally against your Supabase project (see `SUPABASE_SETUP.md`), and `npm run build` succeeds on your computer.

## 1. Put the code on GitHub

1. Create a free account at https://github.com if you don't have one.
2. Click **New repository**.
   - Name: e.g. `gym-manager`
   - Visibility: **Private** (recommended: this is a client's system)
   - Do **not** add a README, .gitignore or licence. The project already has them.
3. In VS Code, open **Terminal → New Terminal** in the project folder and run:
   ```bash
   git init                      # skip if the folder is already a git repository
   git add .
   git status                    # CHECK: .env.local must NOT be listed
   git commit -m "Gym Manager: initial version"
   git branch -M main
   git remote add origin https://github.com/<your-username>/gym-manager.git
   git push -u origin main
   ```
   Git may ask you to sign in to GitHub in the browser. Allow it.

`.gitignore` already excludes `.env.local`, `node_modules` and build output. If `git status` ever shows `.env.local`, stop and don't commit.

## 2. Import the project into Vercel

1. Go to https://vercel.com and sign up **with your GitHub account**.
2. Click **Add New… → Project**, find `gym-manager`, and click **Import**. If it's not listed, click **Adjust GitHub App Permissions** and give Vercel access to the repository.
3. Vercel detects **Next.js** automatically. Leave the build settings as they are: build `next build`, install `npm install`.
4. Open **Environment Variables** and add these (select **Production**, **Preview** and **Development**):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable key |
   | `NEXT_PUBLIC_SITE_URL` | leave empty for now; you'll set it in step 4 |

5. Click **Deploy** and wait 1–3 minutes.

## 3. Check the deployment logs

- While it builds, click the deployment to watch the **Build Logs**. A successful build ends with a list of routes and "Deployment completed".
- If it fails, scroll to the first red `Error` line. The most common causes are a missing environment variable, or code that also fails with `npm run build` locally (fix it there first).
- After it's live, problems while using the app appear under **Project → Logs** (runtime logs).

## 4. Set the live address everywhere

1. Copy the production URL from Vercel (e.g. `https://gym-manager-abc.vercel.app`), or add your own domain under **Project → Settings → Domains**.
2. In Vercel, go to **Settings → Environment Variables**, set `NEXT_PUBLIC_SITE_URL` to that URL with no trailing slash, then **Deployments → ⋯ → Redeploy**. Environment-variable changes only apply after a redeploy.
3. In Supabase, go to **Authentication → URL Configuration**:
   - **Site URL:** your live URL
   - **Redirect URLs:** add `https://your-live-domain/**` and keep `http://localhost:3000/**` for local testing.

## 5. Database migrations in production

You use the **same Supabase project** locally and in production, unless you choose to create a separate test project, so migrations applied in `SUPABASE_SETUP.md` are already live.

When you add a new migration later:
1. Back up first (**Database → Backups**, or `npx supabase db dump -f backup.sql`).
2. Apply only the new migration file(s), in order, with the SQL Editor or `npx supabase db push`.
3. Then push the matching code to GitHub. Vercel redeploys automatically on every push to `main`.

Tip: for bigger changes, create a second free Supabase project for testing, apply and test there first, then apply to the live project.

## 6. Test the live site

Go through this checklist on the live URL, ideally on both a laptop and a phone:

- [ ] Visiting `/members` in a private window redirects to login.
- [ ] The owner can log in and log out.
- [ ] Settings save and survive a page refresh.
- [ ] Logo upload works (Settings → Upload logo).
- [ ] Create a package, add a test member with it, record a partial payment, then mark as paid. The receipt prints.
- [ ] Check the member in. A second check-in is refused.
- [ ] The dashboard numbers match what you just did.
- [ ] "Forgot password?" sends an email, and the link opens the "Choose a new password" page. This needs the email template and SMTP from the setup guide.
- [ ] Clean up: void the test payment with the reason "Test", then deactivate the test member. Or, before go-live, delete test data from the SQL Editor.

## 7. Hand over

- Give the owner the live URL and their email. Share the temporary password through a separate channel (in person or by phone call, not in the same message as the URL).
- Ask them to change the password under **Settings → Your account** right away.
- Give them `docs/OWNER_GUIDE.md` (you can print it or save it as a PDF).
- The owner never needs GitHub, Vercel or Supabase for daily work.

## Deployment checklist

- [ ] Repository is private and `.env.local` is not committed
- [ ] Vercel env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`
- [ ] No service-role / secret key anywhere in Vercel or the code
- [ ] All 4 migrations applied and `02_verify_setup.sql` checks pass
- [ ] Public sign-ups disabled in Supabase
- [ ] Site URL and redirect URLs set to the live domain
- [ ] Reset-password email template updated and custom SMTP configured
- [ ] Owner account created and granted with `grant_gym_access`
- [ ] Live test checklist (section 6) completed
