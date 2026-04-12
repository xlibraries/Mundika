import { createBrowserClient } from "@supabase/ssr";
import { normalizeBasePath } from "@/lib/auth/site-url";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: {
      path: basePath || "/",
      sameSite: "lax",
    },
  });
