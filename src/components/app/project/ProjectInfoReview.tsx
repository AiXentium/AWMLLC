import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, MapPin, RefreshCw, ScanSearch, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  EXTRACTION_FIELDS,
  FIELD_BY_KEY,
  GROUP_LABELS,
  HIGH_CONFIDENCE,
  confidenceLabel,
} from "@/lib/extraction/fields";
import {
  STAGE_LABELS,
  acceptAllHighConfidence,
  decideField,
  geocodeCandidate,
  useProjectExtraction,
  type ExtractionStage,
} from "@/lib/extraction/runner";

type FieldRow = {
  id: string;
  field_key: string;
  value: string;
  confidence: number;
  status: string;
  applied: boolean;
  conflict_value: string | null;
  source_sheet: string | null;
  source_page_number: number | null;
  snippet: string | null;
  page_id: string | null;
  document_id: string | null;
  extracted_at: string;
};

type AddressRow = {
  id: string;
  raw_address: string;
  role: string;
  score: number;
  label: string | null;
  selected: boolean;
  latitude: number | null;
  longitude: number | null;
  county: string | null;
  geocode_status: string;
  geocode_error: string | null;
  source_sheet: string | null;
  page_id: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  site: "Project site",
  architect: "Architect office",
  owner: "Owner / developer",
  contractor: "Contractor office",
  engineer: "Engineer office",
  unknown: "Unclassified",
};

function ConfidenceBadge({ value }: { value: number }) {
  const label = confidenceLabel(value);
  const tone =
    label === "High"
      ? "border-emerald-600/40 text-emerald-700"
      : label === "Medium"
        ? "border-amber-600/40 text-amber-700"
        : "border-destructive/40 text-destructive";
  return (
    <Badge variant="outline" className={tone}>
      {label} · {Math.round(value * 100)}%
    </Badge>
  );
}

/**
 * Project Information Review — the document-first auto-population surface.
 * Every value here came from an uploaded sheet and keeps its provenance; the
 * manual project form stays available as the correction/fallback path.
 */
