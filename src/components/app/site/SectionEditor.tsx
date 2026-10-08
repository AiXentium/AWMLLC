import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SITE_FONTS,
  SITE_IMAGES,
  SITE_SECTION_TYPES,
  type SiteSection,
  type SiteSectionItem,
  type SiteSectionType,
} from "@/lib/site-pages";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ItemsEditor({
  items,
  onChange,
  imageMode,
}: {
  items: SiteSectionItem[];
  onChange: (items: SiteSectionItem[]) => void;
  imageMode?: boolean;
}) {
  const update = (index: number, patch: Partial<SiteSectionItem>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {imageMode ? "Gallery images" : "Feature cards"}
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([...items, { title: imageMode ? "Caption" : "Feature", text: "" }])
          }
        >
          <Plus className="mr-1 size-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {imageMode ? `Image ${i + 1}` : `Card ${i + 1}`}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={imageMode ? `Remove image ${i + 1}` : `Remove card ${i + 1}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
          <Input
            value={item.title}
            placeholder={imageMode ? "Caption" : "Card title"}
            onChange={(e) => update(i, { title: e.target.value })}
          />
          {imageMode ? (
            <Select value={item.text} onValueChange={(v) => update(i, { text: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose image" />
              </SelectTrigger>
              <SelectContent>
                {SITE_IMAGES.filter((o) => o.value).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Textarea
              value={item.text}
              rows={2}
              placeholder="Card description"
              onChange={(e) => update(i, { text: e.target.value })}
            />
          )}
        </div>
      ))}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No items yet — add one above.</p>
      ) : null}
    </div>
  );
}

export function SectionEditor({
  section,
  onChange,
}: {
  section: SiteSection;
  onChange: (patch: Partial<SiteSection>) => void;
}) {
  const set = (patch: Partial<SiteSection>) => onChange(patch);
  const type: SiteSectionType = section.type;
  const showImage = type === "hero" || type === "text";
  const showCta = type === "hero" || type === "text" || type === "cta";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Section type">
          <Select value={type} onValueChange={(v: SiteSectionType) => set({ type: v })}>
            <SelectTrigger>
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
        </Field>
        <Field label="Eyebrow (small label above heading)">
          <Input
            value={section.eyebrow ?? ""}
            placeholder="e.g. Coastal performance"
            onChange={(e) => set({ eyebrow: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Heading">
        <Input
          value={section.heading}
          placeholder="Section heading"
          onChange={(e) => set({ heading: e.target.value })}
        />
      </Field>

      <Field label="Heading font">
        <Select value={section.font ?? ""} onValueChange={(v) => set({ font: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SITE_FONTS.map((f) => (
              <SelectItem key={f.value || "default"} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Body text" hint="Blank line = new paragraph.">
        <Textarea
          value={section.body}
          rows={5}
          placeholder="Body copy…"
          onChange={(e) => set({ body: e.target.value })}
        />
      </Field>

      {showImage ? (
        <Field label="Image">
          <Select value={section.image} onValueChange={(v) => set({ image: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Choose image" />
            </SelectTrigger>
            <SelectContent>
              {SITE_IMAGES.map((o) => (
                <SelectItem key={o.value || "none"} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {showCta ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button label">
            <Input
              value={section.cta_label}
              placeholder="e.g. Request a Quote"
              onChange={(e) => set({ cta_label: e.target.value })}
            />
          </Field>
          <Field label="Button link" hint="Internal path like /contact, or full https:// URL.">
            <Input
              value={section.cta_href}
              placeholder="/contact"
              onChange={(e) => set({ cta_href: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      {type === "features" ? (
        <ItemsEditor items={section.items ?? []} onChange={(items) => set({ items })} />
      ) : null}
      {type === "gallery" ? (
        <ItemsEditor items={section.items ?? []} onChange={(items) => set({ items })} imageMode />
      ) : null}
    </div>
  );
}
