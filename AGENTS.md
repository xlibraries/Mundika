<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Optional agent toolchains (product + delivery)

Use these when you want structured founder workflow, multi-role reviews, or agent infrastructure beyond this repo.

| Resource | Role | Install / use |
| -------- | ---- | ------------- |
| [slavingia/skills](https://github.com/slavingia/skills) (Minimalist Entrepreneur) | Community → validate → MVP → pricing → marketing | In **Claude Code**: `/plugin marketplace add slavingia/skills` then `/plugin install minimalist-entrepreneur`. Maps to commands like `/validate-idea`, `/pricing`, `/first-customers`. |
| [xlibraries/gstack](https://github.com/xlibraries/gstack) | Virtual CEO / design / eng / QA / ship | Clone and run `./setup` per [gstack README](https://github.com/xlibraries/gstack/blob/main/README.md); for **Cursor** use `./setup --host cursor` so skills land under `~/.cursor/skills/gstack-*`. |
| [HKUDS/OpenSpace](https://github.com/HKUDS/OpenSpace) | Self-evolving skills + MCP for agents | Python `pip install -e .`; wire `openspace-mcp` into MCP config with `OPENSPACE_HOST_SKILL_DIRS` pointing at this project’s skill folders (see OpenSpace README). |
| [xlibraries/rover](https://github.com/xlibraries/rover) | DOM-native site automation + agent task protocol | npm SDK for embeds; see rover README for `POST /v1/tasks` and site discovery. Relevant if Mundika gets an in-app agent surface. |

**Mundika pricing source of truth:** `lib/pricing/plans.ts` (marketing grid; **Starter** CTA → `/subscribe?plan=starter` → sign-in if needed → Stripe or Razorpay checkout). Free/Business CTAs still use `/login?plan=…`. Session hint `mundika.selectedPlanId` is set after OAuth when `plan` is present on `/auth/callback`.

**Functional backlog (GitHub):** issues [#24](https://github.com/xlibraries/Mundika/issues/24)–[#33](https://github.com/xlibraries/Mundika/issues/33) (auth, shop profile, org, onboarding, billing per shop, audit, branches, export, sync UX, marketing).

**Three-agent loop:** see [`.github/AGENT_PLAYBOOK.md`](.github/AGENT_PLAYBOOK.md) (Dev + Tester + CEO prompts for parallel sessions).

**Project map, scope, and E2E checklist:** [`PROJECT_MAP.md`](./PROJECT_MAP.md) (khatta-only positioning, tier-2/3 focus, Vitest + Playwright smoke + manual matrix).

**GTM (first pilots and first real sale):** [`GTM_PLAN.md`](./GTM_PLAN.md).

**Supabase Auth → URL configuration:** add redirect URLs for password recovery and email confirmation, e.g. `http://localhost:3000/auth/reset-password`, `http://localhost:3000/auth/callback`, plus the same paths on your deployed origin (include `NEXT_PUBLIC_BASE_PATH` if used, e.g. `https://user.github.io/Mundika/auth/reset-password`).

### Stripe billing (Supabase Edge Functions + static export)

The app uses `output: "export"` (e.g. GitHub Pages), so there are no Next.js API routes. Checkout and webhooks run as **Supabase Edge Functions**:

| Function | Purpose |
| -------- | ------- |
| `create-checkout-session` | Authenticated user → Stripe Checkout (Starter recurring price). |
| `stripe-webhook` | `checkout.session.completed`, `customer.subscription.updated` / `deleted` → upsert `public.user_entitlements`. |

1. Apply migration `supabase/migrations/20260422100000_user_entitlements.sql` in the Supabase SQL editor (or `supabase db push`).
2. Create a Stripe **Product** + **recurring Price** (INR 399/mo or your amount); copy the Price id (`price_...`) into `STRIPE_PRICE_ID_STARTER`.
3. Set secrets (CLI example):  
   `supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_PRICE_ID_STARTER=price_... SUPABASE_SERVICE_ROLE_KEY=... SITE_URL=https://your-exact-app-root`  
   `SITE_URL` must match the URLs the browser sends as `successUrl` / `cancelUrl` (include `/Mundika` if you use `NEXT_PUBLIC_BASE_PATH`).
4. Deploy:  
   `supabase functions deploy create-checkout-session`  
   `supabase functions deploy stripe-webhook`  
   (`stripe-webhook` has `verify_jwt = false` in `supabase/config.toml` — Stripe calls it without a Supabase JWT.)
5. In Stripe Dashboard, add webhook URL `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` and subscribe to the events above.
6. In the app env: `NEXT_PUBLIC_STRIPE_CHECKOUT_ENABLED=true` so `/account` shows **Subscribe to Starter**.

Return URL validation is shared with tests in `lib/billing/return-url-allowed.ts` (logic duplicated in the Edge Function — keep them aligned).

### Razorpay Starter (India — Standard Web Checkout)

Uses **Razorpay Orders API** (`POST https://api.razorpay.com/v1/orders`), **Standard Checkout** (`https://checkout.razorpay.com/v1/checkout.js`), **HMAC-SHA256** verification on the server, and optional **webhook** backup.

Because the app uses **`output: "export"`**, there are **no Next.js `/api/*` routes**. The equivalents are **Supabase Edge Functions** (JWT on create / verify / confirm; webhook unsigned):

| Typical REST name | Edge Function | Role |
| ----------------- | ------------- | ---- |
| `POST /api/create-order` | `create-razorpay-order` | Auth user → create Razorpay order (amount ≥ 100 paise, locked to Starter `RAZORPAY_STARTER_AMOUNT_PAISE` if body sends `amount`). Returns `order_id`, `orderId`, `amount`, `currency`, `keyId`. |
| `POST /api/verify-payment` | `verify-razorpay-payment` | Auth user → HMAC `order_id\|payment_id` vs `razorpay_signature`; **does not** write entitlements (signature check only). |
| (subscribe flow) | `razorpay-confirm-payment` | Verifies signature **and** payment captured **and** order notes → upserts `user_entitlements` for Starter. |

The **Node `razorpay` SDK** is not required: Edge code calls Razorpay over **HTTPS + Basic auth** with `fetch`.

1. Apply migrations through `20260423100000_user_entitlements_razorpay.sql` (adds `razorpay_order_id` / `razorpay_payment_id` on `user_entitlements`).
2. Supabase secrets (Dashboard or `supabase secrets set`):

   - `RAZORPAY_KEY_ID` — Key ID from Razorpay Dashboard (test or live).
   - `RAZORPAY_KEY_SECRET` — Key secret (never commit; never put in the Next bundle).
   - `RAZORPAY_WEBHOOK_SECRET` — Webhook signing secret from Razorpay (for `razorpay-webhook`).
   - `RAZORPAY_STARTER_AMOUNT_PAISE` — optional; default **39900** (₹399.00).
   - Plus existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

3. Deploy Edge Functions:

   - `supabase functions deploy create-razorpay-order`
   - `supabase functions deploy verify-razorpay-payment`
   - `supabase functions deploy razorpay-confirm-payment`
   - `supabase functions deploy razorpay-webhook` (`verify_jwt = false` in `supabase/config.toml`)

4. Razorpay Dashboard → **Webhooks** → URL  
   `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`  
   Subscribe at least to **payment.captured** (backup if the user closes the tab before the in-app confirm call runs).

5. App env (`.env.local` or hosting):  
   `NEXT_PUBLIC_PAYMENT_PROVIDER=razorpay`  
   `NEXT_PUBLIC_RAZORPAY_CHECKOUT_ENABLED=true`  
   `NEXT_PUBLIC_RAZORPAY_KEY_ID=<same Key ID as Razorpay Dashboard>` (public only; used as fallback if the create-order response omits `keyId`).  
   Then open **`/account`** while signed in → **Pay for Starter (Razorpay)**.

**Test vs live:** Test keys only create test payments (no real settlement). A **first real sale** needs live keys, completed Razorpay activation/KYC where required, and webhook URL reachable from Razorpay’s servers.

**Security:** If a key secret was ever pasted into chat, a ticket, or committed by mistake, **rotate** it in the Razorpay Dashboard and update Supabase secrets.
