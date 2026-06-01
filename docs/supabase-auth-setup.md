# Supabase Auth Setup

Admini uses Supabase Auth for email/password sign up plus Google, Apple, and Outlook sign in. The apps are already wired for Supabase, but each deployment environment needs URL allow-listing and each social provider needs credentials in the Supabase Dashboard.

## App Environment

Create `.env.local` at the repo root for local development:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_CLOUDFLARE_API_BASE_URL=http://127.0.0.1:8787
VITE_SENTRY_DSN=
VITE_SENTRY_ENVIRONMENT=development
```

Only put the Supabase publishable key in browser env vars. Keep the service role key out of frontend builds.

## Supabase URL Configuration

In Supabase Dashboard, open Authentication > URL Configuration.

Set Site URL to the production desktop URL once Netlify is live:

```text
https://YOUR_SITE.netlify.app/desktop/
```

Add these Redirect URLs:

```text
http://127.0.0.1:5173/desktop/
http://127.0.0.1:5174/mobile/
http://localhost:5173/desktop/
http://localhost:5174/mobile/
https://YOUR_SITE.netlify.app/desktop/
https://YOUR_SITE.netlify.app/mobile/
https://**--YOUR_SITE.netlify.app/desktop/
https://**--YOUR_SITE.netlify.app/mobile/
```

The apps send clean callback URLs based on their Vite base paths:

- Desktop: `/desktop/`
- Mobile: `/mobile/`

## Provider Callback URL

Use this callback URL in Google Cloud, Apple Developer, and Microsoft Entra:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

## Google

1. In Google Cloud, create an OAuth client for a Web application.
2. Add authorized JavaScript origins:

```text
http://localhost:5173
http://localhost:5174
https://YOUR_SITE.netlify.app
```

3. Add the Supabase callback URL as an authorized redirect URI.
4. In Supabase Dashboard > Authentication > Providers > Google, enable Google and paste the Client ID and Client Secret.

## Apple

1. In Apple Developer, create/configure Sign in with Apple for the web.
2. Add the Supabase callback URL to the web redirect URLs.
3. In Supabase Dashboard > Authentication > Providers > Apple, enable Apple and add the required Apple credentials.

## Outlook / Microsoft

1. In Microsoft Entra ID, register a Web app.
2. Add the Supabase callback URL as the Web redirect URI.
3. Create a client secret.
4. In Supabase Dashboard > Authentication > Providers > Azure, enable Azure and paste the Application Client ID and Client Secret.
5. If this should be district-only, set the Azure Tenant URL to `https://login.microsoftonline.com/YOUR_TENANT_ID`. Otherwise Supabase uses the common Microsoft tenant behavior.

Admini requests `email openid profile` for Azure because Supabase needs a valid email from Microsoft sign in.

## Verify

Run the local apps after env changes:

```bash
npm run dev:desktop
npm run dev:mobile
```

Then open:

```text
http://127.0.0.1:5173/desktop/
http://127.0.0.1:5174/mobile/
```

Click Google, Apple, and Outlook. After each successful OAuth flow, the app should return to the same app path and show the signed-in session bar.

