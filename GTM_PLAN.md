# Mundika — go-to-market (GTM) plan

This is a **practical playbook** for the next few hours and weeks: who to sell to, what to say, what to ship in product, and how **test keys differ from a first real sale**.

---

## Critical distinction: test keys vs revenue

| Mode | What you can prove | What you cannot do |
|------|--------------------|---------------------|
| **Razorpay test** (`rzp_test_…`) | Full checkout UX, webhook, plan flip to Starter in your app | Receive real INR in your bank |
| **Razorpay live** (`rzp_live_…`) | Real customer money (after Razorpay account activation / KYC as applicable) | Must protect keys, T&Cs, invoices if you promise them |

**If API keys or secrets appeared in chat, email, or a repo file, rotate them** in the Razorpay Dashboard and update Supabase secrets.

---

## Positioning (one sentence)

Mundika is **khatta khata + stock + bill** for **tier-2 / tier-3** shops — not GST books, not pakka ledger software.

Use this in every conversation so expectations stay aligned.

---

## Next 5–6 hours (execution sprint)

### Hour 0–1 — Make “money path” work in test

1. Apply DB migrations through `20260423100000_user_entitlements_razorpay.sql`.
2. Set Supabase Edge secrets (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, optional `RAZORPAY_STARTER_AMOUNT_PAISE`).
3. Deploy `create-razorpay-order`, `razorpay-confirm-payment`, `razorpay-webhook` (see `AGENTS.md`).
4. Local `.env.local`: `NEXT_PUBLIC_PAYMENT_PROVIDER=razorpay`, `NEXT_PUBLIC_RAZORPAY_CHECKOUT_ENABLED=true`.
5. Sign in → `/account` → run a **test** payment (Razorpay test cards / UPI test flows from their docs). Confirm plan shows Starter and `subscription_status` / period end look sane.

### Hour 1–2 — One “hero” demo

1. Record a **2-minute** screen capture: login → shop name → one bill / party line → `/account` test payment (blur secrets).
2. Host the video unlisted (YouTube) or Loom — link you can paste in WhatsApp.

### Hour 2–4 — Warm outreach (10 conversations, not 100 ads)

Target **people who already trust you** (relatives’ shops, your supplier’s counter, local mandi/trader group admins).

**Message template (Hinglish, short):**

> Namaste {name}, main {your name} bol raha hoon. Main ek simple phone wala hisaab bana raha hoon — party ka udhaar, roz stock, bill — GST wala heavy software nahi.  
> Kya aap 15 minute de sakte ho? Agar useful lage to ₹399/month soch sakte ho; abhi main pilot users dhoondh raha hoon.

Attach: demo link + `https://` your deployed app (GitHub Pages / Vercel / custom domain).

### Hour 4–6 — Close the loop

1. For anyone interested: **onboarding call** (screen share, create account for them if needed).
2. Ask one sharp question: *“Sabse pehle kaunsa kaam app se karna chaoge — udhaar list, stock, ya bill?”* → drive the demo there.
3. **First real ₹:** only after **live** Razorpay + clear promise (what they get for 30 days). Optionally first customer: manual Razorpay **Payment Link** from Dashboard while you harden in-app live.

---

## Week-1 GTM (after the sprint)

| Day | Action |
|-----|--------|
| 1–2 | Fix top 3 UX frictions from pilot calls (copy > features). |
| 3–4 | Same outreach template to 20 more warm leads; track replies in a sheet (name, shop type, follow-up date). |
| 5–7 | Publish one **clear** landing promise (already biased to khatta on `app/page.tsx`); avoid claiming GST compliance. |

---

## Metrics (minimum viable)

- **Pilot conversations started:** count DMs / calls placed.
- **Demos completed:** count screen shares.
- **Test checkouts (you + pilots):** validates integration.
- **Paid conversions:** count only **live** settlements (or signed manual invoices if you use that bridge).

---

## Product + legal hygiene before scaling paid

- **Refund / cancel policy** one paragraph (even if informal) — paste on `/account` or site footer when you charge live.
- **Privacy:** where shop data lives (local-first vs Supabase) — align copy with reality (`PROJECT_MAP.md`).
- **Support channel:** one WhatsApp Business or phone number you actually answer.

---

## Related repo docs

- [`AGENTS.md`](./AGENTS.md) — deploy steps for Stripe and Razorpay.
- [`PROJECT_MAP.md`](./PROJECT_MAP.md) — architecture and manual test matrix.
- [`.github/AGENT_PLAYBOOK.md`](./.github/AGENT_PLAYBOOK.md) — Dev / Tester / CEO loop for shipping fixes between sales calls.
