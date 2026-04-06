import { AppShell } from "@/components/layout/app-shell";
import { SyncProvider } from "@/components/providers/sync-provider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SyncProvider>
      <AppShell>{children}</AppShell>
    </SyncProvider>
  );
}
