import type { Metadata } from "next";
import AdminUiEnhancer from "../components/AdminUiEnhancer";
import AdminMobileMenu from "../components/AdminMobileMenu";
import AdminCatalogTypeFilter from "../components/AdminCatalogTypeFilter";
import AdminSidebarActiveTracker from "../components/AdminSidebarActiveTracker";
import UserDeviceAccessGuard from "../components/UserDeviceAccessGuard";
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
import "./landing-hotfix.css";
import "./landing-enhancements.css";
import "./admin-final-fixes.css";
import "./admin-location-final.css";
import "./landing-mobile-final.css";
import "./registration-final.css";
import "./release-fixes-20260824.css";
import "./app-download.css";
import "./landing-refresh-20260825.css";
import "./admin-polish-20260825.css";
import "./hotfix-20260825.css";
import "./tenant-theme.css";
import "./hero-app-bg-20260825.css";
import "./refinement-20260826.css";
import "./refinement-20260826b.css";
import "./hero-background-final-20260826.css";
import "./platform-batch-corrections-20260826.css";
import "./admin-dashboard-cards-20260826.css";
import "./admin-dashboard-hardfix-20260826.css";

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
      <body>{children}<AdminUiEnhancer /><AdminMobileMenu /><AdminCatalogTypeFilter /><AdminSidebarActiveTracker /><UserDeviceAccessGuard /></body>
    </html>
  );
}
