import { createFileRoute } from "@tanstack/react-router";
import { FamilyPage } from "@/components/site/FamilyPage";
import { getFamily } from "@/data/products";

const family = getFamily("styleview");

export const Route = createFileRoute("/products/styleview")({
  head: () => ({
    meta: [
      { title: "StyleView® Premium Vinyl Windows & Doors | AWM LLC" },
      {
        name: "description",
        content:
          "StyleView® premium vinyl windows and patio doors for Florida new construction, supplied by AWM LLC with frame, J-channel, and flange options.",
      },
      { property: "og:title", content: "StyleView® Premium Vinyl Windows & Doors | AWM LLC" },
      {
        property: "og:description",
        content:
          "Premium vinyl window and patio door configurations for new-construction openings in Florida.",
      },
    ],
  }),
  component: () => <FamilyPage family={family} />,
});
