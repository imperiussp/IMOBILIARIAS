import type { MetadataRoute } from "next";
import { properties } from "../lib/properties";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imperiussp.github.io/IMOBILIARIAS";
const allowIndexing = ["true", "1", "yes", "on"].includes(String(process.env.NEXT_PUBLIC_ALLOW_INDEXING || "").toLowerCase());

export default function sitemap(): MetadataRoute.Sitemap {
  if (!allowIndexing) return [];

  const propertyEntries: MetadataRoute.Sitemap = properties.map((property) => ({
    url: `${siteUrl}/imovel/${property.slug}/`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: `${siteUrl}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    ...propertyEntries,
  ];
}
