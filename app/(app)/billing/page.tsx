import { redirect } from "next/navigation";

/** Legacy URL: billing and purchases live under Workspace → Transactions. */
export default function BillingRedirectPage() {
  redirect("/dashboard?tx=billing");
}
