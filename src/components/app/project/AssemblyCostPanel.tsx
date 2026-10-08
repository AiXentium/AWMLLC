/**
 * Assembly cost panel — turns a category's takeoff quantities into a
 * material + labor cost breakdown using the seeded assembly templates.
 *
 * The estimator edits material unit costs and the labor rate right here;
 * rates persist to localStorage per project + category so a refresh keeps
 * the estimator's pricing work.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePersistentState } from "@/lib/workspace-state";
import {
  applyAssembly,
  assemblyTotals,
  fetchAssemblies,
  formatMoney,
  type AssemblyRates,
  type TakeoffQtyInput,
} from "@/lib/takeoff/assemblies";
import type { ShortcutCategory } from "@/lib/takeoff/orchestrator";

interface AssemblyCostPanelProps {
  projectId: string;
  category: ShortcutCategory;
  quantities: TakeoffQtyInput;
}

const DEFAULT_RATES: AssemblyRates = { materialRates: {}, laborRate: 65 };

function parseRate(raw: string): number {
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function basisLabel(basis: string | undefined, quantities: TakeoffQtyInput): string {
  if (basis === "area") return `${quantities.areaSf.toLocaleString("en-US")} SF`;
  if (basis === "perimeter") return `${quantities.perimeterLf.toLocaleString("en-US")} LF`;
  return `${quantities.units.toLocaleString("en-US")} EA`;
}

export function AssemblyCostPanel({ projectId, category, quantities }: AssemblyCostPanelProps) {
  const {
    data: assemblies,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["assemblies", category],
    queryFn: () => fetchAssemblies(category),
  });
  const assembly = assemblies?.[0] ?? null;

  const [rates, setRates] = usePersistentState<AssemblyRates>(
    `awm.assembly-rates.${projectId}.${category}`,
    DEFAULT_RATES,
  );

  const costLines = useMemo(
    () => (assembly ? applyAssembly(quantities, assembly, rates) : []),
    [assembly, quantities, rates],
  );
  const totals = useMemo(() => assemblyTotals(costLines), [costLines]);

  const setMaterialRate = (description: string, raw: string) =>
    setRates({
      ...rates,
      materialRates: { ...rates.materialRates, [description]: parseRate(raw) },
    });

  const setLaborRate = (raw: string) => setRates({ ...rates, laborRate: parseRate(raw) });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <p className="flex items-center gap-2 text-sm font-medium text-navy">
          <Calculator className="size-4 text-primary" />
          Assembly cost
        </p>
        {assembly ? <Badge variant="secondary">{assembly.name}</Badge> : null}
      </div>

      {isLoading ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Loading cost template…</p>
      ) : error || !assembly ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          No cost template found for this category yet.
        </p>
      ) : (
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted-foreground">
            Based on {basisLabel(undefined, quantities)}
            {quantities.areaSf > 0 ? ` · ${basisLabel("area", quantities)}` : ""}
            {quantities.perimeterLf > 0 ? ` · ${basisLabel("perimeter", quantities)}` : ""}
          </p>

          {/* Rate inputs */}
          <div className="grid gap-3 sm:grid-cols-2">
            {assembly.lines
              .filter((l) => l.kind === "material")
              .map((l) => (
                <label key={l.description} className="block">
                  <span className="mb-1 block text-xs font-medium text-navy">
                    {l.description}{" "}
                    <span className="font-normal text-muted-foreground">($/{l.unit})</span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={rates.materialRates[l.description] ?? 0}
                    onChange={(e) => setMaterialRate(l.description, e.target.value)}
                    className="h-8"
                  />
                </label>
              ))}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy">
                Labor rate <span className="font-normal text-muted-foreground">($/HR)</span>
              </span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={rates.laborRate}
                onChange={(e) => setLaborRate(e.target.value)}
                className="h-8"
              />
            </label>
          </div>

          {/* Cost breakdown */}
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Unit cost</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {costLines.map((c) => (
                <tr key={c.description} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="font-medium text-navy">{c.description}</span>{" "}
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {c.kind}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {c.quantity.toLocaleString("en-US")} {c.unit}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {formatMoney(c.unitCost)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-navy">
                    {formatMoney(c.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border text-sm">
                <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">
                  Material
                </td>
                <td className="px-3 py-2 text-right font-medium text-navy">
                  {formatMoney(totals.material)}
                </td>
              </tr>
              <tr className="text-sm">
                <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">
                  Labor
                </td>
                <td className="px-3 py-2 text-right font-medium text-navy">
                  {formatMoney(totals.labor)}
                </td>
              </tr>
              <tr className="border-t-2 border-border text-sm">
                <td colSpan={3} className="px-3 py-2 text-right font-semibold text-navy">
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold text-primary">
                  {formatMoney(totals.total)}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="text-xs text-muted-foreground">
            Line quantities include the assembly waste factors. Rates are saved for this project and
            category.
          </p>
        </div>
      )}
    </div>
  );
}
