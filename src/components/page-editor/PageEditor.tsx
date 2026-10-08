/**
 * Site-wide page editor.
 *
 * Floating "Edit page" button (bottom-right, every page). In edit mode every
 * content box gets:
 *   - drag handle  -> move it anywhere (pointer drag, layout-safe transform)
 *   - resize handle (bottom-right) -> reshape width/height freely
 *   - hide button  -> hide the box; hidden boxes are listed in the editor
 *                      panel and can be shown again
 * Layouts (position, size, hidden) persist per page in localStorage, so a
 * customized page looks the same on reload.
 *
 * Page authors can opt in explicitly:
 *   <section data-editor-box="takeoff-cards" data-editor-label="Takeoff shortcut cards">
 * Otherwise boxes are auto-discovered (direct children of <main>, plus
 * [data-editor-box] and .card elements inside it).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { Pencil, Check, RotateCcw, EyeOff, Move, Scaling } from "lucide-react";

const STORAGE_KEY = "awm-page-editor-layouts-v1";

type BoxLayout = {
  dx: number;
  dy: number;
  w: number | null;
  h: number | null;
  hidden: boolean;
};
type PageLayout = Record<string, BoxLayout>;
type AllLayouts = Record<string, PageLayout>;

type BoxInfo = { id: string; el: HTMLElement; label: string };

const EMPTY_BOX: BoxLayout = { dx: 0, dy: 0, w: null, h: null, hidden: false };

function loadAll(): AllLayouts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AllLayouts) : {};
  } catch {
    return {};
  }
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "box"
  );
}

function boxLabel(el: HTMLElement, fallback: string): string {
  const explicit = el.getAttribute("data-editor-label");
  if (explicit) return explicit;
  const heading = el.querySelector("h1, h2, h3, h4")?.textContent?.trim();
  if (heading) return heading.slice(0, 48);
  return fallback;
}

/** Finds the main content container for box discovery. */
function contentRoot(): HTMLElement {
  return (
    (document.querySelector("main") as HTMLElement | null) ??
    (document.getElementById("root") as HTMLElement | null) ??
    document.body
  );
}

function discoverBoxes(): BoxInfo[] {
  const root = contentRoot();
  const seen = new Set<string>();
  const out: BoxInfo[] = [];
  let n = 0;

  const consider = (el: Element) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.closest("[data-editor-ignore]")) return;
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
    // Never treat nav chrome as a movable box unless explicitly opted in.
    if (!el.hasAttribute("data-editor-box")) {
      if (el.closest("header, nav, aside, footer")) return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 48) return;
    if (el.id === "page-editor-root") return;
    // Already registered in this scan (found via multiple selectors).
    if (el.dataset.editorId && seen.has(el.dataset.editorId)) return;

    let id: string;
    const explicit = el.getAttribute("data-editor-box");
    if (explicit) {
      id = `custom:${slugify(explicit)}`;
    } else {
      const heading = el.querySelector("h1, h2, h3, h4")?.textContent?.trim();
      id = `auto:${slugify(heading ?? `${el.tagName.toLowerCase()}-${n}`)}`;
    }
    let unique = id;
    let i = 2;
    while (seen.has(unique)) unique = `${id}-${i++}`;
    seen.add(unique);
    n += 1;
    if (!el.dataset.editorId) el.dataset.editorId = unique;
    out.push({ id: el.dataset.editorId, el, label: boxLabel(el, `Box ${n}`) });
  };

  // Explicit opt-ins anywhere inside the content root.
  root.querySelectorAll("[data-editor-box]").forEach(consider);
  // Direct children of the content root (page sections).
  Array.from(root.children).forEach((child) => {
    if (
      child instanceof HTMLElement &&
      !["HEADER", "NAV", "ASIDE", "FOOTER", "SCRIPT"].includes(child.tagName)
    ) {
      consider(child);
    }
  });
  // Card-style boxes nested deeper.
  root.querySelectorAll(".card").forEach(consider);

  return out;
}

