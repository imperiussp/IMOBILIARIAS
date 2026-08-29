import type { Metadata } from "next";
import DemoBrokerSiteEnhanced from "../../../components/DemoBrokerSiteEnhanced";
import "../../demo-broker-site-original-20260828.css";
import "../../property-detail-gallery-20260829.css";

export const metadata: Metadata = {
  title: "Site modelo da imobiliária | LENOY IMOBILIÁRIAS",
  description: "Veja um site completo de imobiliária com imóveis fictícios antes de contratar.",
  alternates: { canonical: "/demonstracao/site/" },
};

export default function DemoSitePage() {
  return <DemoBrokerSiteEnhanced />;
}
