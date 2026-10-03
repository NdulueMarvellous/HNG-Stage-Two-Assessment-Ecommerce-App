# TechMart — Full-Stack E-Commerce App

A complete online store built for the **HNG Stage Two** assessment: a React storefront
backed by Supabase (Postgres + Auth + Row Level Security), with transactional order
placement and Nodemailer email receipts, deployed on Vercel.

**Live demo:** https://hng-stage-two-assessment-ecommerce.vercel.app

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [1. Supabase setup](#1-supabase-setup)
- [2. Google OAuth setup](#2-google-oauth-setup)
  - [Consent-screen branding](#consent-screen-branding-techmart-instead-of-project-refsupabaseco)
  - [Troubleshooting: Google sign-in](#troubleshooting-google-sign-in)
- [3. Email setup (Nodemailer over Google SMTP)](#3-email-setup-nodemailer-over-google-smtp)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Deploying to Vercel](#deploying-to-vercel)
  - [Troubleshooting: "Supabase is not configured yet"](#troubleshooting-supabase-is-not-configured-yet)
- [How an order is placed](#how-an-order-is-placed)
- [Scripts](#scripts)
- [Security notes](#security-notes)

---

## Features

| Area | What it does |
| --- | --- |
| **Catalogue** | Product grid, search, category filter, sort, "in stock only", paginated-friendly skeleton loaders |
| **Product page** | Full details, live stock badge, quantity clamp, related items from the same category |
| **Cart** | Persists to `localStorage`, re-checks price/stock against the database on load, auto-reconciles stale items |
| **Checkout** | Validated delivery form, pre-filled from the user's profile / Google account, double-submit guard |
| **Authentication** | Google OAuth **and** email/password via Supabase Auth, protected routes, session refresh |
| **Orders** | Transactional `place_order` RPC, order history, per-order receipt page, resend email |
| **Email** | Nodemailer (SMTP) confirmation through a serverless function — the credentials never reach the browser |
| **UX** | Toast notifications, error boundary, friendly error translation, responsive Tailwind UI, 404 page |

## Tech stack

- **Frontend:** React 18, Vite 5, React Router 6, Tailwind CSS 3
- **Backend / data:** Supabase — Postgres, Auth (Google OAuth + email), Row Level Security, RPC
- **Email:** Nodemailer over SMTP via a Vercel serverless function (`api/send-order-email.js`)
- **Hosting:** Vercel (SPA rewrite configured in `vercel.json`)

## Project structure

```
.
├── api/
│   └── send-order-email.js      # Vercel function: verifies the user, sends the receipt
├── public/
│   └── favicon.svg
├── src/
│   ├── components/              # Layout, Navbar, Footer, ProductCard, Feedback,
│   │                            # ProtectedRoute, ErrorBoundary
│   ├── context/                 # AuthContext, CartContext, ToastContext
│   ├── lib/                     # supabase client, products, orders, format, errors, constants
│   ├── pages/                   # Home, Shop, ProductDetails, Cart, Checkout, OrderSuccess,
│   │                            # MyOrders, Login, AuthCallback, NotFound
│   ├── App.jsx                  # Routes + providers
│   ├── main.jsx
│   └── index.css
├── supabase/
│   ├── schema.sql               # Tables, RLS policies, place_order() function, trigger
│   └── seed.sql                 # 12 demo products
├── .env.example                 # Template for all environment variables
├── eslint.config.js
├── tailwind.config.js
├── vercel.json                  # Build settings, function config, SPA rewrite
└── vite.config.js               # React plugin + local /api middleware for dev
```

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file and fill it in (see "Supabase setup" below)
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux

# 3. Run the dev server
npm run dev                 # http://localhost:5173
```

Until real Supabase keys are in `.env`, the app still boots and shows an amber
**"Setup needed"** banner instead of failing silently.

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the whole of **`supabase/schema.sql`** and run it.
   This creates:
   - `profiles` — one row per user, auto-created by a trigger on `auth.users`
   - `products` — the catalogue (`price` and `stock` are the source of truth)
   - `orders` / `order_items` — customer details, line items and totals
   - **Row Level Security** policies: products are public read-only; a user can only
     read their own profile and their own orders
   - `place_order(p_customer jsonb, p_items jsonb)` — the transactional order function
3. Then run **`supabase/seed.sql`** to load the 12 demo products.
   Both files are safe to re-run (they use `if not exists` / `on conflict do nothing`).
4. Copy your keys from **Project Settings → API** into `.env`:
   - `VITE_SUPABASE_URL` → *Project URL*
   - `VITE_SUPABASE_ANON_KEY` → *anon / public* key (safe to expose; RLS protects the data)

> **Never** put the `service_role` key in `.env` or any `VITE_*` variable — those are
> compiled into the browser bundle. This project does not need it.

### Auth settings

In **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` (use your Vercel URL in production)
- **Redirect URLs:** add both
  - `http://localhost:5173/auth/callback`
  - `https://your-app.vercel.app/auth/callback`

The app requests the OAuth redirect back to `<origin>/auth/callback`; the
`AuthContext` and `AuthCallback` page handle the exchange and return the shopper
to wherever they were heading (e.g. back to checkout).

---

## 2. Google OAuth setup

1. **Google Cloud Console → APIs & Services → Credentials → Create credentials →
   OAuth client ID → Web application.**
2. Under **Authorised redirect URIs**, add your Supabase callback (this is Supabase's
   URL, **not** your app's):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   The app's own `/auth/callback` does **not** belong here.
   Under **Authorised JavaScript origins**, add every origin you load the app from:
   ```
   http://localhost:5173
   https://your-app.vercel.app
   ```
3. Copy the **Client ID** and **Client secret**.
4. In Supabase: **Authentication → Providers → Google** → enable it, paste the
   client ID **and** the client secret, and save. Both are required, and they must come
   from the **same** OAuth client: authorising with a client ID alone succeeds, then the
   token exchange fails with `Unable to exchange external code` when the secret is
   missing, stale or copied from another client.
5. Make sure `http://localhost:5173/auth/callback` and your production
   `/auth/callback` are listed in **Authentication → URL Configuration → Redirect URLs**
   (step above) or Google will return an error on the way back.

If something is misconfigured, the `/auth/callback` page shows the provider's error
message with a link back to sign-in rather than a blank screen.

> **`{"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`**
> means step 4 was skipped - the Google provider is still switched *off* in Supabase.
> You see raw JSON rather than an in-app message because `signInWithOAuth()` sends the
> browser directly to Supabase's `/auth/v1/authorize` endpoint, so that JSON **is** the
> page the browser lands on and the app is no longer running to catch it. The login page
> reads `/auth/v1/settings` on load and disables the Google button when the provider is
> off, so this should not happen - but if you hit it, enable Google and hard-refresh.
> Verify with `curl https://<ref>.supabase.co/auth/v1/settings -H "apikey: <anon-key>"`
> and check that `"google": true`.

### Consent-screen branding: "TechMart" instead of `<project-ref>.supabase.co`

Google decides what the consent screen says, never this codebase — and it shows the app
name **only once the brand has been verified**:

> "The app name will be displayed on the OAuth consent screen **only if your app has been
> verified**." — [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049)

Until then Google falls back to showing the **authorised domain of the redirect URI**, so
shoppers see `<project-ref>.supabase.co` (e.g. `wlsimpfxbtbjgthdhynu.supabase.co`)
instead of the store name. This is a Google-side setting; no code change can alter it.
To put **TechMart** on the screen:

1. Open **Google Auth Platform → Branding**
   (`https://console.cloud.google.com/auth/branding`) and fill in:
   - **App name:** `TechMart`
   - **User support email**, **App logo** (square, 120×120, ≤ 1 MB)
   - **App domain** — home page, privacy policy and terms URLs on your Vercel domain
2. On **Audience**, either add your own Google account as a **test user** (stays in
   *Testing*) or move the app to **External → In production**.
3. Click **Submit for verification** (this is the lightweight *brand verification* when you
   only request non-sensitive scopes such as `email`/`profile`). When it passes, the status
   becomes **Ready to publish** — click **Publish branding**. Verification is not automatic
   and can take a few business days; an approved result must be published within 7 days.
4. *(Optional)* Supabase's own advice is to give the project a **custom domain**
   (`auth.example.com`), so the domain shown next to the name is yours rather than
   `<project-ref>.supabase.co`. See [Custom domains](https://supabase.com/docs/guides/platform/custom-domains).

### Troubleshooting: Google sign-in

| What the shopper sees | Cause | Fix |
| --- | --- | --- |
| `Unable to exchange external code: 4/0A…` | Google handed back an auth code but Supabase could not trade it for tokens. Almost always a **missing / mismatched Client secret**, or an OAuth client that does not list the Supabase callback | **Authentication → Providers → Google**: re-paste the **Client ID *and* Client secret** from the *same* OAuth client (watch for stray spaces) and save. Confirm that client lists `https://<project-ref>.supabase.co/auth/v1/callback` under **Authorised redirect URIs** |
| `Error 400: redirect_uri_mismatch` | The Google client has no matching redirect URI | Add the exact Supabase callback above — `https`, no trailing slash, and wait 1–2 minutes for it to propagate |
| `{"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}` | Google is still switched off in Supabase | Enable it (step 4) and hard-refresh |
| Consent screen offers access to `…supabase.co` | Brand not verified yet | Configure **Branding** and publish brand verification, as above |
| Sign-in loops back to `/login` with no session | The app origin is missing from Supabase **Redirect URLs** | Add `<origin>/auth/callback` (local **and** production) in **Authentication → URL Configuration** |

`/auth/callback` forwards the raw `error_description` through the shared translator in
`src/lib/errors.js`, so the two OAuth misconfigurations above appear as actionable text
instead of a bare Supabase error string.

---

## 3. Email setup (Nodemailer over Google SMTP)

Order confirmations are sent with [Nodemailer](https://nodemailer.com/) over plain
**SMTP**. This deployment is configured for **Google (Gmail / Google Workspace)**. The
code is provider-agnostic, so any other SMTP service works too — see
[Other providers](#other-providers).

### Create a Gmail App Password

Gmail will not accept your normal account password. You need a 16-character
**App Password**, which requires 2-Step Verification:

1. Open **Google Account → Security** and turn on **2-Step Verification**.
2. Go to **Security → App passwords** (`https://myaccount.google.com/apppasswords`).
3. Create one named e.g. `TechMart` and copy the **16-character** value it shows
   (the spaces can be kept or removed — both work).

> App passwords only appear once 2-Step Verification is on. On a **Google Workspace**
> account an admin may have disabled them for the organisation — if so, ask for them to
> be enabled, or use another provider from the table below.

### Set the variables

Add these to `.env` (they are **server-only** — read by `api/send-order-email.js`,
never bundled into the browser):

| Variable | Required | Value |
| --- | --- | --- |
| `SMTP_HOST` | ✅\* | `smtp.gmail.com` |
| `SMTP_PORT` | ✅\* | `465` (SSL) — or `587` for STARTTLS |
| `SMTP_SECURE` | – | blank = auto (`true` on 465, STARTTLS on 587) |
| `SMTP_USER` | ✅ | your **full** Google address, e.g. `you@gmail.com` |
| `SMTP_PASS` | ✅ | the 16-character **App Password** |
| `MAIL_FROM_EMAIL` | ✅ | same address as `SMTP_USER` (see the note below) |
| `MAIL_FROM_NAME` | – | display name (default `TechMart Orders`) |
| `MAIL_REPLY_TO` | – | reply-to address, e.g. the same Gmail address |
| `SMTP_SERVICE` | – | `Gmail` — fills in host/port/secure instead of the two above |
| `SMTP_URL` | – | one connection string; wins over host/port/secure |

\* Supply **either** `SMTP_HOST` + `SMTP_PORT`, **or** `SMTP_SERVICE`, **or**
`SMTP_URL`.

A working Google block:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=you@gmail.com
SMTP_PASS=abcdefghijklmnop
MAIL_FROM_EMAIL=you@gmail.com
MAIL_FROM_NAME=TechMart Orders
MAIL_REPLY_TO=you@gmail.com
```

> **Gmail rewrites the From header.** Unless the address has been added and verified as
> an alias under **Gmail → Settings → Accounts and Import → "Send mail as"**, Gmail
> replaces your `MAIL_FROM_EMAIL` with the signed-in account. Set `MAIL_FROM_EMAIL` to
> the same address as `SMTP_USER` (or a Gmail alias you verified).

### Other providers

Swapping provider is a **`.env` change only** — no code edit. Point
`SMTP_HOST`/`SMTP_PORT` at the service and put its key (or credential pair) in
`SMTP_PASS`:

| Provider | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` |
| --- | --- | --- | --- |
| **Google / Gmail** | `smtp.gmail.com` | `465` | full Gmail address |
| Brevo | `smtp-relay.brevo.com` | `587` | Brevo login email |
| Mailjet | `in-v3.mailjet.com` | `587` | API key (public) |
| Resend | `smtp.resend.com` | `465` | literally `resend` |
| Postmark | `smtp.postmarkapp.com` | `587` | Server API token |
| Zoho Mail | `smtp.zoho.com` | `465` | full Zoho address |

**How it works:** after an order is created, the browser `POST`s to
`/api/send-order-email` with the shopper's Supabase access token. The function:

1. Verifies the token against Supabase (no service-role key needed),
2. Loads the order through PostgREST **as that user**, so RLS guarantees a user can
   only email their *own* order,
3. Builds the plain-text + HTML receipt and sends it through a Nodemailer SMTP
   transport, with 10s/15s timeouts so a slow mail server cannot hold the serverless
   invocation open (no connection pooling, since one invocation sends one message).

Email failure never invalidates an order — the order stands and the UI reports that
the email could not be sent.

> **Deliverability:** Gmail only lets the signed-in account send as itself, or as an
> alias you verified under **Send mail as** — so keep `MAIL_FROM_EMAIL` equal to
> `SMTP_USER`. Gmail rewriting the From header is normal, not an error.
>
> **Limits:** a Gmail account can send on the order of **2,000 messages/day** (roughly
> 500/day for a personal `@gmail.com`, and Google throttles brand-new accounts). Fine
> for a demo; a real storefront should send from a verified domain.
>
> **Common send failures** appear in the function logs (Vercel → Deployments →
> Functions, or the terminal running `npm run dev`):
>
> - `Invalid login` / `535 … Username and Password not accepted` — wrong `SMTP_USER`
>   or `SMTP_PASS`. For Gmail this must be an **App Password**, and 2-Step
>   Verification has to be on.
> - `534 … Application-specific password required` — you are using the Google account
>   password; create an App Password instead.
> - `ECONNREFUSED` / timeout — wrong host or port (Gmail: `smtp.gmail.com`, `465` or
>   `587`).
> - `ESOCKET … wrong version number` — `SMTP_SECURE` disagrees with the port; leave it
>   blank and let the port decide.

---

## Environment variables

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | ✅ | Supabase anon/public key |
| `SMTP_HOST` | server | ✅\* | SMTP host (Google: `smtp.gmail.com`) |
| `SMTP_PORT` | server | – | `465` (SSL) or `587` (STARTTLS); `587` if unset |
| `SMTP_SECURE` | server | – | `true` for implicit TLS (465); blank = auto |
| `SMTP_USER` | server | – | Full SMTP / Google address |
| `SMTP_PASS` | server | – | Gmail App Password (or another provider's API key) |
| `SMTP_SERVICE` | server | – | Well-known service name, e.g. `Gmail` |
| `SMTP_URL` | server | – | Connection URL; overrides host/port/secure |
| `MAIL_FROM_EMAIL` | server | ✅ | From address for receipts |
| `MAIL_FROM_NAME` | server | – | Display name (default `TechMart Orders`) |
| `MAIL_REPLY_TO` | server | – | Reply-to address |
| `APP_URL` | server | – | Public origin used for email links (default `http://localhost:5173`) |
| `VITE_STORE_NAME` | browser | – | Store name in the UI (default `TechMart`) |
| `VITE_CURRENCY` | browser | – | Currency code (default `NGN`) |
| `VITE_DELIVERY_FEE` | browser | – | Display delivery fee (default `2500`) |
| `VITE_FREE_DELIVERY_THRESHOLD` | browser | – | Display free-delivery threshold (default `150000`) |

> \* `SMTP_HOST` may be replaced by `SMTP_SERVICE` or `SMTP_URL` — see
> [Email setup](#3-email-setup-nodemailer-smtp).

> The delivery numbers are **display only**. The authoritative calculation lives in
> `supabase/schema.sql → place_order()`. If you change them in one place, change them
> in the other (`src/lib/constants.js`) and re-run the SQL.

---

## Running locally

```bash
npm run dev        # http://localhost:5173
```

`vite.config.js` includes a small middleware that mounts every file in `/api` on the
dev server, so **`/api/send-order-email` is fully testable locally** with `npm run dev`
— no need for `vercel dev`. (Vite does not serve serverless functions on its own.)

Useful checks:

```bash
npm run lint       # ESLint
npm run build      # production build → dist/
npm run preview    # serve the built app on http://localhost:4173
```

`npm run vercel:dev` is available if you prefer to run inside the real Vercel runtime.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** your repository. Vercel reads
   `vercel.json`, so the framework (`vite`), build command, output directory and the
   `api/*.js` function config are detected automatically — no manual settings needed.
3. Add **all** the environment variables from the table above in
   **Project → Settings → Environment Variables**. Set:
   - `APP_URL` → your production URL (e.g. `https://your-app.vercel.app`)
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → same Supabase project
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM_EMAIL`
     → your mail provider's details (see [Email setup](#3-email-setup-nodemailer-smtp))
4. Deploy.
5. Finally, add `https://your-app.vercel.app/auth/callback` to:
   - Supabase **Authentication → URL Configuration → Redirect URLs**, and
   - the Google OAuth client's **Authorised JavaScript origins / redirect URIs**.

`vercel.json` rewrites all non-API, non-asset paths to `/index.html` so client-side
routes (such as `/orders` or `/product/:id`) work on a hard refresh.

### Troubleshooting: "Supabase is not configured yet"

If the **live** site shows a "Setup needed" banner at the top and
"Supabase is not configured yet. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
to .env…" where the products should be, the deployed bundle was built **without** those
two variables. They are read from `import.meta.env` and Vite **inlines `VITE_*` values
at build time**, so they must exist where the build runs — not just on your machine
(the local `.env` is git-ignored and never reaches the host).

Fix it on the host, in this order:

1. **Vercel → your project → Settings → Environment Variables.** Add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the exact values from your
   local `.env`, ticking **Production**, **Preview** (and **Development** if you use
   `vercel dev`). Check for stray leading/trailing spaces.
2. **Redeploy** (Deployments → ⋯ → Redeploy, or push a commit). This is required —
   adding an environment variable does **not** rebuild an existing deployment.
3. While you are there, set `APP_URL` to the live origin
   (`https://your-app.vercel.app`) and add the same origin to Supabase
   **Authentication → URL Configuration** (Site URL + `.../auth/callback` redirect).

> **Most common cause:** the **Supabase ⇄ Vercel integration** creates the variables
> under *Next.js* names — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
> plus the bare `SUPABASE_URL` / `SUPABASE_ANON_KEY`. This app is **Vite**, which only
> exposes `VITE_*` variables, so those names are silently ignored. You must add the
> `VITE_SUPABASE_*` pair as well (the values can be identical). Check what the project
> actually has with `vercel env ls`.

`npm run build` now fails with a message naming any missing/placeholder variables
instead of shipping a broken build. To force a build without them, set
`ALLOW_MISSING_SUPABASE_ENV=1`.

---

## How an order is placed

The browser **never sends a price**. This is what happens at checkout:

```
Checkout.jsx
   └─ lib/orders.js → supabase.rpc('place_order', { p_customer, p_items })
        └─ Postgres place_order()                         [one transaction]
             1. reject an empty / unauthenticated cart
             2. lock each product row  (SELECT … FOR UPDATE)
             3. verify the product is active and has enough stock
             4. recompute subtotal from products.price
             5. apply delivery fee  (0 when subtotal ≥ 150000, else 2500)
             6. INSERT orders + order_items, then reduce products.stock
             7. RETURN the created order (id, order_number, totals, status)
   └─ lib/orders.js → POST /api/send-order-email → Nodemailer (SMTP) receipt
```

Because pricing, validation and stock decrement happen together inside Postgres, two
shoppers cannot oversell the last item, and a tampered client cannot invent a price.

### Routes

| Path | Page | Access |
| --- | --- | --- |
| `/` | Home — hero, featured products, categories | Public |
| `/shop` | Shop — search, filter, sort | Public |
| `/product/:id` | Product details + related items | Public |
| `/cart` | Cart with live price/stock re-check | Public |
| `/login` | Sign in (Google or email) | Public |
| `/auth/callback` | OAuth landing route | Public |
| `/checkout` | Delivery form + order summary | **Signed in** |
| `/order-success/:orderId` | Order receipt | **Signed in** |
| `/orders` | Order history | **Signed in** |
| `*` | 404 | Public |

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server (port 5173) with local `/api` support |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build (port 4173) |
| `npm run lint` | Run ESLint over the project |
| `npm run vercel:dev` | Run the app inside the Vercel dev runtime |

Requires **Node.js ≥ 20** (required by Nodemailer 10).

---

## Security notes

- **Row Level Security is the boundary.** `products` are readable by everyone;
  `profiles`, `orders` and `order_items` are readable only by their owner.
- **`place_order()` is `security definer` and granted to `authenticated` only** —
  anonymous users cannot create orders.
- **No service-role key anywhere in the app.** The email function re-uses the caller's
  own access token, so RLS still applies.
- **Prices and stock are never trusted from the client** — they are re-read and
  re-validated inside the database transaction.
- **Secrets stay server-side.** Only `VITE_*` variables reach the browser bundle;
  SMTP credentials are read from `process.env` inside the serverless function.
- `.env` is git-ignored. Use `.env.example` as the template.

---

## Notes / known limitations

- No real payment gateway — this is a demo storefront, as stated in the footer.
- Stock is decremented at order time only; there is no reservation/expiry window.
- Order statuses (`pending`, `confirmed`, `processing`, `shipped`, `delivered`,
  `cancelled`) are defined in `src/lib/constants.js`; changing them is an admin/SQL task.
- The demo catalogue in `supabase/seed.sql` uses remote Unsplash images.

## License

Built for the HNG internship Stage Two assessment. Free to use for learning purposes.