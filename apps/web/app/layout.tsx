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
import "./tenant-premium-v4.css";
import "./product-polish-v4.css";
import "./admin-premium-v4.css";
import "./experience-premium-v4.css";
import "./platform-final.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imoveis.lenoy.com.br";
const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";
const allowIndexing = ["true", "1", "yes", "on"].includes(String(process.env.NEXT_PUBLIC_ALLOW_INDEXING || "").toLowerCase());

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LENOY IMOBILIÁRIAS | Plataforma para imobiliárias",
    template: "%s | LENOY IMOBILIÁRIAS",
  },
  description: "Plataforma SaaS para imobiliárias com site próprio, catálogo de imóveis, corretores, leads, domínio personalizado e recursos de inteligência artificial.",
  keywords: ["imobiliária", "site para imobiliária", "sistema imobiliário", "imóveis", "corretores", "leads", "SaaS imobiliário"],
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: lenoyLogo, type: "image/png" }],
    shortcut: [{ url: lenoyLogo, type: "image/png" }],
    apple: [{ url: lenoyLogo }],
  },
  openGraph: {
    title: "LENOY IMOBILIÁRIAS",
    description: "Plataforma completa para imobiliárias criarem seu site, publicarem imóveis e gerenciarem equipe e contatos.",
    type: "website",
    locale: "pt_BR",
    url: "/",
    images: [{ url: lenoyLogo, width: 512, height: 512, alt: "LENOY IMOBILIÁRIAS" }],
  },
  robots: allowIndexing
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
