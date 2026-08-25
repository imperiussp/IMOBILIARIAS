import type { Metadata } from "next";
import AppDownloadPanel from "../../components/AppDownloadPanel";

export const metadata: Metadata = {
  title: "Baixar aplicativo",
  description: "Baixe o aplicativo Android da LENOY Imobiliárias ou adicione o acesso à Tela de Início no iPhone.",
};

export default function BaixarAppPage() {
  return <AppDownloadPanel />;
}
