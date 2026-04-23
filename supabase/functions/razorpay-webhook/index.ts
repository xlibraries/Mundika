import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function basicAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!keyId || !keySecret || !webhookSecret || !supabaseUrl || !serviceRole) {
    return json(500, { error: "Webhook configuration incomplete" });
  }

  const rawBody = await req.text();
  const sigHeader =
    req.headers.get("x-razorpay-signature") ??
    req.headers.get("X-Razorpay-Signature") ??
    "";

  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  if (!timingSafeEqualHex(expected.toLowerCase(), sigHeader.toLowerCase())) {
    return json(400, { error: "Invalid webhook signature" });
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; status?: string } };
    };
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  if (payload.event !== "payment.captured") {
    return json(200, { ignored: true });
  }

  const pay = payload.payload?.payment?.entity;
  const paymentId = pay?.id;
  const orderId = pay?.order_id;
  if (!paymentId || !orderId || pay?.status !== "captured") {
    return json(200, { ignored: true });
  }

  const ordRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: { Authorization: basicAuthHeader(keyId, keySecret) },
  });
  const ord = (await ordRes.json()) as {
    notes?: Record<string, string>;
    error?: { description?: string };
  };
  if (!ordRes.ok) {
    console.error("order fetch", ord.error);
    return json(200, { ignored: true });
  }

  const userId = ord.notes?.user_id;
  if (!userId) {
    console.warn("razorpay order missing user_id note", orderId);
    return json(200, { ignored: true });
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const { error } = await admin.from("user_entitlements").upsert(
    {
      user_id: userId,
      plan_id: "starter",
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      subscription_status: "captured",
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) console.error("webhook upsert", error);

  return json(200, { received: true });
});
