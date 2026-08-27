import type { Metadata } from "next";
import AdminUiEnhancer from "../components/AdminUiEnhancer";
import AdminMobileMenu from "../components/AdminMobileMenu";
import AdminCatalogTypeFilter from "../components/AdminCatalogTypeFilter";
import AdminSidebarActiveTracker from "../components/AdminSidebarActiveTracker";
import UserDeviceAccessGuard from "../components/UserDeviceAccessGuard";
import WebNotificationBellMount from "../components/WebNotificationBellMount";
import AdminThemeBridge from "../components/AdminThemeBridge";
import AdminHighlightsPanelMount from "../components/AdminHighlightsPanelMount";
import PublicFeaturedPropertiesMount from "../components/PublicFeaturedPropertiesMount";
import AdminContactsPanelMount from "../components/AdminContactsPanelMount";
import PreserveCurrentFixesMount from "../components/PreserveCurrentFixesMount";
import OwnerPropertyReviewMount from "../components/OwnerPropertyReviewMount";
import OwnerPropertyReviewEnhancer from "../components/OwnerPropertyReviewEnhancer";
import AdminCatalogPhotosMount from "../components/AdminCatalogPhotosMount";
import AppPropertyCatalogEnhancer from "../components/AppPropertyCatalogEnhancer";
import AdminDirectPropertyInterests from "../components/AdminDirectPropertyInterests";
import saasHeroBgChunk1 from "../lib/saasHeroBgChunk1";
import saasHeroBgChunk2 from "../lib/saasHeroBgChunk2";
import saasHeroBgChunk3 from "../lib/saasHeroBgChunk3";
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
import "./menu-cards-20260826.css";
import "./release-corrections-20260826.css";
import "./admin-tenant-header-20260826.css";
import "./admin-card-visibility-20260826.css";
import "./tenant-admin-highlights-20260826.css";
import "./crm-contacts-20260826.css";
import "./admin-catalog-photos-20260827.css";
import "./admin-width-photo-notification-20260827.css";
import "./admin-property-cards-final-20260827.css";
import "./admin-mobile-layout-final-20260827.css";
import "./admin-mobile-card-unnesting-20260827.css";
import "./admin-final-batch-20260827.css";
import "./admin-mobile-followup-final-20260827.css";
import "./app-property-catalog-final-20260827.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imoveis.lenoy.com.br";
const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";
const allowIndexing = ["true", "1", "yes", "on"].includes(String(process.env.NEXT_PUBLIC_ALLOW_INDEXING || "").toLowerCase());
const saasHeroBackground = `data:image/webp;base64,${saasHeroBgChunk1}${saasHeroBgChunk2}${saasHeroBgChunk3}`;
const saasHeroServerCss = `
@media (min-width:701px){
  html body .platformLanding .platformHero{
    background:#061322 url("${saasHeroBackground}") center center / cover no-repeat !important;
  }
  html body .platformLanding .platformHero::before,
  html body .platformLanding .platformHero::after{
    content:none !important;
    display:none !important;
  }
}`;

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
      <body><style dangerouslySetInnerHTML={{ __html: saasHeroServerCss }} />{children}<AdminUiEnhancer /><AdminMobileMenu /><AdminCatalogTypeFilter /><AdminSidebarActiveTracker /><UserDeviceAccessGuard /><WebNotificationBellMount /><AdminThemeBridge /><AdminHighlightsPanelMount /><PublicFeaturedPropertiesMount /><AdminContactsPanelMount /><OwnerPropertyReviewMount /><OwnerPropertyReviewEnhancer /><AdminCatalogPhotosMount /><PreserveCurrentFixesMount /><AppPropertyCatalogEnhancer /><AdminDirectPropertyInterests /></body>
    </html>
  );
}
