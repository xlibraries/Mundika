import type { ShopMemberRole, ShopRow } from "@/lib/shops/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type ShopMemberWithShop = {
  role: ShopMemberRole;
  shops: ShopRow | null;
};

/**
 * First membership row for this user (single-shop MVP).
 */
export async function fetchPrimaryShopForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ shop: ShopRow; role: ShopMemberRole } | null> {
  const { data, error } = await supabase
    .from("shop_members")
    .select("role, shops (*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as ShopMemberWithShop;
  const shop = row.shops;
  if (!shop) return null;
  return { shop, role: row.role };
}

export async function ensureDefaultShopForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ shop: ShopRow; role: ShopMemberRole }> {
  const existing = await fetchPrimaryShopForUser(supabase, userId);
  if (existing) return existing;

  const { data: shopId, error: rpcErr } = await supabase.rpc(
    "create_shop_with_owner",
    { p_name: "My shop" }
  );
  if (rpcErr) throw rpcErr;
  if (typeof shopId !== "string") {
    throw new Error("Could not create shop");
  }

  const { data: shop, error: loadErr } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .single();

  if (loadErr || !shop) throw loadErr ?? new Error("Shop not found after create");
  return { shop: shop as ShopRow, role: "owner" };
}

export async function updateShopProfile(
  supabase: SupabaseClient,
  shopId: string,
  patch: Partial<
    Pick<
      ShopRow,
      | "name"
      | "legal_name"
      | "address_line1"
      | "address_line2"
      | "city"
      | "state_region"
      | "postal_code"
      | "country"
      | "phone"
    >
  >
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("shops")
    .update({ ...patch, updated_at: now })
    .eq("id", shopId);
  if (error) throw error;
}
