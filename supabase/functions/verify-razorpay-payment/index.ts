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

type VerifyBody = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  order_id?: string;
  payment_id?: string;
  orderId?: string;
  paymentId?: string;
  signature?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")?.trim();

  if (!keySecret || !supabaseUrl || !supabaseAnon) {
    return json(500, { error: "Razorpay verify configuration incomplete" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Missing session" });
  }

  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const orderId = (
    body.razorpay_order_id ??
    body.order_id ??
    body.orderId ??
    ""
  ).trim();
  const paymentId = (
    body.razorpay_payment_id ??
    body.payment_id ??
    body.paymentId ??
    ""
  ).trim();
  const signature = (body.razorpay_signature ?? body.signature ?? "").trim();

  if (!orderId || !paymentId || !signature) {
    return json(400, {
      error:
        "Missing fields: razorpay_order_id, razorpay_payment_id, razorpay_signature",
      success: false,
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

  return json(200, { success: true, verified: true });
});
