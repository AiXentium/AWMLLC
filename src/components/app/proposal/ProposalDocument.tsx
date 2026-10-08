/**
 * ProposalDocument - presentation-quality bid document rendered in the browser.
 *
 * Mirrors the Excel/PDF export layout (title block, project info, line items,
 * totals, category breakdown, verification summary, terms) so the on-screen
 * view looks like the finished proposal, not a raw data table.
 */
import { Badge } from "@/components/ui/badge";
import type { GroupedProposalLine } from "./proposal-lines";

export interface ProposalDocumentCompany {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface ProposalDocumentProject {
  name: string;
  address?: string | null;
  date?: string | null;
  preparedFor?: string | null;
}

interface ProposalDocumentProps {
  company: ProposalDocumentCompany;
  project: ProposalDocumentProject;
  lines: GroupedProposalLine[];
  totalUnits: number;
  verifiedCount: number;
  unverifiedCount: number;
  byCategory: { category: string; units: number }[];
  validityDays: number;
  notes?: string | null;
}

export function ProposalDocument({
  company,
  project,
  lines,
  totalUnits,
  verifiedCount,
  unverifiedCount,
  byCategory,
  validityDays,
  notes,
}: ProposalDocumentProps) {
  const contact = [company.address, company.phone, company.email].filter(Boolean).join("  |  ");

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b-4 border-navy bg-navy px-8 py-8 text-white">
        <p className="font-serif text-3xl tracking-tight">{company.name}</p>
        {contact ? <p className="mt-2 text-sm text-white/70">{contact}</p> : null}
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-bronze">
          Proposal
        </p>
      </div>
      <div className="px-8 py-8">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {[
            ["Project", project.name],
            ["Address", project.address || "-"],
            ["Date", project.date || "-"],
            ["Prepared for", project.preparedFor || "To be confirmed"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 text-sm font-medium text-navy">{value}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mt-8 font-serif text-lg text-navy">Scope of work</h3>
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy text-left text-xs uppercase tracking-[0.12em] text-white">
                <th className="px-4 py-3 font-semibold">Mark</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Size</th>
                <th className="px-4 py-3 text-right font-semibold">Qty</th>
                <th className="px-4 py-3 font-semibold">Floor / Building</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l) => (
                <tr key={l.key} className="align-top even:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-navy">{l.mark}</td>
                  <td className="px-4 py-3">{l.description}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{l.size}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{l.quantity}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.locations}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {l.allApproved ? (
                      <Badge variant="secondary">Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-600/40 text-amber-700">
                        Needs review
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No line items - run takeoff first.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/30 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Total units
            </p>
            <p className="mt-1 font-serif text-4xl text-navy">{totalUnits}</p>
            <div className="mt-4 space-y-1.5">
              {byCategory.map((c) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.category}</span>
                  <span className="font-semibold tabular-nums text-navy">{c.units}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Verification summary
            </p>
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Verified lines</span>
                <span className="font-semibold tabular-nums text-emerald-700">{verifiedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Needs review</span>
                <span className="font-semibold tabular-nums text-amber-700">{unverifiedCount}</span>
              </div>
            </div>
            {unverifiedCount > 0 ? (
              <p className="mt-3 text-xs italic text-amber-700">
                Review unverified lines in the Takeoff tab before sending.
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-8 space-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-navy">Terms: </span>
            Valid {validityDays} days. Unit pricing TBD - quantities auto-populated from AI takeoff.
          </p>
          {notes && notes.trim() ? (
            <p>
              <span className="font-semibold text-navy">Notes: </span>
              {notes.trim()}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
