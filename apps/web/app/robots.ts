import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imperiussp.github.io/IMOBILIARIAS";
const basePath = new URL(siteUrl).pathname.replace(/\/$/, "");
const privatePaths = ["admin", "login", "cadastro", "recuperar-senha", "nova-senha", "primeiro-acesso"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: `${basePath || ""}/`,
      disallow: privatePaths.map((path) => `${basePath}/${path}/`),
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
