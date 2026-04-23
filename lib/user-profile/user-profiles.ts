import type { SupabaseClient } from "@supabase/supabase-js";

export type UserProfileOnboardingRow = {
  onboarding_completed_at: string | null;
};

/** `true` when onboarding is finished; `false` when missing profile row or not completed. */
export async function fetchUserOnboardingStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("onboarding_completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  if (!data) return false;
  const row = data as UserProfileOnboardingRow;
  return !!row.onboarding_completed_at?.trim();
}

export async function upsertUserProfileOnboardingComplete(
  supabase: SupabaseClient,
  userId: string,
  input: {
    phone_e164: string;
    phone_verified_at: string | null;
  }
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      phone_e164: input.phone_e164,
      phone_verified_at: input.phone_verified_at,
      onboarding_completed_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  return { error: error ? new Error(error.message) : null };
}

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
