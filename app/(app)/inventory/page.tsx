import { redirect } from "next/navigation";

export default function InventoryRedirectPage() {
  redirect("/analytics#stock");
}
