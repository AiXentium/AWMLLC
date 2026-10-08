import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { StatCard, StatusBadge } from "@/components/app/WorkspacePrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/app/ykk-integration")({
  component: YkkIntegrationPage,
});

type Connector = {
  id: string;
  provider: string;
  display_name: string;
  status: string;
  config: Record<string, string> | null;
};

const METHODS: { provider: string; name: string; description: string }[] = [
  {
    provider: "ykk_api",
    name: "API Integration",
    description: "Direct product and quote exchange",
  },
  { provider: "ykk_oauth", name: "OAuth / SSO", description: "Delegated account access" },
  { provider: "ykk_file", name: "File Exchange", description: "Scheduled import and export" },
  {
    provider: "ykk_extension",
    name: "Browser Extension",
    description: "Assisted portal data entry",
  },
  { provider: "ykk_local", name: "Local Connector", description: "On-network file bridge" },
  { provider: "ykk_manual", name: "Manual Entry", description: "Estimator-entered configurations" },
];

const STATUS_OPTIONS = [
  "Awaiting YKK Integration Approval",
  "Connection Setup Required",
  "Connected",
  "Active",
  "Disabled",
];

function YkkIntegrationPage() {
  const qc = useQueryClient();
  const { data: roleData } = useMyRole();
  const isAdmin = roleData?.role === "owner_admin";

  const connectors = useQuery({
    queryKey: ["ykk-connectors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("file_connectors")
        .select("id,provider,display_name,status,config")
        .like("provider", "ykk%");
      if (error) throw error;
      return (data ?? []) as Connector[];
    },
  });

  const catalog = useQuery({
    queryKey: ["ykk-catalog-summary"],
    queryFn: async () => {
      const [products, mappings] = await Promise.all([
        supabase.from("ykk_products").select("id,verified,active"),
        supabase.from("ykk_mappings").select("id,status"),
      ]);
      return {
        products: products.data?.length ?? 0,
        verified: (products.data ?? []).filter((p) => p.verified).length,
        mappings: mappings.data?.length ?? 0,
      };
    },
  });

  const byProvider = useMemo(
    () => new Map((connectors.data ?? []).map((c) => [c.provider, c])),
    [connectors.data],
  );

  const [endpoint, setEndpoint] = useState("");
  const [clientId, setClientId] = useState("");
  const [environment, setEnvironment] = useState("sandbox");

  const upsert = useMutation({
    mutationFn: async (input: {
      provider: string;
      displayName: string;
      status: string;
      config?: Record<string, string>;
    }) => {
      const existing = byProvider.get(input.provider);
      const payload = {
        provider: input.provider,
        display_name: input.displayName,
        status: input.status,
        config: (input.config ?? existing?.config ?? {}) as Record<string, string>,
      };
      const { error } = existing
        ? await supabase.from("file_connectors").update(payload).eq("id", existing.id)
        : await supabase.from("file_connectors").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Connection method updated.");
      void qc.invalidateQueries({ queryKey: ["ykk-connectors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apiConnector = byProvider.get("ykk_api");
  const apiConfig = (apiConnector?.config ?? {}) as Record<string, string>;

  return (
    <AppShell
      title="YKK Integration"
      subtitle="Connection methods for product data and quote exchange."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Configured methods"
          value={connectors.data?.length ?? 0}
          hint="Stored connection records"
        />
        <StatCard
          label="Catalog products"
          value={catalog.data?.products ?? 0}
          hint="YKK AP products on file"
        />
        <StatCard
          label="Verified products"
          value={catalog.data?.verified ?? 0}
          hint="Confirmed against YKK data"
        />
        <StatCard
          label="Item mappings"
          value={catalog.data?.mappings ?? 0}
          hint="Takeoff items linked to products"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="surface-panel p-6">
          <h2 className="font-serif text-2xl text-navy">Connection methods</h2>
          <ul className="mt-4 space-y-3">
            {METHODS.map((method) => {
              const row = byProvider.get(method.provider);
              const status = row?.status ?? "Connection Setup Required";
              return (
                <li
                  key={method.provider}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium text-foreground">{method.name}</p>
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                  </div>
                  {isAdmin ? (
                    <Select
                      value={status}
                      onValueChange={(value) =>
                        upsert.mutate({
                          provider: method.provider,
                          displayName: method.name,
                          status: value,
                        })
                      }
                    >
                      <SelectTrigger className="w-[17rem]" aria-label={`${method.name} status`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusBadge label={status} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="surface-panel p-6">
          <h2 className="font-serif text-2xl text-navy">API configuration</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Endpoint and environment settings are stored here. Passwords, client secrets and portal
            credentials are never stored by AWM — they stay with the estimator signing in directly.
          </p>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint URL</Label>
              <Input
                id="endpoint"
                placeholder={apiConfig.endpoint ?? "https://"}
                value={endpoint}
                disabled={!isAdmin}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-id">Client ID</Label>
              <Input
                id="client-id"
                placeholder={apiConfig.clientId ?? "Provided by YKK AP"}
                value={clientId}
                disabled={!isAdmin}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="environment">Environment</Label>
              <Select value={environment} onValueChange={setEnvironment} disabled={!isAdmin}>
                <SelectTrigger id="environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!isAdmin || upsert.isPending}
              onClick={() =>
                upsert.mutate({
                  provider: "ykk_api",
                  displayName: "API Integration",
                  status: apiConnector?.status ?? "Awaiting YKK Integration Approval",
                  config: {
                    ...apiConfig,
                    endpoint: endpoint || apiConfig.endpoint || "",
                    clientId: clientId || apiConfig.clientId || "",
                    environment,
                  },
                })
              }
            >
              {isAdmin ? "Save API configuration" : "Administrator access required"}
            </Button>
            {apiConnector ? (
              <p className="text-xs text-muted-foreground">
                Current: {apiConfig.environment ?? "sandbox"} ·{" "}
                {apiConfig.endpoint || "no endpoint set"}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
