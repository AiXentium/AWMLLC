/**
 * Central memory manager — safety net against resource leaks.
 *
 * Framework-agnostic (no React imports). The React hook lives in
 * use-memory-manager.ts. Any heavy resource (PDF documents, large canvases,
 * workers) should be registered here so LRU eviction, heap-pressure
 * watching, and tab-hide cleanup can reclaim it even if a caller forgets.
 */

export type DisposeFn = () => void | Promise<void>;

export interface RegisteredResource {
  id: string;
  dispose: DisposeFn;
  label: string;
  bytes?: number;
  lastUsed: number;
  // Resolve resources used within the same millisecond by actual usage order.
  usageOrder: number;
  createdAt: number;
}

export interface RegisterOptions {
  label?: string;
  bytes?: number;
}

interface HeapMemoryInfo {
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

const MAX_RESOURCES_PER_LABEL = 8;
const PRESSURE_RATIO = 0.8;
const PRESSURE_CHECK_MS = 30_000;
// Resources touched within this window are treated as active and exempt
// from hidden-tab disposal even when no active-id provider is set.
const RECENTLY_USED_MS = 60_000;

class MemoryManager {
  private resources = new Map<string, RegisteredResource>();
  private watchersStarted = false;
  private usageOrder = 0;
  private getActiveId: (() => string | null) | null = null;

  register(id: string, dispose: DisposeFn, opts: RegisterOptions = {}): void {
    const label = opts.label ?? "default";
    // Re-registering the same id replaces the entry — dispose the old one
    // first so a reload never orphans the previous resource.
    const existing = this.resources.get(id);
    if (existing) {
      void this.safeDispose(existing);
    }
    this.resources.set(id, {
      id,
      dispose,
      label,
      bytes: opts.bytes,
      lastUsed: Date.now(),
      usageOrder: ++this.usageOrder,
      createdAt: Date.now(),
    });
    this.enforceLru(label);
    this.startWatchers();
  }

  touch(id: string): void {
    const r = this.resources.get(id);
    if (r) {
      r.lastUsed = Date.now();
      r.usageOrder = ++this.usageOrder;
    }
  }

  unregister(id: string): void {
    this.resources.delete(id);
  }

  async dispose(id: string): Promise<void> {
    const r = this.resources.get(id);
    if (!r) return;
    this.resources.delete(id);
    await this.safeDispose(r);
  }

  async disposeAll(labelOrIdPrefix?: string): Promise<void> {
    const ids: string[] = [];
    for (const [id, r] of this.resources) {
      if (
        !labelOrIdPrefix ||
        r.label.startsWith(labelOrIdPrefix) ||
        id.startsWith(labelOrIdPrefix)
      ) {
        ids.push(id);
      }
    }
    // Dispose sequentially to avoid a thundering herd on heavy resources.
    for (const id of ids) await this.dispose(id);
  }

  stats(): {
    total: number;
    byLabel: Record<string, number>;
    estimatedBytes: number;
  } {
    const byLabel: Record<string, number> = {};
    let estimatedBytes = 0;
    for (const r of this.resources.values()) {
      byLabel[r.label] = (byLabel[r.label] ?? 0) + 1;
      estimatedBytes += r.bytes ?? 0;
    }
    return { total: this.resources.size, byLabel, estimatedBytes };
  }

  /**
   * Lets the app declare which resource is actively viewed. That id is
   * exempt from hidden-tab disposal. Components should clear this on unmount.
   */
  setActiveIdProvider(fn: (() => string | null) | null): void {
    this.getActiveId = fn;
  }

  /** Keep at most MAX_RESOURCES_PER_LABEL per label; evict least-recently-used. */
  private enforceLru(label: string): void {
    const ofLabel = [...this.resources.values()]
      .filter((r) => r.label === label)
      .sort((a, b) => a.lastUsed - b.lastUsed || a.usageOrder - b.usageOrder);
    while (ofLabel.length > MAX_RESOURCES_PER_LABEL) {
      const victim = ofLabel.shift();
      if (!victim) break;
      void this.dispose(victim.id);
    }
  }

  private async safeDispose(r: RegisteredResource): Promise<void> {
    try {
      await r.dispose();
    } catch {
      // Dispose must never throw — a dead resource is not an error.
    }
  }

  private startWatchers(): void {
    if (this.watchersStarted || typeof window === "undefined") return;
    this.watchersStarted = true;
    window.setInterval(() => void this.checkPressure(), PRESSURE_CHECK_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void this.onHidden();
    });
  }

  private getHeapInfo(): HeapMemoryInfo {
    const perf = performance as unknown as {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    };
    if (typeof perf.memory?.usedJSHeapSize !== "number") return {};
    return {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
    };
  }

  private async checkPressure(): Promise<void> {
    const { usedJSHeapSize, jsHeapSizeLimit } = this.getHeapInfo();
    if (!usedJSHeapSize || !jsHeapSizeLimit) return; // non-Chromium: no data
    if (usedJSHeapSize / jsHeapSizeLimit < PRESSURE_RATIO) return;
    console.warn(
      `[memory] Heap pressure: ${Math.round(usedJSHeapSize / 1048576)}MB / ` +
        `${Math.round(jsHeapSizeLimit / 1048576)}MB — evicting LRU resources`,
    );
    // Keep the 2 most recently used per label, evict the rest.
    const byLabel = new Map<string, RegisteredResource[]>();
    for (const r of this.resources.values()) {
      const arr = byLabel.get(r.label) ?? [];
      arr.push(r);
      byLabel.set(r.label, arr);
    }
    for (const arr of byLabel.values()) {
      arr.sort((a, b) => b.lastUsed - a.lastUsed || b.usageOrder - a.usageOrder);
      for (const victim of arr.slice(2)) await this.dispose(victim.id);
    }
  }

  private async onHidden(): Promise<void> {
    const activeId = this.getActiveId?.() ?? null;
    const now = Date.now();
    const ids: string[] = [];
    for (const [id, r] of this.resources) {
      if (id === activeId) continue;
      // Never sweep something touched very recently — it may be mid-render.
      if (now - r.lastUsed < RECENTLY_USED_MS) continue;
      ids.push(id);
    }
    if (ids.length) {
      console.info(`[memory] Tab hidden — disposing ${ids.length} background resource(s)`);
      for (const id of ids) await this.dispose(id);
    }
  }
}

export const memoryManager = new MemoryManager();
