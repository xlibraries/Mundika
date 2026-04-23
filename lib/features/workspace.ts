/**
 * Stock-in from suppliers (“Purchase” mode on the Dashboard workspace).
 * Toggle off with `NEXT_PUBLIC_WORKSPACE_PURCHASE_ENABLED=false` if needed.
 */
export const workspacePurchaseFlowEnabled =
  process.env.NEXT_PUBLIC_WORKSPACE_PURCHASE_ENABLED !== "false";
