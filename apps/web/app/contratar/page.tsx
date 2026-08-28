import type { Metadata } from "next";
import "../prepaid-purchase-20260828.css";
import { PrepaidCheckout } from "../../components/PrepaidPurchaseFlow";

export const metadata: Metadata = {
  title: "Contratar | LENOY IMOBILIÁRIAS",
  description: "Conclua o pagamento do plano escolhido antes de configurar sua imobiliária.",
};

export default function ContratarPage(){ return <PrepaidCheckout/>; }
