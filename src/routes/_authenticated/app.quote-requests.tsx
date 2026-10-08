import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRightLeft,
  Building2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Phone,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { StatCard, StatusBadge } from "@/components/app/WorkspacePrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  convertQuoteRequestToProject,
  getQuoteDocumentUrl,
  getQuoteRequest,
  listQuoteRequests,
  updateQuoteDocument,
  updateQuoteRequest,
} from "@/lib/quote-requests.functions";
import { formatBytes } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/quote-requests")({
  component: QuoteRequestsPage,
});

function dt(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function QuoteRequestsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listQuoteRequests);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quote-requests"],
    queryFn: () => list({}),
  });

  const requests = useMemo(() => data?.requests ?? [], [data]);
  const staff = data?.staff ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return requests.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      return [row.name, row.company, row.email, row.project_name, row.project_address, row.city]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [requests, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      fresh: requests.filter((r) => r.status === "new").length,
      active: requests.filter((r) =>
        ["reviewing", "more_information_needed", "quote_in_progress", "quote_sent"].includes(
          r.status,
        ),
      ).length,
      converted: requests.filter((r) => r.status === "converted_to_project").length,
    }),
    [requests],
  );

  return (
    <AppShell
      title="New Prospect Quote Requests"
      subtitle="Every quote request submitted from the public website, with its uploaded plan documents."
      actions={
        <Button
          variant="secondary"
          onClick={() => qc.invalidateQueries({ queryKey: ["quote-requests"] })}
        >
          Refresh
        </Button>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Requests" value={stats.total} hint="All time" />
        <StatCard label="New" value={stats.fresh} hint="Awaiting first review" />
        <StatCard label="In Progress" value={stats.active} hint="Reviewing through quote sent" />
        <StatCard label="Converted" value={stats.converted} hint="Now live projects" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prospect, company, project, or address"
            className="pl-9"
            aria-label="Search quote requests"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {QUOTE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {QUOTE_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
        <table className="w-full min-w-[62rem] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {[
                "Prospect",
                "Project",
                "Type",
                "Docs",
                "Submitted",
                "Last Activity",
                "Assigned",
                "Status",
              ].map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" aria-hidden="true" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  No quote requests match this view yet. Submissions from the public Request a Quote
                  page appear here automatically.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const assignee = staff.find((s) => s.id === row.assigned_to);
                return (
                  <tr
                    key={row.id}
                    onClick={() => setActiveId(row.id)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.company ?? row.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.project_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[row.city, row.state].filter(Boolean).join(", ") || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.project_type ?? "—"}</td>
                    <td className="px-4 py-3">{row.documentCount}</td>
                    <td className="px-4 py-3">{dt(row.created_at)}</td>
                    <td className="px-4 py-3">{dt(row.last_activity_at)}</td>
                    <td className="px-4 py-3">{assignee?.full_name ?? "Unassigned"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={QUOTE_STATUS_LABELS[row.status] ?? row.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {activeId ? (
        <RequestDetail
          id={activeId}
          staff={staff}
          onClose={() => setActiveId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["quote-requests"] })}
        />
      ) : null}
    </AppShell>
  );
}

type StaffRow = { id: string; full_name: string | null; email: string | null };

function RequestDetail({
  id,
  staff,
  onClose,
  onChanged,
}: {
  id: string;
  staff: StaffRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const load = useServerFn(getQuoteRequest);
  const update = useServerFn(updateQuoteRequest);
  const docUrl = useServerFn(getQuoteDocumentUrl);
  const docUpdate = useServerFn(updateQuoteDocument);
  const convert = useServerFn(convertQuoteRequestToProject);

  const { data, isLoading } = useQuery({
    queryKey: ["quote-request", id],
    queryFn: () => load({ data: { id } }),
  });

  const [notes, setNotes] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["quote-request", id] });
    onChanged();
  };

  type UpdateInput = {
    id: string;
    status?: (typeof QUOTE_STATUSES)[number];
    assignedTo?: string | null;
    priority?: "low" | "normal" | "high" | "urgent";
    internalNotes?: string;
  };

  const mutate = useMutation({
    mutationFn: (input: UpdateInput) => update({ data: input }),
    onSuccess: () => {
      refresh();
      toast.success("Request updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const request = data?.request;
  const documents = data?.documents ?? [];

  async function openDocument(documentId: string, download: boolean) {
    try {
      const { url } = await docUrl({ data: { id: documentId, download } });
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the file");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        {isLoading || !request ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto size-6 animate-spin" aria-hidden="true" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{request.project_name ?? request.name}</DialogTitle>
              <DialogDescription>
                Submitted {dt(request.created_at)} · Source {request.source}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={request.status}
                  onValueChange={(value) =>
                    mutate.mutate({ id, status: value as (typeof QUOTE_STATUSES)[number] })
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {QUOTE_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assigned to</Label>
                <Select
                  value={request.assigned_to ?? "unassigned"}
                  onValueChange={(value) =>
                    mutate.mutate({ id, assignedTo: value === "unassigned" ? null : value })
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name ?? member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select
                  value={request.priority}
                  onValueChange={(value) =>
                    mutate.mutate({ id, priority: value as "low" | "normal" | "high" | "urgent" })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "normal", "high", "urgent"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p[0].toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex gap-2">
                {request.converted_project_id ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate({
                        to: "/app/projects/$projectId",
                        params: { projectId: request.converted_project_id! },
                      })
                    }
                  >
                    <ExternalLink className="mr-2 size-4" aria-hidden="true" /> Open project
                  </Button>
                ) : (
                  <Button onClick={() => setConvertOpen(true)}>
                    <ArrowRightLeft className="mr-2 size-4" aria-hidden="true" /> Convert to Project
                  </Button>
                )}
              </div>
            </div>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="flex w-full flex-wrap justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="contact">Contact Information</TabsTrigger>
                <TabsTrigger value="project">Project Details</TabsTrigger>
                <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
                <TabsTrigger value="ai">AI Analysis</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="notes">Internal Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Detail label="Prospect" value={request.name} />
                  <Detail label="Company" value={request.company} />
                  <Detail label="Project type" value={request.project_type} />
                  <Detail label="Requested products" value={request.product_interest} />
                  <Detail label="Approx. quantities" value={request.quantities} />
                  <Detail label="Budget range" value={request.budget_range} />
                  <Detail label="Desired deadline" value={request.deadline} />
                  <Detail label="Documents" value={String(documents.length)} />
                </dl>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Notes from prospect
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                    {request.message}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="pt-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Detail label="Name" value={request.name} />
                  <Detail label="Company" value={request.company} />
                  <Detail
                    label="Email"
                    value={request.email}
                    href={`mailto:${request.email}`}
                    icon={Mail}
                  />
                  <Detail
                    label="Phone"
                    value={request.phone}
                    href={request.phone ? `tel:${request.phone}` : undefined}
                    icon={Phone}
                  />
                  <Detail label="Preferred contact" value={request.preferred_contact} />
                </dl>
              </TabsContent>

              <TabsContent value="project" className="pt-4">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Detail label="Project name" value={request.project_name} />
                  <Detail label="Address" value={request.project_address} icon={Building2} />
                  <Detail label="City" value={request.city} />
                  <Detail label="County" value={request.county} />
                  <Detail label="State" value={request.state} />
                  <Detail label="ZIP" value={request.zip_code} />
                </dl>
              </TabsContent>

              <TabsContent value="documents" className="space-y-3 pt-4">
                {documents.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    This prospect did not attach any documents.
                  </p>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3"
                    >
                      <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(Number(doc.size_bytes))} · {doc.kind.toUpperCase()}
                          {doc.document_id ? " · In project pipeline" : ""}
                        </p>
                      </div>
                      <Input
                        defaultValue={doc.classification ?? ""}
                        placeholder="Classification"
                        className="h-9 w-40"
                        aria-label={`Classification for ${doc.file_name}`}
                        onBlur={(e) =>
                          docUpdate({
                            data: { id: doc.id, classification: e.target.value || null },
                          }).then(refresh)
                        }
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDocument(doc.id, false)}
                      >
                        Preview
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Download ${doc.file_name}`}
                        onClick={() => openDocument(doc.id, true)}
                      >
                        <Download className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${doc.file_name}`}
                        onClick={() =>
                          docUpdate({ data: { id: doc.id, remove: true } })
                            .then(refresh)
                            .catch((error: Error) => toast.error(error.message))
                        }
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="ai" className="pt-4">
                {request.converted_project_id ? (
                  <div className="rounded-md border border-border p-6 text-sm">
                    <p>
                      Documents from this request entered the standard intake and pre-analysis
                      pipeline when it was converted. Open the project to review sheet
                      classification, working sets, schedules, and quantity analysis.
                    </p>
                    <Button
                      className="mt-4"
                      variant="secondary"
                      onClick={() =>
                        navigate({
                          to: "/app/projects/$projectId",
                          params: { projectId: request.converted_project_id! },
                        })
                      }
                    >
                      Open AI pre-analysis
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    AI pre-analysis runs once this request is converted to a project — that keeps
                    processing to a single pass over the uploaded plan set.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-3 pt-4">
                {(data?.activity ?? []).map((entry) => (
                  <div key={entry.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium">{entry.detail}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.kind} · {dt(entry.created_at)}
                    </p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="notes" className="space-y-3 pt-4">
                <Textarea
                  rows={8}
                  value={notes ?? request.internal_notes ?? ""}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes — never shown to the prospect."
                />
                <Button
                  onClick={() => mutate.mutate({ id, internalNotes: notes ?? "" })}
                  disabled={notes === null || mutate.isPending}
                >
                  Save notes
                </Button>
              </TabsContent>
            </Tabs>

            {convertOpen ? (
              <ConvertDialog
                request={request}
                documents={documents}
                staff={staff}
                onClose={() => setConvertOpen(false)}
                onConvert={async (input) => {
                  const result = await convert({ data: { ...input, submissionId: id } });
                  refresh();
                  setConvertOpen(false);
                  toast.success(
                    `Project created${"imported" in result ? ` · ${result.imported} document(s) transferred` : ""}`,
                  );
                }}
              />
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  href?: string;
  icon?: typeof Mail;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-center gap-2 text-sm">
        {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
        {href && value ? (
          <a href={href} className="underline-offset-2 hover:underline">
            {value}
          </a>
        ) : (
          (value ?? "—")
        )}
      </dd>
    </div>
  );
}

type ConvertPayload = {
  projectName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  county?: string | null;
  projectType?: string | null;
  estimatorId?: string | null;
  notes?: string | null;
  priority?: string | null;
  documentIds: string[];
};

function ConvertDialog({
  request,
  documents,
  staff,
  onClose,
  onConvert,
}: {
  request: Record<string, unknown> & { id: string };
  documents: { id: string; file_name: string; kind: string }[];
  staff: StaffRow[];
  onClose: () => void;
  onConvert: (input: ConvertPayload) => Promise<void>;
}) {
  const str = (key: string) => (request[key] as string | null) ?? "";
  const [values, setValues] = useState<ConvertPayload>({
    projectName: str("project_name") || str("name"),
    address: str("project_address"),
    city: str("city"),
    state: str("state"),
    postalCode: str("zip_code"),
    county: str("county"),
    projectType: str("project_type"),
    estimatorId: (request.assigned_to as string | null) ?? null,
    notes: str("message"),
    priority: (request.priority as string | null) ?? "normal",
    documentIds: documents.map((doc) => doc.id),
  });
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert to Project</DialogTitle>
          <DialogDescription>
            Review the details before the project is created. Uploaded plan sets are transferred
            once into the standard intake pipeline — the original request and its history stay
            intact.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled label="Project name">
            <Input
              value={values.projectName}
              onChange={(e) => setValues((v) => ({ ...v, projectName: e.target.value }))}
            />
          </Labelled>
          <Labelled label="Project type">
            <Input
              value={values.projectType ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, projectType: e.target.value }))}
            />
          </Labelled>
          <Labelled label="Address">
            <Input
              value={values.address ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
            />
          </Labelled>
          <Labelled label="City">
            <Input
              value={values.city ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
            />
          </Labelled>
          <Labelled label="State">
            <Input
              value={values.state ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, state: e.target.value }))}
            />
          </Labelled>
          <Labelled label="ZIP">
            <Input
              value={values.postalCode ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, postalCode: e.target.value }))}
            />
          </Labelled>
          <Labelled label="Assigned estimator">
            <Select
              value={values.estimatorId ?? "unassigned"}
              onValueChange={(value) =>
                setValues((v) => ({ ...v, estimatorId: value === "unassigned" ? null : value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name ?? member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labelled>
          <Labelled label="Internal priority">
            <Select
              value={values.priority ?? "normal"}
              onValueChange={(value) => setValues((v) => ({ ...v, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["low", "normal", "high", "urgent"].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labelled>
        </div>

        <Labelled label="Notes">
          <Textarea
            rows={4}
            value={values.notes ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          />
        </Labelled>

        <div className="space-y-2">
          <p className="text-sm font-medium">Documents to transfer</p>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents attached.</p>
          ) : (
            documents.map((doc) => (
              <label key={doc.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.documentIds.includes(doc.id)}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      documentIds: e.target.checked
                        ? [...v.documentIds, doc.id]
                        : v.documentIds.filter((docId) => docId !== doc.id),
                    }))
                  }
                />
                {doc.file_name}
                <span className="text-xs text-muted-foreground">
                  {doc.kind === "pdf" || doc.kind === "zip"
                    ? "enters plan pipeline"
                    : "attached as reference"}
                </span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || !values.projectName.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConvert(values);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Conversion failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
