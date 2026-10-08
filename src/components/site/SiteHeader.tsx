import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Lock, Menu, X } from "lucide-react";
import logoUrl from "@/assets/awm-shield-logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";

const NAV: ReadonlyArray<{ to: string; label: string; exact?: boolean }> = [
  { to: "/", label: "Home", exact: true },
  { to: "/products", label: "Products" },
  { to: "/contact", label: "Contact" },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="AWM LLC home">
      <img
        src={logoUrl}
        alt="AWM LLC shield logo"
        className="h-14 w-14 object-contain md:h-16 md:w-16"
      />
      <div className="hidden min-w-0 sm:block">
        <p className="text-base font-semibold text-navy-foreground">AWM LLC</p>
      </div>
    </Link>
  );
}

function NavLink({ to, label, exact = false }: { to: string; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="relative inline-flex items-center gap-1 py-8 text-sm font-medium text-navy-foreground/78 transition-colors hover:text-navy-foreground after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-brand-red after:transition-transform data-[status=active]:text-navy-foreground data-[status=active]:after:scale-x-100"
    >
      <span>{label}</span>
      {label === "Products" || label === "Resources" ? (
        <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-sidebar-border bg-navy text-navy-foreground shadow-[var(--shadow-card)]">
      <div className="shell flex h-20 items-center justify-between gap-4">
        <Brand />

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} label={item.label} exact={item.exact} />
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Button
            asChild
            size="sm"
            className="border border-brand-red bg-brand-red text-brand-red-foreground hover:bg-brand-red/90"
          >
            <Link to="/contact">Request a Quote</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-navy-foreground/35 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
          >
            <Link to="/takeoff-login">
              Takeoff Login
              <Lock className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button
              variant="outline"
              size="icon"
              aria-label="Open menu"
              className="border-navy-foreground/25 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[21rem] border-sidebar-border bg-navy p-0 text-navy-foreground"
          >
            <SheetTitle className="sr-only">Site navigation</SheetTitle>
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-5">
                <Brand />
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close menu"
                    className="text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
                  >
                    <X className="size-5" />
                  </Button>
                </SheetClose>
              </div>

              <nav aria-label="Mobile" className="flex flex-1 flex-col gap-1 px-4 py-5">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      activeOptions={{ exact: item.exact }}
                      className="rounded-md px-3 py-3 text-base font-medium text-navy-foreground/82 hover:bg-navy-foreground/10 hover:text-navy-foreground data-[status=active]:bg-navy-foreground/10 data-[status=active]:text-navy-foreground"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>

              <div className="space-y-3 border-t border-sidebar-border p-4">
                <SheetClose asChild>
                  <Button
                    asChild
                    className="w-full border border-brand-red bg-brand-red text-brand-red-foreground hover:bg-brand-red/90"
                  >
                    <Link to="/contact">Request a Quote</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full border-navy-foreground/30 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
                  >
                    <Link to="/takeoff-login">Takeoff Login</Link>
                  </Button>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
