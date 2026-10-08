import { useCallback, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { extractPdfTextSample } from "@/lib/import-blueprint/extractPdfText";
import {
  extractBlueprintMetadata,
  type BlueprintMetadata,
} from "@/lib/import-blueprint/blueprint.functions";
import { setPendingBlueprintFile } from "@/lib/import-blueprint/pendingFile";

type Step = "drop" | "analyzing" | "review" | "creating";

type FormState = {
  name: string;
  project_type: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  architect: string;
  general_contractor: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  project_type: "",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  architect: "",
  general_contractor: "",
  description: "",
};

function metadataToForm(m: BlueprintMetadata): FormState {
  return {
    name: m.name ?? "",
    project_type: m.project_type ?? "",
    address: m.address ?? "",
    city: m.city ?? "",
    state: m.state ?? "",
    postal_code: m.postal_code ?? "",
    architect: m.architect ?? "",
    general_contractor: m.general_contractor ?? "",
    description: m.description ?? "",
  };
}

export function ImportBlueprintDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("drop");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<"high" | "medium" | "low" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setStep("drop");
    setFile(null);
    setForm(EMPTY_FORM);
    setAiNotes(null);
    setConfidence(null);
    setError(null);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const analyzeFile = useCallback(async (pdf: File) => {
    setFile(pdf);
    setError(null);
    setStep("analyzing");
    try {
      const sample = await extractPdfTextSample(pdf, 3);
      const result = await extractBlueprintMetadata({
        data: {
          filename: pdf.name,
          pageCount: sample.pageCount,
          isScanned: sample.isScanned,
          pages: sample.pages,
        },
      });
      if (!result.ok) {
        setError(result.error);
        setStep("drop");
        return;
      }
      setForm(metadataToForm(result.metadata));
      setAiNotes(result.metadata.notes);
      setConfidence(result.metadata.confidence);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that PDF.");
      setStep("drop");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const pdf = e.dataTransfer.files?.[0];
      if (pdf && /\.pdf$/i.test(pdf.name)) void analyzeFile(pdf);
      else if (pdf) setError("Only PDF plan sets are supported.");
    },
    [analyzeFile],
  );

  const create = useCallback(async () => {
    if (!file) return;
    if (!form.name.trim()) {
      setError("Give the project a name before creating it.");
      return;
    }
    setError(null);
    setStep("creating");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You are signed out. Sign in again.");
      // Client-generated ID: avoids needing SELECT permission on the new row.
      const newId = crypto.randomUUID();
      const { error } = await supabase.from("projects").insert({
        id: newId,
        name: form.name.trim(),
        project_type: form.project_type.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim() || null,
        architect: form.architect.trim() || null,
        general_contractor: form.general_contractor.trim() || null,
        description: form.description.trim() || null,
        owner_id: uid,
      });
      if (error) throw new Error(error.message);
      // Hand the PDF to the new project's upload queue and take the user there.
      setPendingBlueprintFile(file);
      handleClose(false);
      navigate({
        to: "/app/projects/$projectId",
        params: { projectId: newId },
        search: { upload: true },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the project.");
      setStep("review");
    }
  }, [file, form, handleClose, navigate]);

  const set =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-navy flex items-center gap-2">
            <Sparkles className="size-5" aria-hidden="true" />
            Import blueprint
          </DialogTitle>
          <DialogDescription>
            Drop a plan PDF and the AI reads the cover sheet to create the project for you. The PDF
            is then imported into the new project automatically.
          </DialogDescription>
        </DialogHeader>

        {step === "drop" && (
          <div>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                dragOver
                  ? "border-navy bg-navy/5"
                  : "border-muted-foreground/25 hover:border-navy/50"
              }`}
            >
              <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium">Drop your plan PDF here</p>
                <p className="text-sm text-muted-foreground">or click to browse — PDF only</p>
              </div>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const pdf = e.target.files?.[0];
                if (pdf) void analyzeFile(pdf);
                e.target.value = "";
              }}
            />
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-navy" aria-hidden="true" />
            <p className="font-medium">Reading {file?.name}...</p>
            <p className="text-sm text-muted-foreground">
              The AI is reading the cover sheet and title block to identify the project.
            </p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="truncate font-medium">{file?.name}</span>
              {confidence && (
                <Badge variant={confidence === "high" ? "default" : "secondary"}>
                  AI confidence: {confidence}
                </Badge>
              )}
              <button
                type="button"
                onClick={reset}
                className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
                <span className="text-xs">Start over</span>
              </button>
            </div>
            {aiNotes && <p className="text-xs text-muted-foreground italic">{aiNotes}</p>}

            <div className="space-y-2">
              <Label htmlFor="ib-name">Project name</Label>
              <Input
                id="ib-name"
                required
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Palm Beach Residence"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ib-type">Project type</Label>
                <Input
                  id="ib-type"
                  value={form.project_type}
                  onChange={set("project_type")}
                  placeholder="Single Family Residential"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ib-address">Address</Label>
                <Input id="ib-address" value={form.address} onChange={set("address")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ib-city">City</Label>
                <Input id="ib-city" value={form.city} onChange={set("city")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ib-state">State</Label>
                <Input id="ib-state" value={form.state} onChange={set("state")} placeholder="FL" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ib-postal">ZIP</Label>
                <Input id="ib-postal" value={form.postal_code} onChange={set("postal_code")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ib-arch">Architect</Label>
                <Input id="ib-arch" value={form.architect} onChange={set("architect")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ib-gc">General contractor</Label>
                <Input
                  id="ib-gc"
                  value={form.general_contractor}
                  onChange={set("general_contractor")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ib-desc">Description</Label>
              <Textarea
                id="ib-desc"
                value={form.description}
                onChange={set("description")}
                rows={2}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={create}>
                <Sparkles className="mr-2 size-4" aria-hidden="true" />
                Create project & import PDF
              </Button>
            </div>
          </div>
        )}

        {step === "creating" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-8 animate-spin text-navy" aria-hidden="true" />
            <p className="font-medium">Creating {form.name ? `"${form.name}"` : "project"}...</p>
            <p className="text-sm text-muted-foreground">
              Setting up the project and importing your PDF.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
