/**
 * Normalizes a user-entered India mobile into E.164 (+91…).
 * Accepts 10 digits or already-prefixed 91… / +91….
 */
export function normalizeIndiaMobileE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    if (!/^[6-9]\d{9}$/.test(digits)) return null;
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    const rest = digits.slice(2);
    if (!/^[6-9]\d{9}$/.test(rest)) return null;
    return `+91${rest}`;
  }
  if (digits.length === 13 && digits.startsWith("91") && trimmed.startsWith("+")) {
    const rest = digits.slice(2);
    if (!/^[6-9]\d{9}$/.test(rest)) return null;
    return `+91${rest}`;
  }
  return null;
}
