import type { Metadata } from "next";
import { DemoAppReplica } from "../../../components/DemoProductReplica";
import "../../demo-product-replica-20260828.css";

export const metadata: Metadata = {
  title: "Aplicativo modelo do corretor | LENOY IMOBILIÁRIAS",
  description: "Veja a demonstração do aplicativo do corretor antes de contratar.",
  alternates: { canonical: "/demonstracao/aplicativo/" },
};

export default function DemoAppPage() {
  return <DemoAppReplica />;
}
