import type { Metadata } from "next";
import "../prepaid-purchase-20260828.css";
import { PrepaidOnboarding } from "../../components/PrepaidPurchaseFlow";

export const metadata: Metadata = {
  title: "Ativar imobiliária | LENOY IMOBILIÁRIAS",
  description: "Configure sua imobiliária depois que o pagamento for confirmado.",
};

export default function ActivateAgencyPage(){ return <PrepaidOnboarding/>; }
