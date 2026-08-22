import type { Metadata } from "next";
import "./globals.css";
import "./property.css";
import "./admin.css";
import "./explorer.css";
import "./admin-tools.css";
import "./detail-enhancements.css";
import "./admin-extra.css";
import "./access.css";
import "./branding.css";
import "./contact.css";
import "./platform.css";
import "./platform-showcase.css";
import "./platform-plans.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imoveis.lenoy.com.br";
const assetBase = process.env.GITHUB_ACTIONS === "true" ? "/IMOBILIARIAS" : "";
const lenoyLogo = `${assetBase}/logo-lenoy.svg`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LENOY IMÓVEIS | Plataforma para imobiliárias",
    template: "%s | LENOY IMÓVEIS",
  },
  description: "Plataforma SaaS para imobiliárias com site próprio, catálogo de imóveis, corretores, leads, domínio personalizado e recursos de inteligência artificial.",
  keywords: ["imobiliária", "site para imobiliária", "sistema imobiliário", "imóveis", "corretores", "leads", "SaaS imobiliário"],
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: lenoyLogo, type: "image/svg+xml" }],
    shortcut: [{ url: lenoyLogo, type: "image/svg+xml" }],
    apple: [{ url: lenoyLogo }],
  },
  openGraph: {
    title: "LENOY IMÓVEIS",
    description: "Plataforma completa para imobiliárias criarem seu site, publicarem imóveis e gerenciarem equipe e contatos.",
    type: "website",
    locale: "pt_BR",
    url: "/",
    images: [{ url: lenoyLogo, width: 256, height: 256, alt: "LENOY" }],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
