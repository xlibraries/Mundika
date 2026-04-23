import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Prevent open redirects: success/cancel must sit under configured site root. */
function assertAllowedReturnUrls(
  siteRoot: string,
  successUrl: string,
  cancelUrl: string
) {
  const root = normalizeBaseUrl(siteRoot);
  const s = successUrl.trim();
  const c = cancelUrl.trim();
  if (!s.startsWith(root + "/") && s !== root) {
    throw new Error("successUrl not under SITE_URL");
  }
  if (!c.startsWith(root + "/") && c !== root) {
    throw new Error("cancelUrl not under SITE_URL");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const siteUrl = Deno.env.get("SITE_URL")?.trim();
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  const starterPriceId = Deno.env.get("STRIPE_PRICE_ID_STARTER")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (
    !siteUrl ||
    !stripeSecret ||
    !starterPriceId ||
    !supabaseUrl ||
    !supabaseAnon ||
    !serviceRole
  ) {
    return json(500, { error: "Server billing configuration is incomplete" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Missing session" });
  }

  let body: { successUrl?: string; cancelUrl?: string };
  try {
    body = (await req.json()) as { successUrl?: string; cancelUrl?: string };
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const successUrl = body.successUrl ?? "";
  const cancelUrl = body.cancelUrl ?? "";
  if (!successUrl || !cancelUrl) {
    return json(400, { error: "successUrl and cancelUrl are required" });
  }

  try {
    assertAllowedReturnUrls(siteUrl, successUrl, cancelUrl);
  } catch (e) {
    return json(400, {
      error: e instanceof Error ? e.message : "Invalid return URLs",
    });
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();
  if (userErr || !user) {
    return json(401, { error: "Invalid or expired session" });
  }

  const stripe = new Stripe(stripeSecret);
  const admin = createClient(supabaseUrl, serviceRole);

  const { data: ent } = await admin
    .from("user_entitlements")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = ent?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    const { error: upErr } = await admin.from("user_entitlements").upsert(
      {
        user_id: user.id,
        plan_id: "free",
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (upErr) {
      console.error(upErr);
      return json(500, { error: "Could not save billing profile" });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: starterPriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    metadata: { user_id: user.id, plan_id: "starter" },
    subscription_data: {
      metadata: { user_id: user.id, plan_id: "starter" },
    },
  });

  if (!session.url) {
    return json(500, { error: "Stripe did not return a checkout URL" });
  }

  return json(200, { url: session.url });
});
