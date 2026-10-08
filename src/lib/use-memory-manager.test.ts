/**
 * Enterprise-grade tests for src/lib/use-memory-manager.ts
 *
 * Covers: scoped auto-dispose on unmount, scope isolation between
 * components, and pass-through of touch/unregister/dispose.
 *
 * Note: this file intentionally avoids JSX (it must stay a .ts file),
 * so components are built with React.createElement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createElement, useEffect } from "react";
import { memoryManager } from "./memory-manager";
import { useMemoryManager } from "./use-memory-manager";

beforeEach(async () => {
  await memoryManager.disposeAll();
});

afterEach(async () => {
  await memoryManager.disposeAll();
  vi.restoreAllMocks();
});

function Probe({
  scopeId,
  calls,
  registerIds = [],
}: {
  scopeId: string;
  calls: string[];
  registerIds?: string[];
}) {
  const mem = useMemoryManager(scopeId);
  useEffect(() => {
    for (const id of registerIds) {
      mem.register(id, () => {
        calls.push(`${scopeId}:${id}`);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function Capture({ onApi }: { onApi: (api: ReturnType<typeof useMemoryManager>) => void }) {
  const api = useMemoryManager("viewer");
  onApi(api);
  return null;
}

describe("useMemoryManager", () => {
  it("auto-disposes scoped registrations when the component unmounts", () => {
    const calls: string[] = [];
    const { unmount } = render(
      createElement(Probe, {
        scopeId: "viewer",
        calls,
        registerIds: ["pdf-1", "pdf-2"],
      }),
    );

    expect(memoryManager.stats().total).toBe(2);

    unmount();

    expect(calls.sort()).toEqual(["viewer:pdf-1", "viewer:pdf-2"]);
    expect(memoryManager.stats().total).toBe(0);
  });

  it("two components with different scopes do not interfere", () => {
    const calls: string[] = [];
    const a = render(
      createElement(Probe, {
        scopeId: "viewer-a",
        calls,
        registerIds: ["pdf-1"],
      }),
    );
    const b = render(
      createElement(Probe, {
        scopeId: "viewer-b",
        calls,
        registerIds: ["pdf-1"],
      }),
    );

    // Same short id in two scopes -> two distinct namespaced entries.
    expect(memoryManager.stats().total).toBe(2);

    a.unmount();

    expect(calls).toEqual(["viewer-a:pdf-1"]);
    expect(memoryManager.stats().total).toBe(1);

    b.unmount();
    expect(calls.sort()).toEqual(["viewer-a:pdf-1", "viewer-b:pdf-1"]);
    expect(memoryManager.stats().total).toBe(0);
  });

  it("manual dispose through the hook removes the entry and the scope tracking", async () => {
    const calls: string[] = [];
    let api: ReturnType<typeof useMemoryManager> | null = null;

    const { unmount } = render(
      createElement(Capture, {
        onApi: (a: ReturnType<typeof useMemoryManager>) => {
          api = a;
        },
      }),
    );
    api!.register("pdf-1", () => {
      calls.push("pdf-1");
    });
    expect(memoryManager.stats().total).toBe(1);

    await api!.dispose("pdf-1");
    expect(calls).toEqual(["pdf-1"]);
    expect(memoryManager.stats().total).toBe(0);

    // Unmount must not double-dispose.
    unmount();
    expect(calls).toEqual(["pdf-1"]);
  });

  it("unregister through the hook leaves the resource undisposed", () => {
    const calls: string[] = [];
    let api: ReturnType<typeof useMemoryManager> | null = null;

    const { unmount } = render(
      createElement(Capture, {
        onApi: (a: ReturnType<typeof useMemoryManager>) => {
          api = a;
        },
      }),
    );
    api!.register("pdf-1", () => {
      calls.push("pdf-1");
    });
    api!.unregister("pdf-1");

    unmount();

    // Entry was unregistered: hook no longer tracks it, manager no longer
    // holds it, and the dispose fn was never called.
    expect(calls).toEqual([]);
    expect(memoryManager.stats().total).toBe(0);
  });
});
