import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchUserProfilePhone(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("phone_e164")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { phone_e164: string | null };
  return row.phone_e164?.trim() || null;
}

export async function upsertUserProfilePhone(
  supabase: SupabaseClient,
  userId: string,
  phoneE164: string | null
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  if (!phoneE164) {
    const { error } = await supabase.from("user_profiles").upsert(
      { user_id: userId, phone_e164: null, updated_at: now },
      { onConflict: "user_id" }
    );
    return { error: error ? new Error(error.message) : null };
  }
  const { error } = await supabase.from("user_profiles").upsert(
    { user_id: userId, phone_e164: phoneE164, updated_at: now },
    { onConflict: "user_id" }
  );
  return { error: error ? new Error(error.message) : null };
}
