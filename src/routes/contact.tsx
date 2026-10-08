import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ClipboardList, Clock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero, Section } from "@/components/site/Section";
import { PageSections } from "@/components/site/PageSections";
import { useSitePage } from "@/lib/site-pages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FAMILIES } from "@/data/products";
import { submitQuoteRequest } from "@/lib/quote-request.functions";
import {
  QuoteDocumentUpload,
  type UploadedQuoteDocument,
} from "@/components/site/QuoteDocumentUpload";
import heroImage from "@/assets/quote-florida-home.webp";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Request a Quote | Contact AWM LLC" },
      {
        name: "description",
        content:
          "Tell us about your Florida window and door project and the AWM LLC team will provide a detailed quote tailored to your openings, schedule, and jurisdiction.",
      },
      { property: "og:title", content: "Request a Quote | Contact AWM LLC" },
      {
        property: "og:description",
        content: "Start a window and patio door quote for your Florida project with AWM LLC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const PROJECT_TYPES = [
  "New construction — single family",
  "New construction — multifamily",
  "Replacement / remodel",
  "Coastal / impact project",
  "Commercial / storefront",
  "Architect or design inquiry",
  "Other",
];

const CONTACT_METHODS = ["Email", "Phone", "Text message"];

const BUDGET_RANGES = [
  "Under $25,000",
  "$25,000 – $100,000",
  "$100,000 – $500,000",
  "$500,000 – $1M",
  "Over $1M",
  "Not determined",
];

const COUNTIES = [
  "Broward",
  "Miami-Dade",
  "Palm Beach",
  "Orange",
  "Hillsborough",
  "Pinellas",
  "Lee",
  "Collier",
  "Duval",
  "Sarasota",
  "Monroe",
  "Brevard",
  "Volusia",
  "Other / outside Florida",
];

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().min(1, "Enter your last name").max(80),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").max(255),
  phone: z.string().trim().min(7, "Enter a phone number").max(40),
  preferredContact: z.string().trim().max(40).optional().or(z.literal("")),
  projectName: z.string().trim().min(1, "Enter a project name").max(160),
  projectAddress: z.string().trim().min(1, "Enter the project address").max(240),
  city: z.string().trim().min(1, "Enter a city").max(120),
  county: z.string().trim().max(120).optional().or(z.literal("")),
  state: z.string().trim().min(1, "Enter a state").max(60),
  zipCode: z.string().trim().max(20).optional().or(z.literal("")),
  projectType: z.string().trim().min(1, "Select a project type").max(120),
  productInterest: z.string().trim().max(160).optional().or(z.literal("")),
  quantities: z.string().trim().max(60).optional().or(z.literal("")),
  deadline: z.string().trim().max(40).optional().or(z.literal("")),
  budgetRange: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Tell us about the project").max(4000),
  consent: z.literal(true, { message: "Please accept to continue" }),
});

type FormValues = z.infer<typeof schema>;
type Errors = Partial<Record<keyof FormValues, string>>;

const EMPTY: Omit<FormValues, "consent"> & { consent: boolean } = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  preferredContact: "Email",
  projectName: "",
  projectAddress: "",
  city: "",
  county: "",
  state: "Florida",
  zipCode: "",
  projectType: "",
  productInterest: "",
  quantities: "",
  deadline: "",
  budgetRange: "",
  message: "",
  consent: false,
};

