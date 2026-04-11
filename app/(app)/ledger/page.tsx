import { redirect } from "next/navigation";

export default function LedgerRedirectPage() {
  redirect("/analytics#ledger");
}
