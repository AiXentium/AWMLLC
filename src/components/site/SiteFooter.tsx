import { Link } from "@tanstack/react-router";
import { Mail, MapPin } from "lucide-react";
import logoUrl from "@/assets/awm-shield-logo.png";
import { LEGAL_NOTE } from "@/data/products";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-navy text-navy-foreground">
      <div className="shell grid gap-10 py-14 lg:grid-cols-[1.3fr_1fr_1fr_1.1fr]">
        <div>
          <img src={logoUrl} alt="AWM LLC shield logo" className="h-28 w-28 object-contain" />
          <p className="mt-4 text-base font-semibold">AWM LLC</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-navy-foreground/72">
            Independent supplier and distributor of YKK AP residential windows and patio doors for
            Florida and Central Florida residential, builder, and multifamily projects.
          </p>
        </div>

        <nav aria-label="Products">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bronze">Products</p>
          <ul className="mt-4 space-y-3 text-sm text-navy-foreground/78">
            <li>
              <Link to="/products" className="hover:text-navy-foreground">
                All Products
              </Link>
            </li>
            <li>
              <Link to="/products/styleview" className="hover:text-navy-foreground">
                StyleView®
              </Link>
            </li>
            <li>
              <Link to="/products/styleguard" className="hover:text-navy-foreground">
                StyleGuard®
              </Link>
            </li>
            <li>
              <Link to="/products/precedence" className="hover:text-navy-foreground">
                Precedence®
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Company">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bronze">Company</p>
          <ul className="mt-4 space-y-3 text-sm text-navy-foreground/78">
            <li>
              <Link to="/contact" className="hover:text-navy-foreground">
                Contact / Quote
              </Link>
            </li>
            <li>
              <Link to="/takeoff-login" className="hover:text-navy-foreground">
                Takeoff Login
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bronze">Contact</p>
          <ul className="mt-4 space-y-4 text-sm text-navy-foreground/78">
            <li className="flex gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-bronze" aria-hidden="true" />
              <a href="mailto:info@awm.llc" className="hover:text-navy-foreground">
                info@awm.llc
              </a>
            </li>
            <li className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-bronze" aria-hidden="true" />
              <span>www.awm.llc · Serving Florida and Central Florida projects</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-sidebar-border">
        <div className="shell flex flex-col gap-4 py-6 text-xs leading-relaxed text-navy-foreground/58 md:flex-row md:items-center md:justify-between">
          <p className="max-w-4xl">{LEGAL_NOTE}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/privacy" className="hover:text-navy-foreground">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-navy-foreground">
              Terms & Disclaimer
            </Link>
            <p>© {new Date().getFullYear()} AWM LLC</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
