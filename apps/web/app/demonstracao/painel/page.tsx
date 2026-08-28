import type { Metadata } from "next";
import { DemoClientPanel } from "../../../components/DemoClientShowcase";
import "../../demo-panel-readable-20260828.css";

export const metadata: Metadata = {
  title: "Painel modelo do corretor | LENOY IMOBILIÁRIAS",
  description: "Veja o painel do corretor com dados fictícios antes de contratar.",
  alternates: { canonical: "/demonstracao/painel/" },
};

export default function DemoPanelPage() {
  return <DemoClientPanel />;
}
