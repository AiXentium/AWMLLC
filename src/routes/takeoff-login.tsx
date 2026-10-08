import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Brain,
  FileSpreadsheet,
  Loader2,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import logoAsset from "@/assets/awm-shield-logo.png.asset.json";
import heroImg from "@/assets/hero-home.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/takeoff-login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next:
      typeof search.next === "string" &&
      search.next.startsWith("/") &&
      !search.next.startsWith("//")
        ? search.next
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AWM Takeoff AI — Sign in" },
      {
        name: "description",
        content:
          "Sign in to AWM Takeoff AI, the internal quantity and takeoff workspace for AWM LLC project teams.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "AWM Takeoff AI — Sign in" },
      {
        property: "og:description",
        content: "Internal workspace sign-in for AWM LLC project teams.",
      },
    ],
    links: [{ rel: "canonical", href: "/takeoff-login" }],
  }),
  component: TakeoffLoginPage,
});

const features = [
  {
    icon: ShieldCheck,
    title: "Enterprise-Grade Security",
    copy: "Role-based access for estimating, review, and project team coordination.",
  },
  {
    icon: FileSpreadsheet,
    title: "Accurate Takeoffs",
    copy: "Structured plan review, page management, schedules, and quote-readiness workflows.",
  },
  {
    icon: Brain,
    title: "AI Project Assistant",
    copy: "Project-aware insights, review support, and controlled workflow automation states.",
  },
];

function TakeoffLoginPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  /** Honour a preserved same-origin destination (e.g. the OAuth consent screen). */
  const goToDestination = (replace: boolean) => {
    if (next) {
      window.location.replace(next);
      return;
    }
    // Combined app: the dashboard lives at /app in this same project.
    window.location.assign("/app/dashboard");
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goToDestination(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, next]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setPending(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Those credentials weren't recognized. AWM Takeoff AI is invitation-only at go-live; for demo access use one of the listed workspace accounts."
          : signInError.message,
      );
      return;
    }

    if (!remember) {
      window.addEventListener("beforeunload", () => void supabase.auth.signOut(), { once: true });
    }

    goToDestination(true);
  }

  async function handleReset() {
    setError(null);
    if (!email.trim()) {
      setNotice("Enter your workspace email above, then select Forgot password.");
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setNotice(
      resetError
        ? resetError.message
        : "If that email belongs to an authorized workspace user, a reset link is on its way.",
    );
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img
          src={heroImg}
          alt="Coastal home exterior"
          className="absolute inset-0 size-full object-cover"
        />
        <div
          className="absolute inset-0 bg-linear-to-br from-navy via-navy/92 to-navy/68"
          aria-hidden="true"
        />
        <div className="relative flex h-full flex-col justify-between p-10 text-navy-foreground xl:p-14">
          <div className="max-w-xl">
            <img
              src={logoAsset.url}
              alt="AWM LLC shield logo"
              className="h-36 w-36 object-contain"
            />
            <h1 className="mt-8 text-6xl leading-none">AWM Takeoff AI</h1>
            <p className="mt-6 text-xl text-navy-foreground/78">
              Secure window and door project workspace built for estimating, review, and release
              coordination.
            </p>
            <div className="mt-10 space-y-6">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex gap-4 border-b border-navy-foreground/12 pb-5"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-navy-foreground/20 bg-navy-foreground/6">
                    <feature.icon className="size-6 text-brand-red" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-2xl">{feature.title}</p>
                    <p className="mt-2 text-base leading-relaxed text-navy-foreground/72">
                      {feature.copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-navy-foreground/58">
            Secure. Accurate. Built for window and door professionals.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6 sm:p-10 xl:p-14">
        <div className="w-full max-w-xl rounded-[1.5rem] border border-border bg-card p-8 shadow-[var(--shadow-elevated)] sm:p-10">
          <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full border border-primary/15 bg-primary/5">
            <Lock className="size-9 text-navy" aria-hidden="true" />
          </div>
          <h2 className="mt-6 text-center text-4xl text-navy">Welcome Back</h2>
          <p className="mt-3 text-center text-base text-muted-foreground">
            Sign in to access your AWM Takeoff AI workspace.
          </p>

          {error ? (
            <Alert variant="destructive" className="mt-6" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {notice ? (
            <Alert className="mt-6" role="status">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="h-13 rounded-md"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-13 rounded-md pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                />
                <Label htmlFor="remember" className="text-sm font-normal">
                  Remember me
                </Label>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-sm font-medium text-brand-red underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-13 w-full border border-brand-red bg-brand-red text-brand-red-foreground hover:bg-brand-red/90"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-8 rounded-md border border-dashed border-border bg-secondary/55 p-4 text-sm leading-relaxed text-muted-foreground">
            <p className="font-semibold uppercase tracking-[0.14em] text-bronze">Demo access</p>
            <div className="mt-2 space-y-1">
              <p>demo@awmllc.com — Owner / Admin</p>
              <p>estimator@awmllc.com — Estimator</p>
              <p>reviewer@awmllc.com — Reviewer</p>
              <p>viewer@awmllc.com — Viewer</p>
              <p className="pt-1">Password for all demo accounts: AWMdemo2026!</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3">
            <Button asChild variant="outline" className="h-12 w-full">
              <Link to="/">Back to AWM Website</Link>
            </Button>
            <p className="text-center text-sm text-muted-foreground">Authorized users only</p>
          </div>

          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to main site
          </Link>
        </div>
      </div>
    </div>
  );
}
