import { AppShell } from "@/components/layout/app-shell";
import { OnboardingGate } from "@/components/layout/onboarding-gate";
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
        <AppShell>
          <OnboardingGate>{children}</OnboardingGate>
        </AppShell>
      </SyncProvider>
    </AuthGuard>
  );
}
