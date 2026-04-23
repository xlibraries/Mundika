export type ShopMemberRole = "owner" | "admin" | "member" | "viewer";

export type ShopRow = {
  id: string;
  name: string;
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type ShopMemberRow = {
  shop_id: string;
  user_id: string;
  role: ShopMemberRole;
  joined_at: string;
};
