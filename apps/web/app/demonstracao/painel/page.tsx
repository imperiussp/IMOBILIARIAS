import type { Metadata } from "next";
import { DemoClientPanel } from "../../../components/DemoClientShowcase";

export const metadata: Metadata = {
  title: "Painel modelo do corretor | LENOY IMOBILIÁRIAS",
  description: "Veja o painel do corretor com dados fictícios antes de contratar.",
  alternates: { canonical: "/demonstracao/painel/" },
};

export default function DemoPanelPage() {
  return <DemoClientPanel />;
}
