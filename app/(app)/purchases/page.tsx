import { redirect } from "next/navigation";

/** Legacy URL: use Workspace → Transactions → Purchase. */
export default function PurchasesRedirectPage() {
  redirect("/dashboard?tx=purchase");
}
