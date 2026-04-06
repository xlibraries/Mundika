import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/utils/supabase/middleware";

const isProtected = (path: string) =>
  path.startsWith("/dashboard") ||
  path.startsWith("/parties") ||
  path.startsWith("/items") ||
  path.startsWith("/billing") ||
  path.startsWith("/ledger") ||
  path.startsWith("/inventory");

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  if (!supabase) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtected(pathname) && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
