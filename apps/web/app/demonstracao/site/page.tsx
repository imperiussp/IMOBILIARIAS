import type { Metadata } from "next";
import { DemoClientSite } from "../../../components/DemoClientShowcase";

export const metadata: Metadata = {
  title: "Site modelo da imobiliária | LENOY IMOBILIÁRIAS",
  description: "Veja um site completo de imobiliária com imóveis fictícios antes de contratar.",
  alternates: { canonical: "/demonstracao/site/" },
};

export default function DemoSitePage() {
  return <DemoClientSite />;
}
