import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function planFromSubscription(
  sub: Stripe.Subscription,
  starterPriceId: string
): "starter" | "free" {
  const active = sub.status === "active" || sub.status === "trialing";
  const priceId = sub.items.data[0]?.price?.id;
  if (active && priceId === starterPriceId) return "starter";
  return "free";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();
  const starterPriceId = Deno.env.get("STRIPE_PRICE_ID_STARTER")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (
    !stripeSecret ||
    !webhookSecret ||
    !starterPriceId ||
    !supabaseUrl ||
    !serviceRole
  ) {
    return json(500, { error: "Webhook configuration incomplete" });
  }

  const stripe = new Stripe(stripeSecret);
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return json(400, { error: "Missing stripe-signature" });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (e) {
    console.error(e);
    return json(400, { error: "Invalid Stripe signature" });
  }

  const admin = createClient(supabaseUrl, serviceRole);

  async function upsertFromSubscription(sub: Stripe.Subscription) {
    const userId =
      sub.metadata?.user_id ??
      (typeof sub.customer === "string"
        ? undefined
        : sub.customer?.metadata?.user_id);
    if (!userId) {
      console.warn("subscription without user_id metadata", sub.id);
      return;
    }

    const planId = planFromSubscription(sub, starterPriceId);
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

    const row = {
      user_id: userId,
      plan_id: planId,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin.from("user_entitlements").upsert(row, {
      onConflict: "user_id",
    });
    if (error) console.error("upsert user_entitlements", error);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId = session.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subId);
        await upsertFromSubscription(sub);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertFromSubscription(sub);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error(e);
    return json(500, { error: "Handler failed" });
  }

  return json(200, { received: true });
});
