/**
 * Enterprise-grade tests for src/lib/memory-manager.ts
 *
 * Covers: register/dispose lifecycle, unregister semantics, label-scoped
 * disposeAll, LRU eviction + touch recency, double-dispose safety, async
 * dispose awaiting, heap-pressure eviction, hidden-tab sweep, and stats.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryManager } from "./memory-manager";

const LABEL = "pdf";

function makeDispose(name: string, calls: string[]) {
  return () => {
    calls.push(name);
  };
}

beforeEach(async () => {
  await memoryManager.disposeAll();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(async () => {
  await memoryManager.disposeAll();
  memoryManager.setActiveIdProvider(null);
  // Remove per-test DOM/perf stubs so tests stay isolated.
  try {
    delete (performance as unknown as Record<string, unknown>).memory;
  } catch {
    /* ignore */
  }
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("register / dispose lifecycle", () => {
  it("register + dispose calls the dispose fn and removes the entry", async () => {
    const calls: string[] = [];
    memoryManager.register("pdf-1", makeDispose("pdf-1", calls), {
      label: LABEL,
    });
    expect(memoryManager.stats().total).toBe(1);

    await memoryManager.dispose("pdf-1");

    expect(calls).toEqual(["pdf-1"]);
    expect(memoryManager.stats().total).toBe(0);
  });

  it("disposing an unknown id is a safe no-op", async () => {
    await expect(memoryManager.dispose("does-not-exist")).resolves.toBeUndefined();
  });

  it("re-registering the same id disposes the previous resource first", async () => {
    const calls: string[] = [];
    memoryManager.register("pdf-1", makeDispose("first", calls), {
      label: LABEL,
    });
    memoryManager.register("pdf-1", makeDispose("second", calls), {
      label: LABEL,
    });

    // Let the fire-and-forget safeDispose flush.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(calls).toContain("first");
    expect(memoryManager.stats().total).toBe(1);

    await memoryManager.dispose("pdf-1");
    expect(calls).toContain("second");
  });

  it("async dispose functions are awaited before dispose() resolves", async () => {
    let finished = false;
    memoryManager.register(
      "pdf-async",
      async () => {
        await new Promise((r) => setTimeout(r, 25));
        finished = true;
      },
      { label: LABEL },
    );

    await memoryManager.dispose("pdf-async");
    expect(finished).toBe(true);
  });

  it("a throwing dispose fn never rejects dispose()", async () => {
    memoryManager.register(
      "pdf-boom",
      () => {
        throw new Error("destroy failed");
      },
      { label: LABEL },
    );
    await expect(memoryManager.dispose("pdf-boom")).resolves.toBeUndefined();
    expect(memoryManager.stats().total).toBe(0);
  });
});

describe("unregister", () => {
  it("unregister without dispose leaves the resource alive (no dispose call)", async () => {
    const calls: string[] = [];
    memoryManager.register("pdf-1", makeDispose("pdf-1", calls), {
      label: LABEL,
    });

    memoryManager.unregister("pdf-1");

    expect(calls).toEqual([]);
    expect(memoryManager.stats().total).toBe(0);
    // And a later dispose() is a no-op since the entry is gone.
    await memoryManager.dispose("pdf-1");
    expect(calls).toEqual([]);
  });
});

describe("disposeAll with label prefix", () => {
  it("only disposes entries whose label or id matches the prefix", async () => {
    const calls: string[] = [];
    memoryManager.register("pdf-1", makeDispose("pdf-1", calls), {
      label: "pdf",
    });
    memoryManager.register("pdf-2", makeDispose("pdf-2", calls), {
      label: "pdf",
    });
    memoryManager.register("img-1", makeDispose("img-1", calls), {
      label: "img",
    });

    await memoryManager.disposeAll("pdf");

    expect(calls.sort()).toEqual(["pdf-1", "pdf-2"]);
    expect(memoryManager.stats().total).toBe(1);
    expect(memoryManager.stats().byLabel).toEqual({ img: 1 });
  });

  it("disposeAll() with no prefix disposes everything", async () => {
    const calls: string[] = [];
    memoryManager.register("a", makeDispose("a", calls), { label: "pdf" });
    memoryManager.register("b", makeDispose("b", calls), { label: "img" });

    await memoryManager.disposeAll();

    expect(calls.sort()).toEqual(["a", "b"]);
    expect(memoryManager.stats().total).toBe(0);
  });
});

