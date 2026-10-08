import { useEffect, useRef } from "react";
import { memoryManager } from "./memory-manager";

/**
 * Scopes resource registrations to a component's lifetime.
 * Everything registered through this hook is disposed when the component
 * unmounts. Ids are namespaced per scope so components can't collide.
 *
 * Usage:
 *   const mem = useMemoryManager("viewer");
 *   mem.register("pdf-1", () => pdf.destroy(), { label: "pdf" });
 */
export function useMemoryManager(scopeId: string) {
  const prefix = `scope:${scopeId}:`;
  const idsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ids = idsRef.current;
    return () => {
      for (const id of ids) void memoryManager.dispose(id);
      ids.clear();
    };
  }, []);

  const scoped = (id: string) => prefix + id;

  return {
    register: (
      id: string,
      dispose: () => void | Promise<void>,
      opts?: { label?: string; bytes?: number },
    ) => {
      const full = scoped(id);
      idsRef.current.add(full);
      memoryManager.register(full, dispose, opts);
      return full;
    },
    touch: (id: string) => memoryManager.touch(scoped(id)),
    unregister: (id: string) => {
      idsRef.current.delete(scoped(id));
      memoryManager.unregister(scoped(id));
    },
    dispose: (id: string) => {
      idsRef.current.delete(scoped(id));
      return memoryManager.dispose(scoped(id));
    },
  };
}
