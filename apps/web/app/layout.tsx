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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://imperiussp.github.io/IMOBILIARIAS";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "IMOBILIARIAS | Venda e locação de imóveis",
    template: "%s | IMOBILIARIAS",
  },
  description: "Encontre imóveis para venda e locação com filtros por cidade, bairro, tipo, finalidade, zona, preço e características.",
  keywords: ["imóveis", "imobiliária", "casas", "apartamentos", "venda", "locação", "imóveis rurais", "imóveis comerciais"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "IMOBILIARIAS",
    description: "Busca de imóveis para venda e locação com atendimento direto ao corretor.",
    type: "website",
    locale: "pt_BR",
    url: "/",
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