describe("LRU eviction", () => {
  it("registering a 9th same-label resource evicts the least-recently-used one", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];

    vi.setSystemTime(1_000);
    for (let i = 1; i <= 8; i++) {
      memoryManager.register(`pdf-${i}`, makeDispose(`pdf-${i}`, calls), {
        label: LABEL,
      });
    }
    expect(memoryManager.stats().total).toBe(8);

    vi.setSystemTime(2_000);
    memoryManager.register("pdf-9", makeDispose("pdf-9", calls), {
      label: LABEL,
    });

    // Eviction is fire-and-forget; flush microtasks.
    await Promise.resolve();

    expect(memoryManager.stats().total).toBe(8);
    expect(calls).toEqual(["pdf-1"]);
  });

  it("touch() refreshes recency so a touched resource survives eviction", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];

    vi.setSystemTime(1_000);
    memoryManager.register("pdf-a", makeDispose("pdf-a", calls), {
      label: LABEL,
    });
    memoryManager.register("pdf-b", makeDispose("pdf-b", calls), {
      label: LABEL,
    });
    memoryManager.register("pdf-c", makeDispose("pdf-c", calls), {
      label: LABEL,
    });

    vi.setSystemTime(2_000);
    memoryManager.touch("pdf-a");

    vi.setSystemTime(3_000);
    for (const n of ["d", "e", "f", "g", "h", "i"]) {
      memoryManager.register(`pdf-${n}`, makeDispose(`pdf-${n}`, calls), {
        label: LABEL,
      });
    }
    await Promise.resolve();

    // pdf-b is the oldest untouched entry -> evicted. pdf-a was touched at t=2000.
    expect(calls).toEqual(["pdf-b"]);
    expect(memoryManager.stats().total).toBe(8);
  });

  it("eviction is scoped per label — other labels are untouched", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];

    vi.setSystemTime(1_000);
    for (let i = 1; i <= 8; i++) {
      memoryManager.register(`pdf-${i}`, makeDispose(`pdf-${i}`, calls), {
        label: "pdf",
      });
      memoryManager.register(`img-${i}`, makeDispose(`img-${i}`, calls), {
        label: "img",
      });
    }
    vi.setSystemTime(2_000);
    memoryManager.register("pdf-9", makeDispose("pdf-9", calls), {
      label: "pdf",
    });
    await Promise.resolve();

    expect(calls).toEqual(["pdf-1"]);
    expect(memoryManager.stats().byLabel).toEqual({ pdf: 8, img: 8 });
  });
});

describe("double-dispose safety", () => {
  it("disposing twice does not throw and does not double-call", async () => {
    const calls: string[] = [];
    memoryManager.register("pdf-1", makeDispose("pdf-1", calls), {
      label: LABEL,
    });

    await memoryManager.dispose("pdf-1");
    await memoryManager.dispose("pdf-1");

    expect(calls).toEqual(["pdf-1"]);
  });

  it("disposeAll after dispose does not re-dispose", async () => {
    const calls: string[] = [];
    memoryManager.register("pdf-1", makeDispose("pdf-1", calls), {
      label: LABEL,
    });

    await memoryManager.dispose("pdf-1");
    await memoryManager.disposeAll();

    expect(calls).toEqual(["pdf-1"]);
  });
});

