import { AppOnboardingShell } from "@/components/layout/app-onboarding-shell";
import { SyncProvider } from "@/components/providers/sync-provider";
import { AuthGuard } from "@/components/providers/auth-guard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SyncProvider>
        <AppOnboardingShell>{children}</AppOnboardingShell>
      </SyncProvider>
    </AuthGuard>
  );
}
