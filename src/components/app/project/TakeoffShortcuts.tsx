/**
 * Takeoff shortcut cards — one click per category (windows, doors, sliding
 * doors, storefront/curtain wall, louvers, skylights). Each card shows live
 * counts from the Takeoff Orchestrator; clicking opens the category takeoff:
 * schedule summary, types with counts and sizes, floor breakdown with
 * child-lock (WOCD) flags driven by the project's state code.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AirVent,
  AppWindow,
  ArrowLeft,
  Building2,
  DoorOpen,
  PanelLeft,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { useTakeoffItems } from "@/lib/takeoff/data";
import {
  SHORTCUT_CATEGORIES,
  categorizeItem,
  quoteBlockers,
  runFullTakeoff,
  type CategoryTakeoff,
  type ShortcutCategory,
} from "@/lib/takeoff/orchestrator";
import { categoryQuantities, formatQty, type CategoryQuantities } from "@/lib/takeoff/quantities";
import { jurisdictionSummary, type JurisdictionInput } from "@/lib/jurisdiction/requirements";

const CATEGORY_ICON: Record<ShortcutCategory, typeof AppWindow> = {
  windows: AppWindow,
  doors: DoorOpen,
  sliding_doors: PanelLeft,
  storefront_curtainwall: Building2,
  louvers: AirVent,
  skylights: Sun,
};

import { AssemblyCostPanel } from "./AssemblyCostPanel";

function useJurisdictionInput(projectId: string) {
  return useQuery({
    queryKey: ["takeoff-shortcuts", "jurisdiction", projectId],
    queryFn: async (): Promise<JurisdictionInput> => {
      const { data, error } = await supabase
        .from("projects")
        .select("state,county,city,postal_code,latitude,longitude")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return {
        state: (data?.state as string | null) ?? null,
        county: (data?.county as string | null) ?? null,
        city: (data?.city as string | null) ?? null,
        zip: (data?.postal_code as string | null) ?? null,
        lat: (data?.latitude as number | null) ?? null,
        lon: (data?.longitude as number | null) ?? null,
      };
    },
  });
}

function ShortcutCard({
  takeoff,
  quantities,
  onOpen,
}: {
  takeoff: CategoryTakeoff;
  quantities: CategoryQuantities;
  onOpen: () => void;
}) {
  const Icon = CATEGORY_ICON[takeoff.category];
  const showWocd = takeoff.category === "windows" || takeoff.category === "sliding_doors";
  const areaRows = quantities.rows.filter((r) => r.unit !== "EA");
  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-secondary/40"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-navy">
          <Icon className="size-5 text-primary" />
          {takeoff.label}
        </span>
        <span className="flex gap-1">
          {takeoff.jurisdiction.impactRequired ? (
            <Badge className="bg-red-600 hover:bg-red-700">Impact</Badge>
          ) : null}
          {showWocd && takeoff.wocdUnits > 0 ? (
            <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-700">
              <ShieldAlert className="size-3" />
              {takeoff.wocdUnits} child lock
            </Badge>
          ) : null}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-navy">{takeoff.totalUnits}</span>
        <span className="text-sm text-muted-foreground">units</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {takeoff.types.length} type{takeoff.types.length === 1 ? "" : "s"}
        {takeoff.floors.length > 0
          ? ` · ${takeoff.floors.length} floor${takeoff.floors.length === 1 ? "" : "s"}`
          : ""}
      </div>
      {areaRows.length > 0 ? (
        <div className="mt-1 text-xs font-medium text-navy">
          {areaRows.map((r) => formatQty(r.value, r.unit)).join(" · ")}
        </div>
      ) : null}
    </button>
  );
}

function CategoryTakeoffView({
  takeoff,
  quantities,
  projectId,
  onBack,
}: {
  takeoff: CategoryTakeoff;
  quantities: CategoryQuantities;
  projectId: string;
  onBack: () => void;
}) {
  const blockers = quoteBlockers(takeoff);
  const showWocd = takeoff.category === "windows" || takeoff.category === "sliding_doors";

  const quoteType = async (typeLabel: string, units: number) => {
    await logAudit({
      projectId,
      action: "takeoff.quote_requested",
      entityType: "takeoff_category",
      detail: { category: takeoff.category, type: typeLabel, units },
    });
    toast.success(`Quoting ${units} × ${typeLabel}`, {
      description: "YKK product mapping is next — coming up in the quote flow.",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1 size-4" /> All categories
        </Button>
        <h3 className="text-lg font-semibold text-navy">{takeoff.label} takeoff</h3>
        <Badge variant="secondary">{takeoff.totalUnits} units</Badge>
        <Badge variant="outline">{takeoff.totalOpenings} openings</Badge>
      </div>

      {/* Jurisdiction — whole-project rules from the geocoded location */}
      <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
        <p className="font-medium text-navy">{jurisdictionSummary(takeoff.jurisdiction)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {takeoff.jurisdiction.impactRequired ? (
            <Badge className="bg-red-600 hover:bg-red-700">Impact required</Badge>
          ) : takeoff.jurisdiction.windBorneDebris === "likely" ? (
            <Badge variant="outline" className="border-amber-500/50 text-amber-700">
              WBDR likely — verify
            </Badge>
          ) : null}
          {takeoff.jurisdiction.hvhz ? <Badge variant="outline">HVHZ</Badge> : null}
          <Badge variant="outline">{takeoff.jurisdiction.buildingCode}</Badge>
          <Badge variant="outline">{takeoff.jurisdiction.energyCode}</Badge>
        </div>
        {takeoff.productNotes.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            {takeoff.productNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        {takeoff.jurisdiction.verify.length > 0 ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {takeoff.jurisdiction.verify.length} item
              {takeoff.jurisdiction.verify.length === 1 ? "" : "s"} to verify with plans / AHJ
            </summary>
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
              {takeoff.jurisdiction.verify.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {showWocd ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <span className="font-medium text-navy">
              {takeoff.wocdUnits} unit{takeoff.wocdUnits === 1 ? "" : "s"} need
              {takeoff.wocdUnits === 1 ? "s" : ""} child locks
            </span>
            <span className="text-muted-foreground">
              {" "}
              — {takeoff.wocdRule.codeName} §{takeoff.wocdRule.citation}
              {takeoff.wocdRule.state ? ` (${takeoff.wocdRule.state})` : ""}. Applied as: windows
              above floor 2.
            </span>
          </div>
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
          <p className="font-medium text-navy">Before quoting</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Quantities — deterministic math on verified dimensions */}
      <div className="rounded-lg border border-border bg-card">
        <p className="border-b border-border px-4 py-2 text-sm font-medium text-navy">Quantities</p>
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Measure</th>
              <th className="px-4 py-2 text-right font-medium">Takeoff</th>
              <th className="px-4 py-2 text-right font-medium">Order qty</th>
            </tr>
          </thead>
          <tbody>
            {quantities.rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="px-4 py-2">
                  <span className="font-medium text-navy">{r.label}</span>
                  {r.note ? (
                    <span className="ml-2 text-xs text-muted-foreground">({r.note})</span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-right font-medium">{formatQty(r.value, r.unit)}</td>
                <td className="px-4 py-2 text-right font-medium text-primary">
                  {formatQty(r.orderValue, r.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {quantities.unsizedUnits > 0 ? (
          <p className="flex items-start gap-1 border-t border-border px-4 py-2 text-xs text-amber-700">
            <ShieldAlert className="mt-0.5 size-3 shrink-0" />
            {quantities.unsizedUnits} unit{quantities.unsizedUnits === 1 ? "" : "s"} ha
            {quantities.unsizedUnits === 1 ? "s" : "ve"} no recorded size — counted in units,
            excluded from area/length totals.
          </p>
        ) : null}
      </div>

      {/* Assembly cost estimate */}
      <AssemblyCostPanel
        projectId={projectId}
        category={takeoff.category}
        quantities={{
          units: quantities.units,
          areaSf: quantities.rows.find((r) => r.unit === "SF")?.value ?? 0,
          perimeterLf: quantities.rows.find((r) => r.unit === "LF")?.value ?? 0,
        }}
      />

      {/* Floor breakdown */}
      <div className="rounded-lg border border-border bg-card">
        <p className="border-b border-border px-4 py-2 text-sm font-medium text-navy">
          Count by floor
        </p>
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Floor</th>
              <th className="px-4 py-2 text-right font-medium">Units</th>
              {showWocd ? (
                <th className="px-4 py-2 text-right font-medium">Need child lock</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {takeoff.floors.map((f) => (
              <tr key={f.label} className="border-t border-border">
                <td className="px-4 py-2">{f.label}</td>
                <td className="px-4 py-2 text-right font-medium">{f.units}</td>
                {showWocd ? (
                  <td className="px-4 py-2 text-right">
                    {f.wocdUnits > 0 ? (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-700">
                        {f.wocdUnits}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {takeoff.floors.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-muted-foreground">
                  No items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Type breakdown */}
      <div className="rounded-lg border border-border bg-card">
        <p className="border-b border-border px-4 py-2 text-sm font-medium text-navy">Types</p>
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Sizes</th>
              <th className="px-4 py-2 font-medium">Floors</th>
              <th className="px-4 py-2 text-right font-medium">Units</th>
              {showWocd ? <th className="px-4 py-2 text-right font-medium">Child lock</th> : null}
              <th className="px-4 py-2 text-right font-medium">Quote</th>
            </tr>
          </thead>
          <tbody>
            {takeoff.types.map((t) => (
              <tr key={t.key} className="border-t border-border align-top">
                <td className="px-4 py-2">
                  <p className="font-medium text-navy">
                    {t.label}
                    {t.impactRequired ? (
                      <Badge className="ml-2 bg-red-600 hover:bg-red-700">Impact</Badge>
                    ) : null}
                  </p>
                  {t.sampleMark ? (
                    <p className="text-xs text-muted-foreground">e.g. {t.sampleMark}</p>
                  ) : null}
                  {t.impactNote ? (
                    <p className="mt-1 text-xs text-red-700">{t.impactNote}</p>
                  ) : null}
                  {t.sizeWarnings.map((w) => (
                    <p key={w} className="mt-1 flex items-start gap-1 text-xs text-amber-700">
                      <ShieldAlert className="mt-0.5 size-3 shrink-0" /> {w}
                    </p>
                  ))}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{t.sizes.join(", ") || "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{t.floors.join(", ") || "—"}</td>
                <td className="px-4 py-2 text-right font-medium">{t.units}</td>
                {showWocd ? (
                  <td className="px-4 py-2 text-right">{t.wocdUnits > 0 ? t.wocdUnits : "—"}</td>
                ) : null}
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => quoteType(t.label, t.units)}>
                    Quote
                  </Button>
                </td>
              </tr>
            ))}
            {takeoff.types.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-muted-foreground">
                  No types yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TakeoffShortcuts({ projectId }: { projectId: string }) {
  const [selected, setSelected] = useState<ShortcutCategory | null>(null);
  const { data: items = [], isLoading } = useTakeoffItems(projectId);
  const { data: jurisdictionInput } = useJurisdictionInput(projectId);

  const full = useMemo(
    () => runFullTakeoff(items, jurisdictionInput ?? null),
    [items, jurisdictionInput],
  );

  const quantities = useMemo(() => {
    const out = {} as Record<ShortcutCategory, CategoryQuantities>;
    for (const c of SHORTCUT_CATEGORIES) {
      out[c.key] = categoryQuantities(items, c.key, categorizeItem);
    }
    return out;
  }, [items]);

  if (selected) {
    return (
      <CategoryTakeoffView
        takeoff={full[selected]}
        quantities={quantities[selected]}
        projectId={projectId}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-navy">Takeoff shortcuts</p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading counts…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {SHORTCUT_CATEGORIES.map((c) => (
            <ShortcutCard
              key={c.key}
              takeoff={full[c.key]}
              quantities={quantities[c.key]}
              onOpen={() => setSelected(c.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
