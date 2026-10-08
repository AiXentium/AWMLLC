import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import logoAsset from "@/assets/awm-shield-logo.png.asset.json";
import { GoogleDriveConnectCard } from "@/components/app/google/GoogleDriveConnectCard";
import {
  DEFAULT_COMPANY,
  saveCompanySettings,
  useCompanySettings,
  type CompanyInfo,
} from "@/lib/company-settings";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({
    meta: [
      { title: "Report settings — AWM Takeoff AI" },
      {
        name: "description",
        content: "Company details used on AWM takeoff PDF and Excel deliverables.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const FIELDS: [keyof CompanyInfo, string, string][] = [
  ["company_name", "Company name", "AWM LLC"],
  ["legal_name", "Legal name", "American Windows Manufacturer LLC"],
  ["address", "Address", "Street, City, FL ZIP"],
  ["phone", "Phone", "(000) 000-0000"],
  ["email", "Email", "estimating@awmllc.com"],
  ["website", "Website", "awmllc.com"],
  ["license_number", "License / registration", "Optional"],
  ["estimator_name", "Default estimator name", "Washington"],
];

function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useCompanySettings();
  const [form, setForm] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      await saveCompanySettings(form);
      await qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Report settings saved", {
        description: "New exports will use these details.",
      });
    } catch (err) {
      toast.error("Could not save settings", {
        description: err instanceof Error ? err.message : "Unexpected error. Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Report settings"
      subtitle="Company information printed on takeoff PDF and Excel deliverables"
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      ) : (
        <div className="max-w-4xl space-y-6">
          <section className="space-y-3">
            <h2 className="font-serif text-lg text-navy">Integrations</h2>
            <GoogleDriveConnectCard />
          </section>

          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
            <img
              src={logoAsset.url}
              alt="AWM LLC logo"
              className="size-16 rounded object-contain"
            />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-navy">Report logo</p>
              <p>
                The AWM shield is used on every generated document. Custom logo upload is not
                enabled in this phase.
              </p>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2">
            {FIELDS.map(([key, label, placeholder]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`s-${key}`}>{label}</Label>
                <Input
                  id={`s-${key}`}
                  placeholder={placeholder}
                  value={(form[key] as string | null) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="s-notes">Default report notes</Label>
              <Textarea
                id="s-notes"
                rows={4}
                placeholder="Standard assumptions, exclusions or lead-time language added to every report."
                value={form.default_report_notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, default_report_notes: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Save settings
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            These settings are private to your account and are applied to new exports only.
            Previously generated files keep the details that were current when they were created.
          </p>
        </div>
      )}
    </AppShell>
  );
}
