import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function QuoteCta({
  title = "Ready to price your openings?",
  intro = "Send plans, an elevation schedule, or a simple opening list. We'll review the selections and come back with a quote package.",
}: {
  title?: string;
  intro?: string;
}) {
  return (
    <section className="bg-navy text-navy-foreground">
      <div className="shell flex flex-col items-start gap-8 py-20 md:flex-row md:items-center md:justify-between md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl leading-tight md:text-4xl">{title}</h2>
          <p className="mt-4 text-base leading-relaxed text-navy-foreground/75">{intro}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link to="/contact">Request a Quote</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-navy-foreground/40 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
          >
            <Link to="/products">Explore Products</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
