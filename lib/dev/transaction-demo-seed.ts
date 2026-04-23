/**
 * Gate for the analytics dev seed panel. Opt-in so production bundles stay quiet.
 */
export function isTransactionDemoSeedEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TRANSACTION_DEMO_SEED === "true";
}