export function ProjectInfoReview({
  projectId,
  canEdit,
  onOpenPage,
}: {
  projectId: string;
  canEdit: boolean;
  onOpenPage?: (pageId: string) => void;
}) {
  const qc = useQueryClient();
  const { progress, run } = useProjectExtraction(projectId, canEdit);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["extracted-fields", projectId] });
    qc.invalidateQueries({ queryKey: ["address-candidates", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
  };

  const { data: runRow } = useQuery({
    queryKey: ["extraction-runs", projectId],
    refetchInterval: 6000,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_extraction_runs")
        .select(
          "id,status,stage_message,fields_found,pages_scanned,pages_total,used_vision,error_message,created_at",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["extracted-fields", projectId],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_field_extractions")
        .select(
          "id,field_key,value,confidence,status,applied,conflict_value,source_sheet,source_page_number,snippet,page_id,document_id,extracted_at",
        )
        .eq("project_id", projectId)
        .neq("status", "rejected")
        .order("extracted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FieldRow[];
    },
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ["address-candidates", projectId],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_address_candidates")
        .select(
          "id,raw_address,role,score,label,selected,latitude,longitude,county,geocode_status,geocode_error,source_sheet,page_id",
        )
        .eq("project_id", projectId)
        .order("score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AddressRow[];
    },
  });

  // Newest extraction per field wins in the review list.
  const latestByField = useMemo(() => {
    const map = new Map<string, FieldRow>();
    for (const row of fields) if (!map.has(row.field_key)) map.set(row.field_key, row);
    return map;
  }, [fields]);

  const rows = useMemo(() => [...latestByField.values()], [latestByField]);
  const conflicts = rows.filter((r) => r.status === "conflict");
  const pending = rows.filter((r) => r.status === "pending");
  const applied = rows.filter((r) => r.status === "auto_applied" || r.status === "accepted");
  const missing = EXTRACTION_FIELDS.filter((f) => !latestByField.has(f.key));
  const highConfidencePending = [...conflicts, ...pending].filter(
    (r) => r.confidence >= HIGH_CONFIDENCE,
  );

  const decide = useMutation({
    mutationFn: async (input: { row: FieldRow; decision: "accept" | "reject" }) =>
      decideField({
        projectId,
        id: input.row.id,
        fieldKey: input.row.field_key,
        decision: input.decision,
        value: edits[input.row.id] ?? input.row.value,
      }),
    onSuccess: invalidate,
  });

  const acceptAll = useMutation({
    mutationFn: () => acceptAllHighConfidence(projectId),
    onSuccess: invalidate,
  });

  const useSite = useMutation({
    mutationFn: (row: AddressRow) =>
      geocodeCandidate({ projectId, candidateId: row.id, address: row.raw_address, apply: true }),
    onSuccess: invalidate,
  });

  const rerun = useMutation({
    mutationFn: (missingOnly: boolean) => run({ missingOnly }),
    onSuccess: invalidate,
  });

  const stage = (progress?.stage ??
    (runRow?.status as ExtractionStage) ??
    "queued") as ExtractionStage;
  const busy = ["reading_text", "analyzing_sheets", "extracting", "geocoding"].includes(stage);
  const selected = addresses.find((a) => a.selected) ?? null;

  function SourceLink({
    row,
  }: {
    row: { page_id: string | null; source_sheet: string | null; source_page_number: number | null };
  }) {
    if (!row.page_id || !onOpenPage) {
      return (
        <span className="text-xs text-muted-foreground">
          {row.source_sheet ?? "Source sheet unknown"}
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onOpenPage(row.page_id as string)}
        className="text-xs font-medium text-primary underline underline-offset-2"
      >
        {row.source_sheet ?? `Page ${row.source_page_number ?? "?"}`}
      </button>
    );
  }

  return (
    <section
      className="rounded-lg border border-border bg-card p-5"
      aria-label="Project information review"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg text-navy">Project information review</p>
          <p className="text-sm text-muted-foreground">
            Read from the uploaded documents first. Manual project fields below stay available as
            correction and fallback entry.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            {busy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
            {STAGE_LABELS[stage]}
          </Badge>
          {canEdit ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || rerun.isPending}
                onClick={() => rerun.mutate(true)}
              >
                <ScanSearch className="mr-2 size-4" aria-hidden="true" /> Scan for missing fields
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || rerun.isPending}
                onClick={() => rerun.mutate(false)}
              >
                <RefreshCw className="mr-2 size-4" aria-hidden="true" /> Re-run full scan
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {progress?.message || runRow?.stage_message ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {progress?.message ?? runRow?.stage_message}
          {runRow?.pages_total
            ? ` · ${runRow.pages_scanned}/${runRow.pages_total} sheets read`
            : ""}
          {runRow?.used_vision ? " · scanned set, image analysis used" : ""}
        </p>
      ) : null}
      {runRow?.error_message ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="size-3.5" aria-hidden="true" /> {runRow.error_message}
        </p>
      ) : null}

      {!rows.length && !busy ? (
        <p className="mt-4 rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          No project information has been extracted yet. Upload a plan set — extraction starts
          automatically once the first document becomes readable.
        </p>
      ) : null}

      {/* ---- Site address ranking + geocoding ---- */}
      {addresses.length ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Addresses found
            </p>
            {addresses.length > 1 && !selected ? (
              <span className="text-xs text-amber-700">
                Several addresses found — confirm which one is the project site.
              </span>
            ) : null}
          </div>
          <ul className="space-y-2">
            {addresses.map((row) => (
              <li key={row.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy">{row.raw_address}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={row.role === "site" ? "default" : "outline"}>
                        {ROLE_LABELS[row.role] ?? row.role}
                      </Badge>
                      <span>Site-likelihood {row.score}</span>
                      <SourceLink row={row as never} />
                      {row.geocode_status === "geocoded" ? (
                        <span className="text-emerald-700">
                          Geocoded {row.latitude?.toFixed(5)}, {row.longitude?.toFixed(5)}
                          {row.county ? ` · ${row.county} County` : ""}
                        </span>
                      ) : null}
                      {row.geocode_status === "failed" ? (
                        <span className="text-destructive">
                          Geocoding failed — {row.geocode_error}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant={row.selected ? "secondary" : "outline"}
                      disabled={useSite.isPending}
                      onClick={() => useSite.mutate(row)}
                    >
                      <MapPin className="mr-2 size-4" aria-hidden="true" />
                      {row.selected ? "Project site" : "Use as project site"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {selected?.latitude && selected?.longitude ? (
            <iframe
              title="Project site map preview"
              className="h-56 w-full rounded-md border border-border"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${selected.longitude - 0.01}%2C${
                selected.latitude - 0.008
              }%2C${selected.longitude + 0.01}%2C${selected.latitude + 0.008}&layer=mapnik&marker=${selected.latitude}%2C${selected.longitude}`}
            />
          ) : null}
        </div>
      ) : null}

      {/* ---- Conflicts ---- */}
      {conflicts.length ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-700">
            Conflicts with confirmed project data ({conflicts.length})
          </p>
          <ul className="mt-2 space-y-2">
            {conflicts.map((row) => (
              <li key={row.id} className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-sm font-medium text-navy">
                  {FIELD_BY_KEY.get(row.field_key)?.label ?? row.field_key}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Saved value: <span className="font-medium text-navy">{row.conflict_value}</span> ·
                  Document says: <span className="font-medium text-navy">{row.value}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ConfidenceBadge value={row.confidence} />
                  <SourceLink row={row} />
                  {canEdit ? (
                    <>
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ row, decision: "accept" })}
                      >
                        <Check className="mr-1 size-3.5" /> Use document value
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ row, decision: "reject" })}
                      >
                        <X className="mr-1 size-3.5" /> Keep saved value
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- Pending review-only fields ---- */}
      {pending.length ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Extracted, awaiting review ({pending.length})
            </p>
            {canEdit && highConfidencePending.length ? (
              <Button
                size="sm"
                variant="outline"
                disabled={acceptAll.isPending}
                onClick={() => acceptAll.mutate()}
              >
                Accept all high-confidence ({highConfidencePending.length})
              </Button>
            ) : null}
          </div>
          <ul className="mt-2 space-y-2">
            {pending.map((row) => (
              <li key={row.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-navy">
                    {FIELD_BY_KEY.get(row.field_key)?.label ?? row.field_key}
                  </p>
                  <ConfidenceBadge value={row.confidence} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input
                    className="h-9 max-w-md"
                    defaultValue={row.value}
                    disabled={!canEdit}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    aria-label={`${row.field_key} value`}
                  />
                  {canEdit ? (
                    <>
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ row, decision: "accept" })}
                      >
                        <Check className="mr-1 size-3.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ row, decision: "reject" })}
                      >
                        <X className="mr-1 size-3.5" /> Reject
                      </Button>
                    </>
                  ) : null}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <SourceLink row={row} />
                  {row.snippet ? <span className="truncate">“{row.snippet}”</span> : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- Auto-filled ---- */}
      {applied.length ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Auto-filled from documents ({applied.length})
          </p>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {applied.map((row) => (
              <li key={row.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-navy">
                    {FIELD_BY_KEY.get(row.field_key)?.label ?? row.field_key}
                  </p>
                  <ConfidenceBadge value={row.confidence} />
                </div>
                <p className="mt-1 text-sm text-navy">{row.value}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <SourceLink row={row} />
                  {row.status === "accepted" ? (
                    <span>Confirmed by estimator</span>
                  ) : (
                    <span>Auto-filled</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- Still missing ---- */}
      {rows.length && missing.length ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Not found in the documents — manual entry required ({missing.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((f) => (
              <Badge key={f.key} variant="outline" className="font-normal">
                {GROUP_LABELS[f.group]}: {f.label}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Compact read-only extraction status for the intake queue in Plans. */
export function ExtractionStatusChip({ projectId }: { projectId: string }) {
  const { data } = useQuery({
    queryKey: ["extraction-runs", projectId],
    refetchInterval: 6000,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_extraction_runs")
        .select("status,stage_message,fields_found,pages_scanned,pages_total")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });
  if (!data) return null;
  const stage = data.status as ExtractionStage;
  const busy = ["reading_text", "analyzing_sheets", "extracting", "geocoding"].includes(stage);
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="gap-1">
        {busy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
        Project info: {STAGE_LABELS[stage] ?? stage}
      </Badge>
      {data.pages_total ? (
        <span>
          {data.pages_scanned}/{data.pages_total} sheets read
        </span>
      ) : null}
      {data.fields_found ? <span>{data.fields_found} fields found</span> : null}
      {data.stage_message ? <span>{data.stage_message}</span> : null}
    </p>
  );
}