function applyBoxLayout(el: HTMLElement, box: BoxLayout) {
  el.style.transform = box.dx || box.dy ? `translate(${box.dx}px, ${box.dy}px)` : "";
  el.style.width = box.w != null ? `${Math.round(box.w)}px` : "";
  el.style.height = box.h != null ? `${Math.round(box.h)}px` : "";
  el.style.display = box.hidden ? "none" : "";
}

export function PageEditorProvider() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [editing, setEditing] = useState(false);
  const [boxes, setBoxes] = useState<BoxInfo[]>([]);
  const [layouts, setLayouts] = useState<AllLayouts>({});
  const boxesRef = useRef<BoxInfo[]>([]);
  const layoutsRef = useRef<AllLayouts>({});
  const dragState = useRef<{
    id: string;
    el: HTMLElement;
    startX: number;
    startY: number;
    baseDx: number;
    baseDy: number;
    mode: "move" | "resize";
    startW: number;
    startH: number;
  } | null>(null);

  boxesRef.current = boxes;
  layoutsRef.current = layouts;

  useEffect(() => {
    setLayouts(loadAll());
  }, []);

  const persist = useCallback((route: string, updater: (prev: PageLayout) => PageLayout) => {
    setLayouts((prev) => {
      const next = { ...prev, [route]: updater(prev[route] ?? {}) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage full / unavailable — layout just won't persist */
      }
      return next;
    });
  }, []);

  const getBoxLayout = useCallback(
    (id: string): BoxLayout => layoutsRef.current[pathname]?.[id] ?? EMPTY_BOX,
    [pathname],
  );

  // ---- discovery: runs always (saved layouts apply outside edit mode too) ---
  useEffect(() => {
    let raf = 0;
    const scan = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const found = discoverBoxes().filter((b) => document.contains(b.el));
        const page = layoutsRef.current[pathname] ?? {};
        for (const b of found) applyBoxLayout(b.el, page[b.id] ?? EMPTY_BOX);
        setBoxes((prev) => {
          const prevIds = new Set(prev.map((p) => p.id));
          const nextIds = new Set(found.map((f) => f.id));
          if (prevIds.size === nextIds.size && [...prevIds].every((id) => nextIds.has(id)))
            return prev;
          return found;
        });
      });
    };
    scan();
    const obs = new MutationObserver(scan);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [pathname]);

  // ---- drag / resize ------------------------------------------------------
  const endGesture = useCallback(() => {
    const st = dragState.current;
    dragState.current = null;
    document.body.style.userSelect = "";
    if (!st) return;
    st.el.style.zIndex = "";
    const id = st.id;
    const m = st.el.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    const dx = Math.round(parseFloat(m?.[1] ?? "0"));
    const dy = Math.round(parseFloat(m?.[2] ?? "0"));
    const rect = st.el.getBoundingClientRect();
    persist(pathname, (prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? EMPTY_BOX),
        dx,
        dy,
        w: st.mode === "resize" ? Math.round(rect.width) : (prev[id]?.w ?? null),
        h: st.mode === "resize" ? Math.round(rect.height) : (prev[id]?.h ?? null),
      },
    }));
  }, [pathname, persist]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = dragState.current;
      if (!st) return;
      if (st.mode === "move") {
        const dx = st.baseDx + e.clientX - st.startX;
        const dy = st.baseDy + e.clientY - st.startY;
        st.el.style.transform = `translate(${dx}px, ${dy}px)`;
      } else {
        const w = Math.max(120, st.startW + e.clientX - st.startX);
        const h = Math.max(48, st.startH + e.clientY - st.startY);
        st.el.style.width = `${w}px`;
        st.el.style.height = `${h}px`;
      }
    };
    const onUp = () => endGesture();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [endGesture]);

  const startGesture = (e: React.PointerEvent, box: BoxInfo, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    const cur = getBoxLayout(box.id);
    if (getComputedStyle(box.el).position === "static") box.el.style.position = "relative";
    box.el.style.zIndex = "60";
    document.body.style.userSelect = "none";
    const rect = box.el.getBoundingClientRect();
    dragState.current = {
      id: box.id,
      el: box.el,
      startX: e.clientX,
      startY: e.clientY,
      baseDx: cur.dx,
      baseDy: cur.dy,
      mode,
      startW: rect.width,
      startH: rect.height,
    };
  };

  const hideBox = (box: BoxInfo) => {
    box.el.style.display = "none";
    persist(pathname, (prev) => ({
      ...prev,
      [box.id]: { ...(prev[box.id] ?? EMPTY_BOX), hidden: true },
    }));
  };

  const showBox = (box: BoxInfo) => {
    box.el.style.display = "";
    persist(pathname, (prev) => ({
      ...prev,
      [box.id]: { ...(prev[box.id] ?? EMPTY_BOX), hidden: false },
    }));
  };

  const resetPage = () => {
    const page = layoutsRef.current[pathname] ?? {};
    for (const b of boxesRef.current) {
      if (page[b.id]) {
        b.el.style.transform = "";
        b.el.style.width = "";
        b.el.style.height = "";
        b.el.style.display = "";
      }
    }
    persist(pathname, () => ({}));
  };

  const hiddenBoxes = boxes.filter((b) => getBoxLayout(b.id).hidden);

  return (
    <div id="page-editor-root" data-editor-ignore>
      {/* Floating toggle — visible on every page */}
      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          title="Edit page layout — move, resize or hide boxes"
          className="fixed bottom-5 right-5 z-[100] flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Pencil className="size-4" aria-hidden="true" /> Edit page
        </button>
      ) : null}

      {/* Editor panel */}
      {editing ? (
        <div className="fixed right-5 top-20 z-[100] w-64 rounded-xl border border-input bg-background p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Page editor</p>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Check className="size-3.5" aria-hidden="true" /> Done
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Drag a box to move it, pull the corner to resize, or hide boxes you don't need.
          </p>
          <button
            onClick={resetPage}
            className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" /> Reset this page
          </button>
          {hiddenBoxes.length > 0 ? (
            <div className="mt-1 border-t border-input pt-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Hidden boxes</p>
              <ul className="max-h-40 space-y-1 overflow-auto">
                {hiddenBoxes.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{b.label}</span>
                    <button
                      onClick={() => showBox(b)}
                      className="shrink-0 rounded border border-input px-1.5 py-0.5 hover:bg-accent"
                    >
                      Show
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Per-box toolbars (edit mode only) */}
      {editing
        ? boxes
            .filter((b) => document.contains(b.el) && !getBoxLayout(b.id).hidden)
            .map((b) =>
              createPortal(
                <div data-editor-ignore className="pointer-events-none absolute inset-0 z-[70]">
                  <div className="absolute inset-0 rounded-md outline-2 outline-dashed outline-blue-500" />
                  <div className="pointer-events-auto absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-blue-600 py-1 pl-2.5 pr-1.5 text-white shadow-md">
                    <span
                      role="button"
                      aria-label={`Move ${b.label}`}
                      title="Drag to move"
                      onPointerDown={(e) => startGesture(e, b, "move")}
                      className="flex cursor-move items-center gap-1.5"
                    >
                      <Move className="size-3.5" aria-hidden="true" />
                      <span className="max-w-40 truncate text-xs font-medium">{b.label}</span>
                    </span>
                    <button
                      aria-label={`Hide ${b.label}`}
                      title="Hide this box"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        hideBox(b);
                      }}
                      className="rounded-full p-1 hover:bg-blue-500"
                    >
                      <EyeOff className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div
                    role="button"
                    aria-label={`Resize ${b.label}`}
                    title="Drag to resize"
                    onPointerDown={(e) => startGesture(e, b, "resize")}
                    className="pointer-events-auto absolute bottom-1 right-1 flex size-7 cursor-nwse-resize items-center justify-center rounded-md bg-blue-600 text-white shadow-md hover:bg-blue-500"
                  >
                    <Scaling className="size-4" aria-hidden="true" />
                  </div>
                </div>,
                b.el,
              ),
            )
        : null}
    </div>
  );
}
