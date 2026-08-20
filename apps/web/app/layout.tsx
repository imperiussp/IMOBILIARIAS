import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMOBILIARIAS",
  description: "Plataforma imobiliária para venda e locação de imóveis.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
