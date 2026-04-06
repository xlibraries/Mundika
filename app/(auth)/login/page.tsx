import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[#5f6368]">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
