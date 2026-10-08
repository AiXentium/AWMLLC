import { createFileRoute } from "@tanstack/react-router";
import { FamilyPage } from "@/components/site/FamilyPage";
import { getFamily } from "@/data/products";

const family = getFamily("precedence");

export const Route = createFileRoute("/products/precedence")({
  head: () => ({
    meta: [
      { title: "Precedence® Replacement Windows | AWM LLC" },
      {
        name: "description",
        content:
          "Precedence® replacement windows for Florida remodel and retrofit projects, supplied by AWM LLC with field-measure coordination.",
      },
      { property: "og:title", content: "Precedence® Replacement Windows | AWM LLC" },
      {
        property: "og:description",
        content: "Replacement window configurations for remodel and retrofit work in Florida.",
      },
    ],
  }),
  component: () => <FamilyPage family={family} />,
});
