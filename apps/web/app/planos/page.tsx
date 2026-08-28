import type { Metadata } from "next";
import PublicPlansCatalog from "../../components/PublicPlansCatalog";
import "../plans-standalone-20260828.css";

export const metadata: Metadata = {
  title: "Planos e preços",
  description: "Compare os planos LENOY IMOBILIÁRIAS e escolha a melhor opção para sua operação.",
};

export default function PlansPage() {
  return <main className="standalonePlansPage">
    <header className="platformTopbar standalonePlansTopbar"><div className="container platformNav"><a className="brand" href="/"><img src="/lenoy-imobiliarias-logo-20260826.png" alt="LENOY IMOBILIÁRIAS" /></a><nav aria-label="Navegação principal"><a href="/demonstracao/">Demonstração</a><a href="/demonstracao/painel/">Painel</a><a href="/demonstracao/aplicativo/">Aplicativo</a><a className="active" href="/planos/">Planos</a></nav><div className="platformActions"><a className="button secondary" href="/login/">Entrar</a><a className="button primary" href="/demonstracao/">Ver demonstração</a></div></div></header>
    <section className="standalonePlansHero"><span>PLANOS E PREÇOS</span><h1>Escolha o plano ideal para sua imobiliária.</h1><p>Escolha mensal ou anual e vá direto ao pagamento. A configuração da imobiliária acontece somente depois que a InfinitePay confirmar a compra.</p></section>
    <PublicPlansCatalog />
    <footer className="standalonePlansFooter"><strong>LENOY IMOBILIÁRIAS</strong><span>Escolha o plano, pague e receba por e-mail o link para configurar sua imobiliária.</span></footer>
  </main>;
}
