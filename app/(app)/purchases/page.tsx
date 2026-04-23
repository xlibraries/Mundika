import { redirect } from "next/navigation";

/** Legacy URL: purchase flow is off; land on billing workspace. */
export default function PurchasesRedirectPage() {
  redirect("/dashboard");
}
