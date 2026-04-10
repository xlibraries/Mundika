import { redirect } from "next/navigation";

export default function PartiesRedirectPage() {
  redirect("/dashboard#parties");
}
