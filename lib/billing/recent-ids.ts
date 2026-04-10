const STORAGE_PREFIX = "mundika:billing:recent:";

export type RecentKey = "parties" | "items";

export function readRecentIds(key: RecentKey, limit = 20): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string").slice(0, limit);
  } catch {
    return [];
  }
}

export function rememberId(key: RecentKey, id: string, limit = 20) {
  if (typeof window === "undefined") return;
  const prev = readRecentIds(key, 999).filter((x) => x !== id);
  prev.unshift(id);
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(prev.slice(0, limit)));
  } catch {
    /* ignore quota */
  }
}
