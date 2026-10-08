import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { PageHero, Section } from "@/components/site/Section";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service & Disclaimer | AWM LLC" },
      {
        name: "description",
        content: "Terms of service and product disclaimer for AWM LLC.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Legal"
        title="Terms of Service & Disclaimer"
        intro="The terms governing your use of this site and our services."
      />
      <Section>
        <div className="prose-legal max-w-3xl">
          <p className="text-sm text-muted-foreground">Last updated: October 5, 2026</p>

          <h2>About AWM LLC</h2>
          <p>
            AWM LLC is an independent authorized distributor of YKK AP residential windows and patio
            doors. AWM LLC is not a manufacturer of YKK AP products and is not affiliated with YKK
            AP America Inc. beyond its authorized distributor relationship.
          </p>

          <h2>Product information disclaimer</h2>
          <p>
            Product descriptions, specifications, sizes, colors, and performance ratings shown on
            this site are based on manufacturer-published information and are provided for general
            reference only. Specifications are subject to change by the manufacturer without notice.
            Final product selections, pricing, and availability are confirmed in writing at the time
            of order.
          </p>
          <p>
            Florida Product Approval numbers referenced on this site should be independently
            verified at{" "}
            <a
              href="https://www.floridabuilding.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-bronze underline underline-offset-4"
            >
              floridabuilding.org
            </a>{" "}
            for your specific application and jurisdiction.
          </p>

          <h2>Quotes and pricing</h2>
          <p>
            All quotes are estimates based on the information provided and are valid for the period
            stated on the quote. Pricing is subject to confirmation of final measurements,
            configurations, and manufacturer availability. A quote does not constitute a contract
            until accepted in writing by both parties.
          </p>

          <h2>Website use</h2>
          <p>
            Product images and catalog photography are provided courtesy of YKK AP America Inc. and
            remain the property of their respective owners. You may not reproduce site content
            without written permission.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, AWM LLC shall not be liable for any indirect,
            incidental, or consequential damages arising from the use of this site or reliance on
            its content. Product warranties, where applicable, are provided by the manufacturer
            under their published warranty terms.
          </p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of the State of Florida. Any disputes shall be
            resolved in the courts of Orange County, Florida.
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
