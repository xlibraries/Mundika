import { redirect } from "next/navigation";

/** Legacy URL: operational billing lives under Workspace; SaaS plan under Account. */
export default function BillingRedirectPage() {
  redirect("/account");
}