describe("heap-pressure eviction", () => {
  // NOTE: the singleton starts its 30s watcher interval once, on the first
  // register() of the process. Its timer regime therefore depends on test
  // order, so these tests invoke the private checkPressure() directly —
  // the exact code path the interval calls — instead of racing timers.
  const checkPressure = () =>
    (memoryManager as unknown as { checkPressure(): Promise<void> }).checkPressure();

  it("above 80% heap usage keeps the 2 most recent per label and disposes the rest", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // performance.memory does not exist in test DOM — stub it above threshold.
    Object.defineProperty(performance, "memory", {
      value: { usedJSHeapSize: 850, jsHeapSizeLimit: 1000 }, // 85%
      configurable: true,
    });

    vi.setSystemTime(1_000);
    for (let i = 1; i <= 5; i++) {
      memoryManager.register(`pdf-${i}`, makeDispose(`pdf-${i}`, calls), {
        label: "pdf",
      });
    }
    expect(memoryManager.stats().total).toBe(5);

    await checkPressure();

    expect(memoryManager.stats().total).toBe(2);
    expect(calls.sort()).toEqual(["pdf-1", "pdf-2", "pdf-3"]);
  });

  it("below 80% heap usage nothing is evicted", async () => {
    const calls: string[] = [];
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    Object.defineProperty(performance, "memory", {
      value: { usedJSHeapSize: 500, jsHeapSizeLimit: 1000 }, // 50%
      configurable: true,
    });

    for (let i = 1; i <= 5; i++) {
      memoryManager.register(`pdf-${i}`, makeDispose(`pdf-${i}`, calls), {
        label: LABEL,
      });
    }

    await checkPressure();

    expect(calls).toEqual([]);
    expect(memoryManager.stats().total).toBe(5);
  });

  it("without performance.memory (non-Chromium) the watcher is a no-op", async () => {
    const calls: string[] = [];
    // Ensure no memory stub exists.
    expect((performance as unknown as { memory?: unknown }).memory).toBeUndefined();

    for (let i = 1; i <= 3; i++) {
      memoryManager.register(`pdf-${i}`, makeDispose(`pdf-${i}`, calls), {
        label: LABEL,
      });
    }

    await checkPressure();

    expect(calls).toEqual([]);
    expect(memoryManager.stats().total).toBe(3);
  });
});

describe("visibilitychange sweep", () => {
  function setHidden(hidden: boolean) {
    Object.defineProperty(document, "hidden", {
      value: hidden,
      configurable: true,
    });
  }

  async function flush() {
    // Flush microtasks AND any pending fake-timer work (onHidden disposes
    // sequentially via async calls).
    await vi.advanceTimersByTimeAsync(10);
  }

  it("hidden tab sweeps stale resources but keeps recently-touched ones", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    vi.setSystemTime(1_000);
    memoryManager.register("pdf-old", makeDispose("pdf-old", calls), {
      label: LABEL,
    });
    memoryManager.register("pdf-fresh", makeDispose("pdf-fresh", calls), {
      label: LABEL,
    });

    // Age the entries past the 60s recency window, then touch one.
    vi.setSystemTime(1_000 + 61_000);
    memoryManager.touch("pdf-fresh");

    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();

    expect(calls).toEqual(["pdf-old"]);
    expect(memoryManager.stats().total).toBe(1);
  });

  it("the active id from the provider is exempt from the sweep", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    vi.setSystemTime(1_000);
    memoryManager.register("pdf-active", makeDispose("pdf-active", calls), {
      label: LABEL,
    });
    memoryManager.register("pdf-idle", makeDispose("pdf-idle", calls), {
      label: LABEL,
    });

    vi.setSystemTime(1_000 + 61_000);
    memoryManager.setActiveIdProvider(() => "pdf-active");

    setHidden(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();

    expect(calls).toEqual(["pdf-idle"]);
    expect(memoryManager.stats().total).toBe(1);
  });

  it("visible tab does not trigger a sweep", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];

    vi.setSystemTime(1_000);
    memoryManager.register("pdf-1", makeDispose("pdf-1", calls), {
      label: LABEL,
    });
    vi.setSystemTime(1_000 + 61_000);

    setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();

    expect(calls).toEqual([]);
    expect(memoryManager.stats().total).toBe(1);
  });
});

describe("stats()", () => {
  it("returns accurate totals, per-label counts, and byte estimates", () => {
    memoryManager.register("a", () => undefined, { label: "pdf", bytes: 100 });
    memoryManager.register("b", () => undefined, { label: "pdf", bytes: 200 });
    memoryManager.register("c", () => undefined, { label: "img" });

    expect(memoryManager.stats()).toEqual({
      total: 3,
      byLabel: { pdf: 2, img: 1 },
      estimatedBytes: 300,
    });
  });
});
