import type { Metadata } from "next";
import "../../prepaid-purchase-20260828.css";
import { PaymentReturn } from "../../../components/PrepaidPurchaseFlow";

export const metadata: Metadata = {
  title: "Pagamento | LENOY IMOBILIÁRIAS",
  description: "Acompanhe a confirmação do seu pagamento e o envio do link de ativação.",
};

export default function PaymentReturnPage(){ return <PaymentReturn/>; }
