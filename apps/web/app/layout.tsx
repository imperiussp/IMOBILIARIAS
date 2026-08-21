import type { Metadata } from "next";
import "./globals.css";
import "./property.css";
import "./admin.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://imperiussp.github.io/IMOBILIARIAS/"),
  title: {
    default: "IMOBILIARIAS | Venda e locação de imóveis",
    template: "%s | IMOBILIARIAS",
  },
  description: "Encontre imóveis para comprar ou alugar com filtros por cidade, bairro, tipo, uso residencial ou comercial e zona urbana ou rural.",
  applicationName: "IMOBILIARIAS",
  keywords: ["imóveis", "imobiliária", "venda", "locação", "casas", "apartamentos", "terrenos", "imóveis rurais"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "IMOBILIARIAS",
    title: "IMOBILIARIAS | Venda e locação de imóveis",
    description: "Busca simples, catálogo completo e contato direto com o corretor responsável.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
