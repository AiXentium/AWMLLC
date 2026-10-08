import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  ClipboardCheck,
  FileStack,
  Handshake,
  Layers,
  MapPin,
  MessageSquare,
  ScrollText,
  ShieldQuestion,
  Truck,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero, Section, SectionHeading } from "@/components/site/Section";
import { PageSections } from "@/components/site/PageSections";
import { useSitePage } from "@/lib/site-pages";
import { QuoteCta } from "@/components/site/QuoteCta";
import detailImg from "@/assets/coastal-modern.webp";
import livingRoomImg from "@/assets/about-living-room.webp";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Why AWM | AWM LLC" },
      {
        name: "description",
        content:
          "AWM LLC is an independent Florida supplier and project-support partner for YKK AP residential windows and patio doors.",
      },
      { property: "og:title", content: "Why AWM | AWM LLC" },
      {
        property: "og:description",
        content:
          "A practical supply and project-support partner for Florida window and patio door packages.",
      },
    ],
  }),
  component: AboutPage,
});

const VALUES = [
  {
    icon: MessageSquare,
    title: "Straight answers",
    copy: "If availability or a rating has not been confirmed, we say so. We would rather slow a quote by a day than put an unconfirmed number in writing.",
  },
  {
    icon: MapPin,
    title: "Florida-focused",
    copy: "Our work centers on Florida and Southeast projects, where humidity, salt exposure, and wind requirements shape nearly every selection.",
  },
  {
    icon: Handshake,
    title: "Built around your process",
    copy: "Homeowner or hundred-unit developer, we adapt to how you already work — your schedule, your submittal format, your site logistics.",
  },
  {
    icon: ShieldQuestion,
    title: "Clear about our role",
    copy: "We supply and support. Manufacturing, engineering, and code determinations sit with the manufacturer and your design professional.",
  },
];

const SERVICES = [
  {
    icon: ClipboardCheck,
    title: "Project consultation",
    copy: "Early conversation about application, exposure, jurisdiction, budget range, and schedule before selections are locked.",
  },
  {
    icon: FileStack,
    title: "Plan review",
    copy: "We work from your architectural set, window schedule, or opening list and flag gaps or conflicts we notice.",
  },
  {
    icon: Layers,
    title: "Product selection",
    copy: "Family, type, and frame/application style matched to each opening and wall assembly across the elevation.",
  },
  {
    icon: CalendarClock,
    title: "Release scheduling",
    copy: "Phased releases by building, stack, or lot so material lands with your framing and dry-in sequence.",
  },
  {
    icon: Truck,
    title: "Delivery coordination",
    copy: "Staging, delivery windows, and site logistics coordinated with your superintendent.",
  },
  {
    icon: ScrollText,
    title: "Florida compliance awareness",
    copy: "We track what the project's stated code path requires and confirm approval documentation with the manufacturer.",
  },
];

function AboutPage() {
  // Visual editor override: when a published site_pages row exists, it wins.
  // Before `supabase db push` this resolves to null and the hardcoded page renders.
  const { data: cms } = useSitePage("about");
  const cmsSections = cms?.content.sections;
  if (cmsSections && cmsSections.length > 0) {
    return (
      <SiteLayout>
        <PageSections sections={cmsSections} />
      </SiteLayout>
    );
  }
  return (
    <SiteLayout>
      <PageHero
        eyebrow="About us"
        title="A supply partner that stays with the project"
        intro="AWM LLC — American Windows Manufacturer LLC — is an authorized distributor of YKK AP residential windows and patio doors, supporting the work around them: selection, quantities, documentation, and delivery."
        image={detailImg}
        imageAlt=""
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <SectionHeading eyebrow="Who we are" title="Practical supply and project support" />
            <div className="mt-6 space-y-5 leading-relaxed text-muted-foreground">
              <p>
                AWM LLC is an independent supplier and distributor serving homeowners, builders,
                contractors, architects, and multifamily developers across Florida and the
                Southeast. We supply residential windows and patio doors from the YKK AP StyleView®,
                StyleGuard®, and Precedence® lines.
              </p>
              <p>
                What our clients rely on is the work in between: reading a plan set, translating it
                into a defensible opening schedule, confirming configurations with the manufacturer,
                and keeping delivery aligned with the build. That work is where projects get
                expensive when it goes wrong, and it is where we spend our time.
              </p>
              <p>
                We are steadily investing in tooling to do that faster — including AWM Takeoff AI,
                our internal quantity and takeoff workspace, currently in Phase 1 preview.
              </p>
              <p>
                Why YKK AP? Because our clients need products that hold up in Florida: premium vinyl
                that stands up to heat, salt, and sun; impact-rated options with Florida product
                approvals; and a limited lifetime warranty behind them. We chose a lineup we can
                stand behind — StyleView® for new construction, StyleGuard® for impact work,
                Precedence® for replacement — and we do the homework of matching the right series to
                every opening.
              </p>
            </div>
          </div>

          <aside className="h-fit rounded-lg border border-border bg-secondary/50 p-8">
            <h3 className="font-serif text-xl text-navy">What we are not</h3>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
              <li>
                AWM LLC does not manufacture YKK AP products. All products are manufactured by their
                respective manufacturer.
              </li>
              <li>
                AWM LLC is an authorized distributor of YKK AP residential products. We supply and
                support the product lines, and confirm availability, performance values, and
                approval documentation with the manufacturer.
              </li>
              <li>
                We do not provide engineering, code compliance determinations, or installation
                certification.
              </li>
              <li>
                Product availability, performance values, and approval documentation are subject to
                manufacturer confirmation.
              </li>
            </ul>
          </aside>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Single-family</p>
            <h2 className="mt-3 font-serif text-3xl text-navy">Production and custom homes</h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Repeatable plan-based packages for production builders, and one-off selections for
              custom work. We keep a record of your standard selections by plan so re-orders don't
              start from scratch.
            </p>
          </div>
          <div>
            <p className="eyebrow">Multifamily</p>
            <h2 className="mt-3 font-serif text-3xl text-navy">
              Garden, mid-rise, and townhome communities
            </h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Unit-type-driven quantities, phased building releases, and consistent configurations
              across stacks — with documentation organized the way your submittal process expects.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="sand">
        <SectionHeading eyebrow="What we handle" title="Support across the project lifecycle" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <li key={s.title} className="rounded-lg border border-border bg-card p-7">
              <s.icon className="size-6 text-bronze" aria-hidden="true" />
              <h3 className="mt-5 font-serif text-xl text-navy">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.copy}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionHeading eyebrow="How we work" title="Four things we hold ourselves to" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2">
          {VALUES.map((v) => (
            <li key={v.title} className="rounded-lg border border-border bg-card p-8">
              <v.icon className="size-6 text-bronze" aria-hidden="true" />
              <h3 className="mt-5 font-serif text-xl text-navy">{v.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.copy}</p>
            </li>
          ))}
        </ul>
      </Section>

      <section className="shell">
        <div className="overflow-hidden rounded-lg">
          <img
            src={livingRoomImg}
            alt="Bright Florida living room with sliding glass doors open to the pool"
            className="aspect-[21/9] w-full object-cover"
            loading="lazy"
          />
        </div>
      </section>

      <QuoteCta title="Let's talk about your project" />
    </SiteLayout>
  );
}
