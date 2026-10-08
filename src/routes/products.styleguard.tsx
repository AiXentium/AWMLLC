import { createFileRoute } from "@tanstack/react-router";
import { FamilyPage } from "@/components/site/FamilyPage";
import { getFamily } from "@/data/products";

const family = getFamily("styleguard");

export const Route = createFileRoute("/products/styleguard")({
  head: () => ({
    meta: [
      { title: "StyleGuard® Impact-Resistant Windows & Patio Doors | AWM LLC" },
      {
        name: "description",
        content:
          "StyleGuard® impact-resistant windows and patio doors for coastal and high-wind Florida applications, supplied by AWM LLC with manufacturer-confirmed configurations.",
      },
      {
        property: "og:title",
        content: "StyleGuard® Impact-Resistant Windows & Patio Doors | AWM LLC",
      },
      {
        property: "og:description",
        content:
          "Impact-resistant window and patio door configurations for coastal Florida projects.",
      },
    ],
  }),
  component: () => <FamilyPage family={family} />,
});
