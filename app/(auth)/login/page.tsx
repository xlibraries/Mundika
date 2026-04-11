import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[#5c6e62]">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
