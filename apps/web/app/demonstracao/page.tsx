import type { Metadata } from "next";
import { DemoHub } from "../../components/DemoClientShowcase";

export const metadata: Metadata = {
  title: "Demonstração | LENOY IMOBILIÁRIAS",
  description: "Veja separadamente o painel, o site da imobiliária e o aplicativo antes de contratar.",
  alternates: { canonical: "/demonstracao/" },
};

export default function DemonstracaoPage() {
  return <DemoHub />;
}
