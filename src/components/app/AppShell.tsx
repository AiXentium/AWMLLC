import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  BrainCircuit,
  Building2,
  FileStack,
  FolderKanban,
  FolderSearch,
  Gauge,
  Globe,
  Inbox,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquareText,
  PenLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import logoUrl from "@/assets/awm-shield-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { AiWorkspaceProvider } from "@/lib/ai/context";
import { AiDock } from "@/components/app/ai/AiDock";

const GROUPS = [
  {
    label: "Workspace",
    items: [
      { to: "/app/dashboard", label: "Dashboard", icon: Gauge },
      { to: "/app/projects", label: "Projects", icon: FolderKanban },
      { to: "/app/quote-requests", label: "Quote Requests", icon: Inbox },
      { to: "/app/incoming-files", label: "Incoming Files", icon: FolderSearch },
      { to: "/app/pages", label: "Pages", icon: FileStack },
      { to: "/app/viewer", label: "Viewer", icon: Sparkles },
      { to: "/app/bids", label: "Bids", icon: Inbox },
      { to: "/app/site", label: "Site Editor", icon: PenLine },
      { to: "/app/site/ai", label: "AI Site Agent", icon: Sparkles },
    ],
  },
  {
    label: "Takeoff Control Center",
    items: [{ to: "/app/takeoff", label: "Control Center", icon: LayoutGrid }],
  },

  {
    label: "Review & Quote",
    items: [
      { to: "/app/schedules", label: "Schedules", icon: Waypoints },
      { to: "/app/jurisdiction", label: "Jurisdiction", icon: ShieldCheck },
      { to: "/app/ykk-integration", label: "YKK Integration", icon: Globe },
      { to: "/app/ykk-automation", label: "YKK Automation", icon: Bot },
    ],
  },
  {
    label: "AI",
    items: [
      { to: "/app/ai", label: "AI Workspace", icon: MessageSquareText },
      { to: "/app/ai-memory", label: "AI Memory", icon: BrainCircuit },
      { to: "/app/ai-settings", label: "AI Settings", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Account",
    items: [{ to: "/app/settings", label: "Report Settings", icon: Building2 }],
  },
] as const;

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="space-y-7">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
            {group.label}
          </p>
          <nav aria-label={group.label} className="mt-2 flex flex-col gap-1">
            {group.items.map(({ to, label, icon: Icon }) => {
              const active = pathname === to || pathname.startsWith(`${to}/`);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/78 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}

function initialsFromEmail(email: string | null) {
  if (!email) return "AW";
  const root = email.split("@")[0] ?? "AW";
  const parts = root.split(/[._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? "A"}${parts[1][0] ?? "W"}`.toUpperCase();
}

function AppShellInner({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const initials = useMemo(() => initialsFromEmail(email), [email]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/takeoff-login", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col justify-between bg-sidebar px-4 py-5 text-sidebar-foreground">
      <div>
        <Link to="/app/dashboard" className="flex items-center gap-3 px-2">
          <img src={logoUrl} alt="AWM LLC shield logo" className="h-14 w-14 object-contain" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">AWM Takeoff AI</p>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.16em] text-sidebar-foreground/50">
              Internal workspace
            </p>
          </div>
        </Link>
        <div className="mt-8">
          <NavContent onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <div className="rounded-md border border-sidebar-border bg-sidebar-accent/60 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{email ?? "AWM User"}</p>
            <p className="text-xs text-sidebar-foreground/50">Authorized workspace</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="mr-2 size-4" aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-sidebar-border lg:block">{sidebar}</aside>

      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b border-sidebar-border bg-navy px-4 py-3 text-navy-foreground sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Open workspace menu"
                    className="border-sidebar-border bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
                  >
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[18rem] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
                >
                  <SheetTitle className="sr-only">Workspace menu</SheetTitle>
                  {sidebar}
                </SheetContent>
              </Sheet>
              <div className="relative hidden w-full max-w-md md:block">
                <Search
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-foreground/45"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Search projects"
                  placeholder="Search projects, pages, takeoffs..."
                  className="h-10 border-sidebar-border bg-navy-soft pl-9 text-navy-foreground placeholder:text-navy-foreground/45"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 md:flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
                >
                  <Building2 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
                >
                  <Search className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3 rounded-full border border-sidebar-border bg-navy-soft px-2 py-1.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
                <div className="hidden pr-2 sm:block">
                  <p className="text-sm font-medium leading-none">
                    {email ? email.split("@")[0] : "AWM User"}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-navy-foreground/52">AWM Estimating</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-[110rem]">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
                {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            </div>
            {children}
          </div>
        </main>
      </div>
      <AiDock />
    </div>
  );
}

export function AppShell(props: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AiWorkspaceProvider>
      <AppShellInner {...props} />
    </AiWorkspaceProvider>
  );
}
