import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/utils/supabase/middleware";

const isProtected = (path: string) =>
  path.startsWith("/dashboard") ||
  path.startsWith("/analytics") ||
  path.startsWith("/parties") ||
  path.startsWith("/items") ||
  path.startsWith("/billing") ||
  path.startsWith("/purchases") ||
  path.startsWith("/ledger") ||
  path.startsWith("/inventory");

function clearStaleAuthCookies(request: NextRequest, response: NextResponse) {
  for (const { name } of request.cookies.getAll()) {
    if (!name.includes("-auth-token")) continue;
    response.cookies.delete(name);
  }
}

export async function proxy(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  if (!supabase) {
    return response;
  }

  let shouldClearAuthCookies = false;
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    if (error && error.code === "refresh_token_not_found") {
      shouldClearAuthCookies = true;
    }
  } catch {
    shouldClearAuthCookies = true;
  }

  if (shouldClearAuthCookies) {
    clearStaleAuthCookies(request, response);
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") && user) {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    if (shouldClearAuthCookies) {
      clearStaleAuthCookies(request, redirect);
    }
    return redirect;
  }

  if (isProtected(pathname) && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(login);
    if (shouldClearAuthCookies) {
      clearStaleAuthCookies(request, redirect);
    }
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
