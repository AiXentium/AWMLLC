import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AGENTS, INACTIVE_MODULES } from "@/lib/ai/agents";
import { getAiProviderStatus, testAiProvider } from "@/lib/ai/provider.functions";
import { TOOLS } from "@/lib/ai/tools";
import { useMyRole } from "@/lib/use-role";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/ai-settings")({
  head: () => ({
    meta: [
      { title: "AI Providers & Settings — AWM Takeoff AI" },
      {
        name: "description",
        content:
          "Configure OpenAI and Anthropic providers, per-task model routing, usage and cost tracking, and audit AI tool activity.",
      },
      { property: "og:title", content: "AI Providers & Settings — AWM Takeoff AI" },
      {
        property: "og:description",
        content:
          "Provider status, model routing, usage tracking and audit trail for the AWM Construction Super Agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiSettingsPage,
});

type ProviderRow = {
  id: string;
  provider: string;
  display_name: string;
  enabled: boolean;
  key_configured: boolean;
  secret_name: string;
  status: string;
  last_test_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

type RouteRow = {
  id: string;
  task_category: string;
  label: string;
  provider: string;
  model: string;
  fallback_provider: string | null;
  fallback_model: string | null;
  enabled: boolean;
  requires_vision: boolean;
  sort_order: number;
};

function AiSettingsPage() {
  const qc = useQueryClient();
  const { data: roleData } = useMyRole();
  const isAdmin = roleData?.role === "owner_admin";
  const [testing, setTesting] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ["ai-provider-status"],
    queryFn: () => getAiProviderStatus(),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["ai-provider-configs"],
    queryFn: async (): Promise<ProviderRow[]> => {
      const { data, error } = await supabase
        .from("ai_provider_configs")
        .select(
          "id,provider,display_name,enabled,key_configured,secret_name,status,last_test_at,last_success_at,last_error",
        )
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as ProviderRow[];
    },
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["ai-model-routes"],
    queryFn: async (): Promise<RouteRow[]> => {
      const { data, error } = await supabase
        .from("ai_model_routes")
        .select(
          "id,task_category,label,provider,model,fallback_provider,fallback_model,enabled,requires_vision,sort_order",
        )
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as RouteRow[];
    },
  });

  const { data: usage = [] } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_usage")
        .select(
          "provider,model,task_category,input_tokens,output_tokens,estimated_cost_usd,latency_ms,succeeded,used_fallback,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["ai-tool-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_tool_runs")
        .select("id,tool_name,agent_key,status,duration_ms,created_at")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateRoute = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RouteRow> }) => {
      const { error } = await supabase.from("ai_model_routes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-model-routes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleProvider = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("ai_provider_configs").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-provider-configs"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const runTest = async (provider: string) => {
    setTesting(provider);
    try {
      const result = await testAiProvider({
        data: { provider: provider as "openai" | "anthropic" },
      });
      if (result.ok) toast.success(`${provider} responded in ${result.latencyMs}ms`);
      else toast.error(`${provider}: ${result.error}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider test failed.");
    } finally {
      setTesting(null);
      qc.invalidateQueries({ queryKey: ["ai-provider-configs"] });
      qc.invalidateQueries({ queryKey: ["ai-provider-status"] });
    }
  };

  const totalCost = usage.reduce((sum, u) => sum + Number(u.estimated_cost_usd ?? 0), 0);
  const totalIn = usage.reduce((sum, u) => sum + (u.input_tokens ?? 0), 0);
  const totalOut = usage.reduce((sum, u) => sum + (u.output_tokens ?? 0), 0);
  const keyFor = (p: string) =>
    p === "openai" ? status?.keys.openai : p === "anthropic" ? status?.keys.anthropic : false;

  return (
    <AppShell
      title="AI Providers & Settings"
      subtitle="Provider keys, per-task model routing, usage and cost tracking, and an audit trail of every tool the assistant has run."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Providers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge
                variant="outline"
                className={
                  status?.mode === "live"
                    ? "border-emerald-600/40 text-emerald-700"
                    : "border-amber-600/40 text-amber-700"
                }
              >
                {status?.mode === "live" ? "Live AI" : "Demo AI Mode"}
              </Badge>
              <span className="text-muted-foreground">{status?.reason}</span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {providers.map((p) => (
                <div key={p.id} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-navy">{p.display_name}</p>
                    <Badge
                      variant="outline"
                      className={
                        keyFor(p.provider)
                          ? "border-emerald-600/40 text-emerald-700"
                          : "border-amber-600/40 text-amber-700"
                      }
                    >
                      {keyFor(p.provider) ? "Key present" : "No key"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Secret name: <code>{p.secret_name}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: {p.status}
                    {p.last_test_at ? ` · tested ${new Date(p.last_test_at).toLocaleString()}` : ""}
                  </p>
                  {p.last_error ? <p className="text-xs text-destructive">{p.last_error}</p> : null}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.enabled}
                        disabled={!isAdmin}
                        onCheckedChange={(enabled) => toggleProvider.mutate({ id: p.id, enabled })}
                        aria-label={`Enable ${p.display_name}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {p.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isAdmin || testing === p.provider}
                      onClick={() => runTest(p.provider)}
                    >
                      {testing === p.provider ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <PlugZap className="mr-2 size-4" />
                      )}
                      Test
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="rounded-md border border-border bg-secondary/40 p-2 text-xs text-muted-foreground">
              API keys are stored only as server-side secrets (<code>OPENAI_API_KEY</code>,{" "}
              <code>ANTHROPIC_API_KEY</code>) and are never sent to the browser. If a key is missing
              or a provider fails, the assistant falls back to the next route and finally to
              deterministic Demo AI Mode — counts and totals are always computed from the database,
              never by a model.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Model routing by task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {routes.map((r) => (
              <div
                key={r.id}
                className="grid gap-2 rounded-md border border-border p-2 text-xs md:grid-cols-[14rem_1fr_1fr_6rem] md:items-center"
              >
                <div>
                  <p className="font-medium text-navy">{r.label}</p>
                  <p className="text-muted-foreground">
                    {r.task_category}
                    {r.requires_vision ? " · vision" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-16 shrink-0 text-muted-foreground">{r.provider}</span>
                  <Input
                    className="h-8"
                    defaultValue={r.model}
                    disabled={!isAdmin}
                    aria-label={`Primary model for ${r.label}`}
                    onBlur={(e) =>
                      e.target.value !== r.model &&
                      updateRoute.mutate({ id: r.id, patch: { model: e.target.value } })
                    }
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-16 shrink-0 text-muted-foreground">
                    {r.fallback_provider ?? "—"}
                  </span>
                  <Input
                    className="h-8"
                    defaultValue={r.fallback_model ?? ""}
                    disabled={!isAdmin}
                    aria-label={`Fallback model for ${r.label}`}
                    onBlur={(e) =>
                      e.target.value !== (r.fallback_model ?? "") &&
                      updateRoute.mutate({
                        id: r.id,
                        patch: { fallback_model: e.target.value || null },
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={r.enabled}
                    disabled={!isAdmin}
                    aria-label={`Enable ${r.label}`}
                    onCheckedChange={(enabled) =>
                      updateRoute.mutate({ id: r.id, patch: { enabled } })
                    }
                  />
                  <span className="text-muted-foreground">{r.enabled ? "On" : "Off"}</span>
                </div>
              </div>
            ))}
            {!isAdmin ? (
              <p className="pt-1 text-xs text-muted-foreground">
                Routing is read-only for your role. Owners/admins can change it.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usage & cost (last 200 calls)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Estimated spend:</span> $
              {totalCost.toFixed(4)}
            </p>
            <p>
              <span className="text-muted-foreground">Tokens:</span> {totalIn.toLocaleString()} in /{" "}
              {totalOut.toLocaleString()} out
            </p>
            <p>
              <span className="text-muted-foreground">Fallback used:</span>{" "}
              {usage.filter((u) => u.used_fallback).length} calls
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto pt-1">
              {usage.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No model calls recorded yet.
                </p>
              ) : (
                usage.slice(0, 40).map((u, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <span className="text-navy">
                      {u.provider}/{u.model}
                    </span>
                    <span className="text-muted-foreground">{u.task_category}</span>
                    <span className="text-muted-foreground">
                      {u.input_tokens}/{u.output_tokens} tok
                    </span>
                    <span className="text-muted-foreground">
                      ${Number(u.estimated_cost_usd ?? 0).toFixed(4)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Guardrails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Read-only lookups run automatically and always cite sources.</p>
            <p>
              • Exports, drafts and data changes require explicit confirmation and are logged for
              audit.
            </p>
            <p>• Project and company memory require approval before reuse.</p>
            <p>• Automated plan reading is advisory; a human must approve every count.</p>
            <p>• All queries run under your role permissions via row-level security.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Specialist agents</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {Object.entries(AGENTS).map(([key, a]) => (
              <div key={key} className="rounded-md border border-border p-2">
                <p className="text-xs font-semibold text-navy">{a.label}</p>
                <p className="text-[0.7rem] text-muted-foreground">{a.blurb}</p>
              </div>
            ))}
            <div className="sm:col-span-2 flex flex-wrap gap-1.5 pt-1">
              {INACTIVE_MODULES.map((m) => (
                <Badge key={m} variant="outline" className="font-normal text-muted-foreground">
                  {m} · inactive
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tool inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {TOOLS.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
              >
                <span className="truncate text-navy">{t.label}</span>
                <Badge variant="outline" className="font-normal">
                  {t.readOnly ? "Read-only" : "Approval required"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent tool activity</CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tool activity yet.
              </p>
            ) : (
              <div className="space-y-1">
                {runs.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium text-navy">{r.tool_name}</span>
                    <span className="text-muted-foreground">{r.agent_key}</span>
                    <span
                      className={
                        r.status === "failed" ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {r.status}
                    </span>
                    <span className="text-muted-foreground">{r.duration_ms ?? 0}ms</span>
                    <span className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
