import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero, Section } from "@/components/site/Section";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | AWM LLC" },
      {
        name: "description",
        content: "How AWM LLC collects, uses, and protects your information.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        intro="How AWM LLC collects, uses, and protects your information."
      />
      <Section>
        <div className="prose-legal max-w-3xl">
          <p className="text-sm text-muted-foreground">Last updated: October 5, 2026</p>

          <h2>Information we collect</h2>
          <p>
            When you request a quote or contact us, we collect the information you provide —
            typically your name, company, phone number, email address, project address, and any
            project details or blueprint files you share. We use this information solely to prepare
            your quote and communicate about your project.
          </p>

          <h2>How we use your information</h2>
          <ul>
            <li>To prepare and deliver window and patio door quotes</li>
            <li>To communicate about your project, order status, and delivery</li>
            <li>To improve our products and services</li>
          </ul>
          <p>
            We do not sell, rent, or share your personal information with third parties for
            marketing purposes.
          </p>

          <h2>Project files and blueprints</h2>
          <p>
            Blueprint and plan files you upload are used only for takeoff and quoting purposes. We
            treat your project documents as confidential and do not distribute them beyond what is
            needed to fulfill your request.
          </p>

          <h2>Cookies and analytics</h2>
          <p>
            This site may use basic analytics to understand visitor traffic. We do not use
            advertising trackers or sell browsing data.
          </p>

          <h2>Data security</h2>
          <p>
            We take reasonable measures to protect your information from unauthorized access,
            alteration, or disclosure. No method of internet transmission is completely secure, and
            we cannot guarantee absolute security.
          </p>

          <h2>Your rights</h2>
          <p>
            You may request a copy of the personal information we hold about you, ask us to correct
            it, or ask us to delete it by contacting us at{" "}
            <a href="mailto:info@awm.llc" className="text-bronze underline underline-offset-4">
              info@awm.llc
            </a>
            .
          </p>

          <h2>Contact</h2>
          <p>
            AWM LLC
            <br />
            9997 S Orange Blossom Trl
            <br />
            Orlando, FL 32837
            <br />
            <a href="mailto:info@awm.llc" className="text-bronze underline underline-offset-4">
              info@awm.llc
            </a>
            <br />
            <a href="tel:+13528875667" className="text-bronze underline underline-offset-4">
              (352) 887-5667
            </a>
          </p>
        </div>
      </Section>
    </SiteLayout>
  );
}
