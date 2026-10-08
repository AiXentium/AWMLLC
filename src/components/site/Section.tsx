import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "sand" | "navy";
}) {
  return (
    <section
      className={cn(
        "py-20 md:py-28",
        tone === "sand" && "bg-sand",
        tone === "navy" && "bg-navy text-navy-foreground",
        className,
      )}
    >
      <div className="shell">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  invert = false,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
  invert?: boolean;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2
        className={cn(
          "mt-3 text-3xl leading-tight md:text-4xl",
          invert ? "text-navy-foreground" : "text-navy",
        )}
      >
        {title}
      </h2>
      {intro ? (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed md:text-lg",
            invert ? "text-navy-foreground/75" : "text-muted-foreground",
          )}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  intro,
  image,
  imageAlt,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  image?: string;
  imageAlt?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-navy text-navy-foreground">
      {image ? (
        <>
          <img
            src={image}
            alt={imageAlt ?? ""}
            width={1600}
            height={900}
            className="absolute inset-0 size-full object-cover opacity-35"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/40"
          />
        </>
      ) : null}
      <div className="shell relative py-20 md:py-28">
        <div className="max-w-3xl fade-up">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 text-4xl leading-[1.08] md:text-5xl">{title}</h1>
          <p className="mt-6 text-base leading-relaxed text-navy-foreground/80 md:text-lg">
            {intro}
          </p>
          {children ? <div className="mt-9 flex flex-wrap gap-3">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
