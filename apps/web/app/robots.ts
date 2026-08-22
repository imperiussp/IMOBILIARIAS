import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imperiussp.github.io/IMOBILIARIAS";
const basePath = new URL(siteUrl).pathname.replace(/\/$/, "");
const privatePaths = ["admin", "plataforma", "login", "cadastro", "convite", "recuperar-senha", "nova-senha", "primeiro-acesso"];
const allowIndexing = ["true", "1", "yes", "on"].includes(String(process.env.NEXT_PUBLIC_ALLOW_INDEXING || "").toLowerCase());

export default function robots(): MetadataRoute.Robots {
  if (!allowIndexing) {
    return {
      rules: { userAgent: "*", disallow: `${basePath || ""}/` },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: `${basePath || ""}/`,
      disallow: privatePaths.map((path) => `${basePath}/${path}/`),
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
