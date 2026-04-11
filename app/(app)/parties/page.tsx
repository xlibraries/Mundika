import { redirect } from "next/navigation";

export default function PartiesRedirectPage() {
  redirect("/analytics#ledger");
}
