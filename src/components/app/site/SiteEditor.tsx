import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageSections } from "@/components/site/PageSections";
import { SectionEditor } from "@/components/app/site/SectionEditor";
import {
  SITE_SECTION_TYPES,
  blankSection,
  useSaveSitePage,
  useSitePages,
  type SitePageInput,
  type SiteSection,
  type SiteSectionType,
} from "@/lib/site-pages";
import { cn } from "@/lib/utils";

const PAGE_ORDER = ["home", "products", "resources", "about", "contact"];

function livePath(slug: string): string {
  return slug === "home" ? "/" : `/${slug}`;
}

export function SiteEditor() {
  const { data: pages = [], isLoading, isError } = useSitePages();
  const save = useSaveSitePage();

  const [slug, setSlug] = useState("home");
  const [draft, setDraft] = useState<SitePageInput | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [newType, setNewType] = useState<SiteSectionType>("text");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const page = useMemo(() => pages.find((p) => p.slug === slug) ?? null, [pages, slug]);

  useEffect(() => {
    if (page && page.id !== draftId) {
      setDraft({
        title: page.title,
        content: {
          sections: page.content.sections.map((s) => ({ ...s, items: [...(s.items ?? [])] })),
        },
        is_published: page.is_published,
      });
      setDraftId(page.id);
      setSelectedId(page.content.sections[0]?.id ?? null);
      setMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const sections = useMemo(
    () => (draft?.content.sections ?? []).slice().sort((a, b) => a.order - b.order),
    [draft],
  );
  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const dirty = useMemo(() => {
    if (!page || !draft) return false;
    return (
      JSON.stringify({
        title: draft.title,
        content: draft.content,
        is_published: draft.is_published,
      }) !==
      JSON.stringify({ title: page.title, content: page.content, is_published: page.is_published })
    );
  }, [page, draft]);

  const patchSections = (fn: (sections: SiteSection[]) => SiteSection[]) => {
    setDraft((d) => (d ? { ...d, content: { sections: fn(d.content.sections) } } : d));
  };

  const updateSection = (id: string, patch: Partial<SiteSection>) => {
    patchSections((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    patchSections((list) => {
      const ordered = list.slice().sort((a, b) => a.order - b.order);
      const i = ordered.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ordered.length) return list;
      const next = ordered.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((s, idx) => ({ ...s, order: idx + 1 }));
    });
  };

  const removeSection = (id: string) => {
    patchSections((list) =>
      list
        .filter((s) => s.id !== id)
        .sort((a, b) => a.order - b.order)
        .map((s, idx) => ({ ...s, order: idx + 1 })),
    );
    if (selectedId === id) {
      setSelectedId(sections.filter((s) => s.id !== id)[0]?.id ?? null);
    }
  };

  const addSection = () => {
    const order = sections.length ? Math.max(...sections.map((s) => s.order)) + 1 : 1;
    const fresh = blankSection(newType, order);
    patchSections((list) => [...list, fresh]);
    setSelectedId(fresh.id);
  };

  const handleSave = async () => {
    if (!page || !draft) return;
    setMessage(null);
    try {
      await save.mutateAsync({ id: page.id, input: draft });
      setDraftId(""); // force re-sync from server on refetch
      setMessage({
        kind: "ok",
        text: `“${draft.title}” saved. The live page updates immediately.`,
      });
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Save failed.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading pages…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-6 text-sm leading-relaxed">
        <p className="font-semibold text-amber-900">The site editor isn&apos;t connected yet.</p>
        <p className="mt-2 text-amber-800">
          The <code className="font-mono">site_pages</code> table doesn&apos;t exist in Supabase.
          Run this in <code className="font-mono">~/AI/01-PROJECTS/awm-platform</code>, then refresh
          this page:
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-amber-950 p-3 font-mono text-xs text-amber-50">
          supabase db push
        </pre>
      </div>
    );
  }

  const orderedPages = PAGE_ORDER.map((s) => pages.find((p) => p.slug === s)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  );

  return (
    <div className="space-y-4">
      {/* Page tabs */}
      <div className="flex flex-wrap gap-2">
        {orderedPages.map((p) => (
          <Button
            key={p.slug}
            variant={slug === p.slug ? "default" : "outline"}
            size="sm"
            onClick={() => setSlug(p.slug)}
          >
            {p.title}
            {!p.is_published ? (
              <Badge variant="secondary" className="ml-2">
                Hidden
              </Badge>
            ) : null}
          </Button>
        ))}
      </div>

      {page && draft ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
            <div className="min-w-52 flex-1">
              <Label className="text-xs text-muted-foreground">Page title</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch
                checked={draft.is_published}
                onCheckedChange={(v) => setDraft({ ...draft, is_published: v })}
              />
              Published
            </label>
            <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? (
                <EyeOff className="mr-2 size-4" aria-hidden="true" />
              ) : (
                <Eye className="mr-2 size-4" aria-hidden="true" />
              )}
              {showPreview ? "Hide preview" : "Show preview"}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={livePath(slug)} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-4" aria-hidden="true" />
                View live
              </a>
            </Button>
            <Button size="sm" onClick={handleSave} disabled={save.isPending || !dirty}>
              {save.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="mr-2 size-4" aria-hidden="true" />
              )}
              {dirty ? "Save changes" : "Saved"}
            </Button>
          </div>

          {message ? (
            <p
              className={cn(
                "rounded-md border p-3 text-sm",
                message.kind === "ok"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-red-300 bg-red-50 text-red-900",
              )}
            >
              {message.text}
            </p>
          ) : null}

          <div
            className={cn(
              "grid gap-4",
              showPreview
                ? "xl:grid-cols-[280px_minmax(0,1fr)_minmax(0,1.2fr)]"
                : "xl:grid-cols-[280px_minmax(0,1fr)]",
            )}
          >
            {/* Section list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Sections ({sections.length})</p>
              </div>
              <div className="flex gap-2">
                <Select value={newType} onValueChange={(v: SiteSectionType) => setNewType(v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITE_SECTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addSection}>
                  <Plus className="mr-1 size-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
              <div className="space-y-1.5">
                {sections.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-1 rounded-md border p-2",
                      selectedId === s.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-muted-foreground/40",
                    )}
                  >
                    <button
                      type="button"
                      className="flex-1 truncate text-left text-sm"
                      onClick={() => setSelectedId(s.id)}
                    >
                      <span className="block truncate font-medium">
                        {s.heading || <em className="text-muted-foreground">Untitled</em>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {SITE_SECTION_TYPES.find((t) => t.value === s.type)?.label ?? s.type}
                      </span>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={i === 0}
                      onClick={() => moveSection(s.id, -1)}
                      aria-label="Move up"
                    >
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={i === sections.length - 1}
                      onClick={() => moveSection(s.id, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive"
                      onClick={() => removeSection(s.id)}
                      aria-label="Delete section"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                {sections.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    No sections yet — add one above.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Section form */}
            <div className="rounded-md border border-border bg-card p-4">
              {selected ? (
                <>
                  <p className="mb-4 text-sm font-semibold">
                    Editing: {selected.heading || "Untitled section"}
                  </p>
                  <SectionEditor
                    section={selected}
                    onChange={(patch) => updateSection(selected.id, patch)}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a section on the left to edit it.
                </p>
              )}
            </div>

            {/* Live preview */}
            {showPreview ? (
              <div className="overflow-hidden rounded-md border border-border bg-background">
                <p className="border-b border-border bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Live preview — {livePath(slug)}
                </p>
                <div className="max-h-[80vh] overflow-y-auto">
                  <PageSections sections={sections} />
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No pages found. The migration seeds five pages on{" "}
          <code className="font-mono">supabase db push</code>.
        </p>
      )}
    </div>
  );
}
