/**
 * Validates Stripe Checkout return URLs (must stay under SITE_URL root).
 * Keep in sync with `supabase/functions/create-checkout-session/index.ts`.
 */
export function normalizeSiteRoot(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function assertCheckoutReturnUrlsAllowed(
  siteRoot: string,
  successUrl: string,
  cancelUrl: string
): void {
  const root = normalizeSiteRoot(siteRoot);
  const s = successUrl.trim();
  const c = cancelUrl.trim();
  if (!s.startsWith(`${root}/`) && s !== root) {
    throw new Error("successUrl not under SITE_URL");
  }
  if (!c.startsWith(`${root}/`) && c !== root) {
    throw new Error("cancelUrl not under SITE_URL");
  }
}
