import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imperiussp.github.io/IMOBILIARIAS";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login/", "/cadastro/", "/recuperar-senha/", "/nova-senha/", "/primeiro-acesso/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
