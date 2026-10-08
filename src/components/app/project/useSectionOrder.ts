/**
 * useSectionOrder — lets the user rearrange dashboard sections and keeps
 * their preferred order across visits (localStorage, per storage key).
 *
 * Returns [order, moveUp, moveDown, reset]. Stored orders are sanitized:
 * unknown ids are dropped, and any ids missing from storage are appended
 * in default order so new sections always show up.
 */
import { useCallback, useState } from "react";

function sanitizeOrder(stored: string[] | null, defaultOrder: string[]): string[] {
  if (!Array.isArray(stored) || stored.length === 0) return [...defaultOrder];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of stored) {
    if (typeof id === "string" && defaultOrder.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of defaultOrder) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

function readStored(key: string, defaultOrder: string[]): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [...defaultOrder];
    return sanitizeOrder(JSON.parse(raw) as string[], defaultOrder);
  } catch {
    return [...defaultOrder];
  }
}

export function useSectionOrder(storageKey: string, defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(() => readStored(storageKey, defaultOrder));

  const persist = useCallback(
    (next: string[]) => {
      setOrder(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // localStorage unavailable — order still applies for this session.
      }
    },
    [storageKey],
  );

  const moveUp = useCallback(
    (id: string) => {
      const i = order.indexOf(id);
      if (i <= 0) return;
      const next = [...order];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      persist(next);
    },
    [order, persist],
  );

  const moveDown = useCallback(
    (id: string) => {
      const i = order.indexOf(id);
      if (i < 0 || i >= order.length - 1) return;
      const next = [...order];
      [next[i + 1], next[i]] = [next[i], next[i + 1]];
      persist(next);
    },
    [order, persist],
  );

  const reset = useCallback(() => persist([...defaultOrder]), [persist, defaultOrder]);

  return [order, moveUp, moveDown, reset] as const;
}
