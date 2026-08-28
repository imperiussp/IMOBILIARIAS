import type { Metadata } from "next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import AppInterestedWhatsAppEnhancer from "../components/AppInterestedWhatsAppEnhancer";
import AdminHeroBackgroundEditorMount from "../components/AdminHeroBackgroundEditorMount";
import TenantHeroBackgroundMount from "../components/TenantHeroBackgroundMount";
import PublicPricingEnhancer from "../components/PublicPricingEnhancer";
import DemoLinkHardFix from "../components/DemoLinkHardFix";
import DemoLocationPrivacyEnhancer from "../components/DemoLocationPrivacyEnhancer";
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
import "./app-interested-whatsapp-20260827.css";
import "./tenant-hero-background-20260827.css";
import "./billing-access-20260827.css";
import "./platform-commercial-20260827.css";
import "./demo-tour-20260828.css";
import "./demo-client-product-20260828.css";
import "./demo-purchase-cta-20260828.css";
import "./demo-app-menu-fix-20260828.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imoveis.lenoy.com.br";
const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";
const allowIndexing = ["true", "1", "yes", "on"].includes(String(process.env.NEXT_PUBLIC_ALLOW_INDEXING || "").toLowerCase());

const heroAssetCandidates = [
  join(process.cwd(), "public", "platform-hero-home-final.webp"),
  join(process.cwd(), "apps", "web", "public", "platform-hero-home-final.webp"),
];
const heroAssetPath = heroAssetCandidates.find((candidate) => existsSync(candidate));
if (!heroAssetPath) {
  throw new Error("Imagem protegida da home de vendas não encontrada: platform-hero-home-final.webp");
}
const saasHeroBackground = `data:image/webp;base64,${readFileSync(heroAssetPath).toString("base64")}`;

const saasHeroServerCss = `
:root{
  --lenoy-approved-platform-hero:url("${saasHeroBackground}");
}
@media (min-width:701px){
  html body .platformLanding.platformLanding.platformLanding .platformHero.platformHero.platformHero{
    background-color:#061322 !important;
    background-image:var(--lenoy-approved-platform-hero) !important;
    background-repeat:no-repeat !important;
    background-position:center center !important;
    background-size:cover !important;
  }
  html body .platformLanding.platformLanding.platformLanding .platformHero.platformHero.platformHero::before,
  html body .platformLanding.platformLanding.platformLanding .platformHero.platformHero.platformHero::after{
    content:none !important;
    display:none !important;
  }
}
@media (min-width:1100px){
  html body .platformLanding.platformLanding.platformLanding .platformHero.platformHero.platformHero{
    background-position:right center !important;
    background-size:auto 100% !important;
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
      <body><style dangerouslySetInnerHTML={{ __html: saasHeroServerCss }} />{children}<AdminUiEnhancer /><AdminMobileMenu /><AdminCatalogTypeFilter /><AdminSidebarActiveTracker /><UserDeviceAccessGuard /><WebNotificationBellMount /><AdminThemeBridge /><AdminHighlightsPanelMount /><PublicFeaturedPropertiesMount /><AdminContactsPanelMount /><OwnerPropertyReviewMount /><OwnerPropertyReviewEnhancer /><AdminCatalogPhotosMount /><PreserveCurrentFixesMount /><AppPropertyCatalogEnhancer /><AdminDirectPropertyInterests /><AppInterestedWhatsAppEnhancer /><AdminHeroBackgroundEditorMount /><TenantHeroBackgroundMount /><PublicPricingEnhancer /><DemoLinkHardFix /><DemoLocationPrivacyEnhancer /></body>
    </html>
  );
}