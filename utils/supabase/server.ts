import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { normalizeBasePath } from "@/lib/auth/site-url";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export type CookieStore = Awaited<ReturnType<typeof cookies>>;

export const createClient = (cookieStore: CookieStore) => {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: {
      path: basePath || "/",
      sameSite: "lax",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* setAll from a Server Component — ignore if read-only */
        }
      },
    },
  });
};
