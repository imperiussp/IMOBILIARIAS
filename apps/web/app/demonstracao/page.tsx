import type { Metadata } from "next";
import DemoTour from "../../components/DemoTour";

export const metadata: Metadata = {
  title: "Demonstração | LENOY IMOBILIÁRIAS",
  description: "Conheça o painel, o site e o aplicativo da LENOY Imobiliárias antes de contratar.",
  alternates: { canonical: "/demonstracao/" },
};

export default function DemonstracaoPage() {
  return <DemoTour />;
}
