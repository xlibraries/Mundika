"use client";

import { useUserId } from "@/hooks/use-user-id";
import { TransactionForm } from "@/components/transaction/transaction-form";

export default function BillingPage() {
  const { userId, loading } = useUserId();
  if (loading || !userId)
    return (
      <div className="h-40 animate-pulse rounded border border-[#dadce0] bg-[#f8f9fa]" />
    );
  return <TransactionForm userId={userId} defaultMode="billing" />;
}
