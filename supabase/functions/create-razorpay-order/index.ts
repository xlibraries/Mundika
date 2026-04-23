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
  const pair = `${keyId}:${keySecret}`;
  const b64 = btoa(pair);
  return `Basic ${b64}`;
}

type CreateOrderBody = {
  amount?: number;
  currency?: string;
  receipt?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  const amountRaw = Deno.env.get("RAZORPAY_STARTER_AMOUNT_PAISE")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")?.trim();

  const configuredPaise = amountRaw ? Number.parseInt(amountRaw, 10) : 399_00;
  if (
    !keyId ||
    !keySecret ||
    !supabaseUrl ||
    !supabaseAnon ||
    !Number.isFinite(configuredPaise) ||
    configuredPaise < 100
  ) {
    return json(500, { error: "Razorpay billing configuration is incomplete" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Missing session" });
  }

  let bodyInput: CreateOrderBody = {};
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const raw = await req.text();
      if (raw.trim()) {
        const parsed: unknown = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          bodyInput = parsed as CreateOrderBody;
        }
      }
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }
  }

  let amountPaise = configuredPaise;
  if (bodyInput.amount !== undefined && bodyInput.amount !== null) {
    if (
      typeof bodyInput.amount !== "number" ||
      !Number.isInteger(bodyInput.amount) ||
      bodyInput.amount < 100
    ) {
      return json(400, {
        error: "amount must be an integer of at least 100 paise",
      });
    }
    if (bodyInput.amount !== configuredPaise) {
      return json(400, {
        error: "amount must match the configured Starter plan (paise)",
      });
    }
    amountPaise = bodyInput.amount;
  }

  let currency = (bodyInput.currency ?? "INR").trim().toUpperCase();
  if (currency !== "INR") {
    return json(400, { error: "currency must be INR for this product" });
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

  const defaultReceipt = `mk_${user.id.replace(/-/g, "").slice(0, 14)}`;
  let receipt = typeof bodyInput.receipt === "string" ? bodyInput.receipt.trim() : "";
  if (receipt.length > 40) {
    return json(400, { error: "receipt must be at most 40 characters" });
  }
  if (!receipt) receipt = defaultReceipt;
  const safeReceipt = receipt.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || defaultReceipt;

  const orderBody = {
    amount: amountPaise,
    currency,
    receipt: safeReceipt,
    notes: {
      user_id: user.id,
      product: "mundika_starter_month1",
    },
  };

  const rz = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(keyId, keySecret),
    },
    body: JSON.stringify(orderBody),
  });

  const rzJson = (await rz.json()) as {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string; code?: string };
  };

  if (!rz.ok || !rzJson.id) {
    const msg =
      rzJson.error?.description ??
      rzJson.error?.code ??
      "Razorpay order creation failed";
    return json(500, { error: msg });
  }

  return json(200, {
    order_id: rzJson.id,
    amount: rzJson.amount ?? amountPaise,
    currency: rzJson.currency ?? currency,
    orderId: rzJson.id,
    keyId,
  });
});