function Field({
  id,
  label,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-sm font-medium text-navy">
        {label}
        {required ? <span className="ml-1 text-brand-red">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ContactPage() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [documents, setDocuments] = useState<UploadedQuoteDocument[]>([]);
  const draftToken = useMemo(() => crypto.randomUUID(), []);
  const submit = useServerFn(submitQuoteRequest);
  // Visual editor override for the intro content. The quote form below
  // always renders — CMS sections never remove the lead path.
  const { data: cms } = useSitePage("contact");
  const cmsSections = cms?.content.sections;
  const showCms = Boolean(cmsSections && cmsSections.length > 0);

  const mutation = useMutation({
    mutationFn: (data: FormValues) => submit({ data: { ...data, draftToken, documents } }),
  });

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof Errors;
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  }

  return (
    <SiteLayout>
      {showCms ? (
        <PageSections sections={cmsSections!} />
      ) : (
        <PageHero
          eyebrow="Home / Contact / Request Quote"
          title="Request a Quote"
          intro="Tell AWM LLC about your project — we'll review your openings, confirm configurations with YKK AP, and come back with a detailed quote."
          image={heroImage}
          imageAlt="Florida coastal residence with impact-rated windows and doors"
        />
      )}

      <Section tone="sand" className="py-14 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="rounded-lg border border-border bg-card p-6 shadow-card md:p-9">
            {mutation.isSuccess ? (
              <div className="py-10 text-center" role="status" aria-live="polite">
                <CheckCircle2 className="mx-auto size-10 text-bronze" aria-hidden="true" />
                <h2 className="mt-6 text-3xl text-navy">Request received</h2>
                <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted-foreground">
                  Thank you — your request has been recorded. A member of the AWM LLC team will
                  follow up to confirm configurations and quantities before anything is quoted.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button asChild variant="secondary">
                    <Link to="/products">Explore products</Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      mutation.reset();
                      setValues(EMPTY);
                      setDocuments([]);
                    }}
                  >
                    Submit another request
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <div className="flex items-center gap-3">
                  <ClipboardList className="size-6 text-navy" aria-hidden="true" />
                  <h2 className="text-2xl text-navy">Tell Us About Your Project</h2>
                  <span className="h-px w-10 bg-brand-red" aria-hidden="true" />
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <Field id="firstName" label="First Name" error={errors.firstName} required>
                    <Input
                      id="firstName"
                      value={values.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                      placeholder="Enter first name"
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field id="lastName" label="Last Name" error={errors.lastName} required>
                    <Input
                      id="lastName"
                      value={values.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      placeholder="Enter last name"
                      autoComplete="family-name"
                    />
                  </Field>
                  <Field id="company" label="Company Name">
                    <Input
                      id="company"
                      value={values.company}
                      onChange={(e) => set("company", e.target.value)}
                      placeholder="Enter company name"
                      autoComplete="organization"
                    />
                  </Field>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <Field id="email" label="Email Address" error={errors.email} required>
                    <Input
                      id="email"
                      type="email"
                      value={values.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="Enter email address"
                      autoComplete="email"
                    />
                  </Field>
                  <Field id="phone" label="Phone Number" error={errors.phone} required>
                    <Input
                      id="phone"
                      type="tel"
                      value={values.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="(954) 123-4567"
                      autoComplete="tel"
                    />
                  </Field>
                  <Field id="preferredContact" label="Preferred Contact Method">
                    <Select
                      value={values.preferredContact}
                      onValueChange={(v) => set("preferredContact", v)}
                    >
                      <SelectTrigger id="preferredContact">
                        <SelectValue placeholder="Email" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field id="projectName" label="Project Name" error={errors.projectName} required>
                    <Input
                      id="projectName"
                      value={values.projectName}
                      onChange={(e) => set("projectName", e.target.value)}
                      placeholder="Enter project name"
                    />
                  </Field>
                  <Field
                    id="projectAddress"
                    label="Project Address"
                    error={errors.projectAddress}
                    required
                  >
                    <Input
                      id="projectAddress"
                      value={values.projectAddress}
                      onChange={(e) => set("projectAddress", e.target.value)}
                      placeholder="Enter project address"
                      autoComplete="street-address"
                    />
                  </Field>
                </div>

                <div className="grid gap-5 md:grid-cols-4">
                  <Field id="city" label="City" error={errors.city} required>
                    <Input
                      id="city"
                      value={values.city}
                      onChange={(e) => set("city", e.target.value)}
                      placeholder="Enter city"
                    />
                  </Field>
                  <Field id="county" label="County">
                    <Select value={values.county} onValueChange={(v) => set("county", v)}>
                      <SelectTrigger id="county">
                        <SelectValue placeholder="Select county" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTIES.map((county) => (
                          <SelectItem key={county} value={county}>
                            {county}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field id="state" label="State" error={errors.state} required>
                    <Input
                      id="state"
                      value={values.state}
                      onChange={(e) => set("state", e.target.value)}
                      placeholder="Florida"
                    />
                  </Field>
                  <Field id="zipCode" label="ZIP Code">
                    <Input
                      id="zipCode"
                      value={values.zipCode}
                      onChange={(e) => set("zipCode", e.target.value)}
                      placeholder="Enter ZIP code"
                      autoComplete="postal-code"
                    />
                  </Field>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <Field id="projectType" label="Project Type" error={errors.projectType} required>
                    <Select value={values.projectType} onValueChange={(v) => set("projectType", v)}>
                      <SelectTrigger id="projectType">
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field id="productInterest" label="Product Interest">
                    <Select
                      value={values.productInterest}
                      onValueChange={(v) => set("productInterest", v)}
                    >
                      <SelectTrigger id="productInterest">
                        <SelectValue placeholder="Select product interest" />
                      </SelectTrigger>
                      <SelectContent>
                        {FAMILIES.map((family) => (
                          <SelectItem key={family.id} value={family.registeredName}>
                            {family.registeredName}
                          </SelectItem>
                        ))}
                        <SelectItem value="Not sure yet">Not sure yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field id="quantities" label="Quantity / Approx. Units">
                    <Input
                      id="quantities"
                      value={values.quantities}
                      onChange={(e) => set("quantities", e.target.value)}
                      placeholder="Enter quantity"
                    />
                  </Field>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field id="deadline" label="Desired Deadline">
                    <Input
                      id="deadline"
                      type="date"
                      value={values.deadline}
                      onChange={(e) => set("deadline", e.target.value)}
                    />
                  </Field>
                  <Field id="budgetRange" label="Budget Range">
                    <Select value={values.budgetRange} onValueChange={(v) => set("budgetRange", v)}>
                      <SelectTrigger id="budgetRange">
                        <SelectValue placeholder="Select budget range" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_RANGES.map((range) => (
                          <SelectItem key={range} value={range}>
                            {range}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field
                  id="message"
                  label="Project Details / Additional Information"
                  error={errors.message}
                  required
                >
                  <Textarea
                    id="message"
                    rows={5}
                    value={values.message}
                    onChange={(e) => set("message", e.target.value)}
                    placeholder="Tell us more about your project, design preferences, performance requirements, or any other details that will help us provide an accurate quote."
                  />
                </Field>

                <div className="space-y-3">
                  <QuoteDocumentUpload
                    draftToken={draftToken}
                    onChange={setDocuments}
                    disabled={mutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consent"
                      checked={values.consent}
                      onCheckedChange={(v) => set("consent", v === true)}
                    />
                    <Label htmlFor="consent" className="text-sm font-normal leading-relaxed">
                      I consent to have this website store my submitted information so they can
                      respond to my inquiry. Please review our{" "}
                      <span className="font-medium text-workspace-blue">Privacy Policy</span> for
                      more details.
                    </Label>
                  </div>
                  {errors.consent ? (
                    <p className="text-sm text-destructive">{errors.consent}</p>
                  ) : null}
                </div>

                {mutation.isError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    We couldn&apos;t submit your request. Please try again or call us directly.
                  </p>
                ) : null}

                <Button type="submit" size="lg" disabled={mutation.isPending}>
                  {mutation.isPending ? "Submitting…" : "Submit Request"}
                </Button>
              </form>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-lg bg-navy p-7 text-navy-foreground shadow-elevated">
              <div className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy-soft">
                  <Phone className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl text-navy-foreground">Get in Touch</h2>
                  <p className="mt-2 text-sm leading-relaxed text-navy-foreground/75">
                    We&apos;re here to help with your project. Reach out to our team using any of
                    the methods below.
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-4 text-sm">
                <li className="flex items-center gap-3">
                  <Phone className="size-4 text-bronze" aria-hidden="true" />
                  <a href="tel:+13528875667" className="hover:text-bronze">
                    (352) 887-5667
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="size-4 text-bronze" aria-hidden="true" />
                  <a href="mailto:info@awm.llc" className="hover:text-bronze">
                    info@awm.llc
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <Clock className="size-4 text-bronze" aria-hidden="true" />
                  Mon – Fri: 7:30 AM – 5:00 PM EST
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-7 shadow-card">
              <div className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy text-navy-foreground">
                  <MapPin className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl text-navy">Our Office</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    AWM LLC
                    <br />
                    9997 S Orange Blossom Trl
                    <br />
                    Orlando, FL 32837
                  </p>
                </div>
              </div>
              <div className="mt-5 overflow-hidden rounded-md border border-border bg-navy p-6 text-center">
                <p className="text-sm font-medium text-white">
                  9997 S Orange Blossom Trl, Orlando, FL 32837
                </p>
                <Button asChild variant="secondary" size="sm" className="mt-4">
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=9997+S+Orange+Blossom+Trl+Orlando+FL+32837"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Get Directions
                  </a>
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
              <ShieldCheck className="mt-1 size-6 shrink-0 text-brand-red" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-navy">Authorized YKK AP Distributor</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  AWM LLC supplies YKK AP residential windows &amp; patio doors across Florida.
                  Engineered for Florida impact. Built for Florida living.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </SiteLayout>
  );
}
