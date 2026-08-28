import type { Metadata } from "next";
import { DemoClientApp } from "../../../components/DemoClientShowcase";

export const metadata: Metadata = {
  title: "Aplicativo modelo do corretor | LENOY IMOBILIÁRIAS",
  description: "Veja a demonstração do aplicativo do corretor antes de contratar.",
  alternates: { canonical: "/demonstracao/aplicativo/" },
};

export default function DemoAppPage() {
  return <DemoClientApp />;
}
