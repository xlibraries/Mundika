import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next =
    searchParams.get("next")?.startsWith("/") &&
    !searchParams.get("next")?.startsWith("//")
      ? searchParams.get("next")!
      : "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "oauth_callback");
  login.searchParams.set(
    "error_description",
    "Google sign-in could not be completed. Check the provider setup and try again."
  );
  return NextResponse.redirect(login);
}
