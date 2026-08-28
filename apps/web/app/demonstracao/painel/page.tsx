import type { Metadata } from "next";
import { DemoPanelReplica } from "../../../components/DemoProductReplica";
import "../../demo-product-replica-20260828.css";

export const metadata: Metadata = {
  title: "Painel modelo do corretor | LENOY IMOBILIÁRIAS",
  description: "Veja o painel do corretor com dados fictícios antes de contratar.",
  alternates: { canonical: "/demonstracao/painel/" },
};

export default function DemoPanelPage() {
  return <DemoPanelReplica />;
}
