import { AppShell } from "@/components/layout/app-shell";
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
        <AppShell>{children}</AppShell>
      </SyncProvider>
    </AuthGuard>
  );
}
