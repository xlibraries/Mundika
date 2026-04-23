import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

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
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(message)
  );
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!keyId || !keySecret || !supabaseUrl || !supabaseAnon || !serviceRole) {
    return json(500, { error: "Razorpay configuration incomplete" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Missing session" });
  }

  let body: {
    orderId?: string;
    paymentId?: string;
    signature?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const orderId = (
    body.orderId ??
    body.razorpay_order_id ??
    ""
  ).trim();
  const paymentId = (
    body.paymentId ??
    body.razorpay_payment_id ??
    ""
  ).trim();
  const signature = (body.signature ?? body.razorpay_signature ?? "").trim();
  if (!orderId || !paymentId || !signature) {
    return json(400, {
      error:
        "orderId, paymentId, and signature are required (or razorpay_* equivalents)",
    });
  }

  const expectedSig = await hmacSha256Hex(
    keySecret,
    `${orderId}|${paymentId}`
  );
  if (!timingSafeEqualHex(expectedSig.toLowerCase(), signature.toLowerCase())) {
    return json(400, { error: "Invalid payment signature", success: false });
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

  const payRes = await fetch(
    `https://api.razorpay.com/v1/payments/${paymentId}`,
    { headers: { Authorization: basicAuthHeader(keyId, keySecret) } }
  );
  const pay = (await payRes.json()) as {
    status?: string;
    order_id?: string;
    error?: { description?: string };
  };
  if (!payRes.ok || pay.status !== "captured") {
    const msg = pay.error?.description ?? "Payment not captured";
    return json(400, { error: msg });
  }
  if (pay.order_id !== orderId) {
    return json(400, { error: "Payment does not match order" });
  }

  const ordRes = await fetch(
    `https://api.razorpay.com/v1/orders/${orderId}`,
    { headers: { Authorization: basicAuthHeader(keyId, keySecret) } }
  );
  const ord = (await ordRes.json()) as {
    notes?: Record<string, string>;
    error?: { description?: string };
  };
  if (!ordRes.ok) {
    return json(400, {
      error: ord.error?.description ?? "Could not load order",
    });
  }

  const noteUser = ord.notes?.user_id;
  if (!noteUser || noteUser !== user.id) {
    return json(403, { error: "Order does not belong to this user" });
  }

  const admin = createClient(supabaseUrl, serviceRole);
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);

  const { error: upErr } = await admin.from("user_entitlements").upsert(
    {
      user_id: user.id,
      plan_id: "starter",
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      subscription_status: "captured",
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upErr) {
    console.error(upErr);
    return json(500, { error: "Could not update plan" });
  }

  return json(200, { ok: true, success: true, verified: true });
});
