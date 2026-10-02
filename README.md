# TechMart — Full-Stack E-Commerce App

A complete online store built for the **HNG Stage Two** assessment: a React storefront
backed by Supabase (Postgres + Auth + Row Level Security), with transactional order
placement and Mailgun email receipts, deployed on Vercel.

**Live demo:** _add your Vercel URL here after deploying_

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [1. Supabase setup](#1-supabase-setup)
- [2. Google OAuth setup](#2-google-oauth-setup)
- [3. Mailgun setup](#3-mailgun-setup)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Deploying to Vercel](#deploying-to-vercel)
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
| **Email** | Mailgun confirmation through a serverless function — the API key never reaches the browser |
| **UX** | Toast notifications, error boundary, friendly error translation, responsive Tailwind UI, 404 page |

## Tech stack

- **Frontend:** React 18, Vite 5, React Router 6, Tailwind CSS 3
- **Backend / data:** Supabase — Postgres, Auth (Google OAuth + email), Row Level Security, RPC
- **Email:** Mailgun via a Vercel serverless function (`api/send-order-email.js`)
- **Hosting:** Vercel (SPA rewrite configured in `vercel.json`)

## Project structure

```
.
├── api/
│   └── send-order-email.js      # Vercel function: verifies the user, sends Mailgun email
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
3. Copy the **Client ID** and **Client secret**.
4. In Supabase: **Authentication → Providers → Google** → enable it, paste the
   client ID and secret, and save.
5. Make sure `http://localhost:5173/auth/callback` and your production
   `/auth/callback` are listed in **Authentication → URL Configuration → Redirect URLs**
   (step above) or Google will return an error on the way back.

If something is misconfigured, the `/auth/callback` page shows the provider's error
message with a link back to sign-in rather than a blank screen.

---

## 3. Mailgun setup

1. Create a Mailgun account and add/verify a sending domain.
2. From **Sending → Domains** copy the domain (e.g. `mg.yourdomain.com`).
3. From **Settings → API keys** copy a **private** API key.
4. Add these to `.env` (they are **server-only** — read by `api/send-order-email.js`,
   never bundled into the browser):

   | Variable | Value |
   | --- | --- |
   | `MAILGUN_API_KEY` | your private API key |
   | `MAILGUN_DOMAIN` | your Mailgun sending domain |
   | `MAILGUN_FROM_EMAIL` | e.g. `orders@mg.yourdomain.com` |
   | `MAILGUN_FROM_NAME` | e.g. `TechMart Orders` |
   | `MAILGUN_REPLY_TO` | e.g. `support@mg.yourdomain.com` |
   | `MAILGUN_API_BASE` | `https://api.mailgun.net` (use `https://api.eu.mailgun.net` for EU) |

**How it works:** after an order is created, the browser `POST`s to
`/api/send-order-email` with the shopper's Supabase access token. The function:

1. Verifies the token against Supabase (no service-role key needed),
2. Loads the order through PostgREST **as that user**, so RLS guarantees a user can
   only email their *own* order,
3. Builds the HTML receipt and sends it with Mailgun.

Email failure never invalidates an order — the order stands and the UI reports that
the email could not be sent.

---

## Environment variables

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | ✅ | Supabase anon/public key |
| `MAILGUN_API_KEY` | server | ✅ | Mailgun private key |
| `MAILGUN_DOMAIN` | server | ✅ | Mailgun sending domain |
| `MAILGUN_FROM_EMAIL` | server | ✅ | From address for receipts |
| `MAILGUN_FROM_NAME` | server | – | Display name (default `TechMart Orders`) |
| `MAILGUN_REPLY_TO` | server | – | Reply-to address |
| `MAILGUN_API_BASE` | server | – | Mailgun region (default `https://api.mailgun.net`) |
| `APP_URL` | server | – | Public origin used for email links (default `http://localhost:5173`) |
| `VITE_STORE_NAME` | browser | – | Store name in the UI (default `TechMart`) |
| `VITE_CURRENCY` | browser | – | Currency code (default `NGN`) |
| `VITE_DELIVERY_FEE` | browser | – | Display delivery fee (default `2500`) |
| `VITE_FREE_DELIVERY_THRESHOLD` | browser | – | Display free-delivery threshold (default `150000`) |

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
4. Deploy.
5. Finally, add `https://your-app.vercel.app/auth/callback` to:
   - Supabase **Authentication → URL Configuration → Redirect URLs**, and
   - the Google OAuth client's **Authorised JavaScript origins / redirect URIs**.

`vercel.json` rewrites all non-API, non-asset paths to `/index.html` so client-side
routes (such as `/orders` or `/product/:id`) work on a hard refresh.

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
   └─ lib/orders.js → POST /api/send-order-email → Mailgun receipt
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

Requires **Node.js ≥ 18**.

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
  Mailgun credentials are read from `process.env` inside the serverless function.
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