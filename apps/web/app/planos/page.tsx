import type { Metadata } from "next";
import "../plans-standalone-20260828.css";

export const metadata: Metadata = {
  title: "Planos e preços",
  description: "Compare os planos LENOY IMOBILIÁRIAS e escolha a melhor opção para sua operação.",
};

type Plan = {
  code: string;
  name: string;
  monthly: string;
  annual: string;
  implementation: string;
  featured?: boolean;
  summary: string;
  items: string[];
};

const plans: Plan[] = [
  { code:"inicial", name:"Inicial", monthly:"39,90", annual:"359,10", implementation:"99,00", summary:"Para o corretor começar com site, CRM e aplicativo.", items:["Até 100 imóveis","1 usuário","Site exclusivo","CRM imobiliário","Aplicativo do corretor"] },
  { code:"profissional", name:"Profissional", monthly:"59,90", annual:"539,10", implementation:"149,00", featured:true, summary:"Para quem precisa de mais capacidade e gestão comercial.", items:["Até 500 imóveis","Até 3 usuários","Site exclusivo","CRM imobiliário","Aplicativo do corretor","Gestão comercial ampliada"] },
  { code:"imobiliaria", name:"Imobiliária", monthly:"79,90", annual:"719,10", implementation:"199,00", summary:"Para equipes que querem IA, documentos e operação maior.", items:["Até 1.500 imóveis","Até 7 usuários","Site exclusivo","CRM imobiliário","Aplicativo do corretor","IA de oportunidades","Central de documentos"] },
  { code:"premium", name:"Premium", monthly:"110,00", annual:"990,00", implementation:"249,00", summary:"Para operações maiores com domínio próprio e automações.", items:["Até 5.000 imóveis","Até 15 usuários","Site exclusivo","CRM imobiliário","Aplicativo do corretor","IA de oportunidades","Central de documentos","Domínio próprio","Automações"] },
];

const compareRows = [
  ["Imóveis","100","500","1.500","5.000"],["Usuários","1","3","7","15"],["Site exclusivo","✓","✓","✓","✓"],["CRM imobiliário","✓","✓","✓","✓"],["Aplicativo do corretor","✓","✓","✓","✓"],["Gestão comercial ampliada","—","✓","✓","✓"],["IA de oportunidades","—","—","✓","✓"],["Central de documentos","—","—","✓","✓"],["Domínio próprio","—","—","—","✓"],["Automações","—","—","—","✓"],["Implantação no mensal","R$ 99","R$ 149","R$ 199","R$ 249"],["Implantação no anual","Grátis","Grátis","Grátis","Grátis"],["Desconto no anual","25%","25%","25%","25%"],
];

export default function PlansPage() {
  return <main className="standalonePlansPage">
    <header className="platformTopbar standalonePlansTopbar"><div className="container platformNav"><a className="brand" href="/"><img src="/lenoy-imobiliarias-logo-20260826.png" alt="LENOY IMOBILIÁRIAS" /></a><nav aria-label="Navegação principal"><a href="/demonstracao/">Demonstração</a><a href="/demonstracao/painel/">Painel</a><a href="/demonstracao/aplicativo/">Aplicativo</a><a className="active" href="/planos/">Planos</a></nav><div className="platformActions"><a className="button secondary" href="/login/">Entrar</a><a className="button primary" href="/demonstracao/">Ver demonstração</a></div></div></header>
    <section className="standalonePlansHero"><span>PLANOS E PREÇOS</span><h1>Escolha o plano ideal para sua imobiliária.</h1><p>Escolha mensal ou anual e vá direto ao pagamento. A configuração da imobiliária acontece somente depois que a InfinitePay confirmar a compra.</p></section>
    <section className="standalonePlansGrid" aria-label="Planos disponíveis">{plans.map(plan=><article key={plan.code} className={`standalonePlanCard ${plan.featured?"featured":""}`}>{plan.featured?<span className="standalonePlanBadge">MAIS ESCOLHIDO</span>:<span className="standalonePlanTag">PLANO</span>}<h2>{plan.name}</h2><p className="standalonePlanSummary">{plan.summary}</p><div className="standalonePriceMain"><strong>R$ {plan.monthly}</strong><span>/mês</span></div><div className="standaloneCycleBox"><div><small>MENSAL</small><b>R$ {plan.monthly}/mês</b><span>Primeiro pagamento: implantação de R$ {plan.implementation}</span></div><a href={`/contratar/?plano=${plan.code}&ciclo=monthly`}>Contratar mensal</a></div><div className="standaloneCycleBox annual"><div><small>ANUAL · 25% OFF</small><b>R$ {plan.annual}/ano</b><span>Implantação grátis</span></div><a href={`/contratar/?plano=${plan.code}&ciclo=annual`}>Contratar anual</a></div><div className="standalonePlanFeatures">{plan.items.map(item=><span key={item}>✓ {item}</span>)}</div></article>)}</section>
    <div className="standaloneCompareJump"><a href="#comparativo">Comparar todos os planos</a></div>
    <section id="comparativo" className="standaloneCompareSection"><div className="standaloneCompareHeading"><span>COMPARATIVO</span><h2>Compare recurso por recurso.</h2><p>Escolha a coluna do plano que atende melhor sua operação e siga para o pagamento.</p></div><div className="standaloneCompareScroller"><table className="standaloneCompareTable"><thead><tr><th>Recurso</th>{plans.map(plan=><th key={plan.code}>{plan.name}</th>)}</tr></thead><tbody>{compareRows.map(row=><tr key={row[0]}><td>{row[0]}</td>{row.slice(1).map((value,index)=><td key={`${row[0]}-${index}`}>{value}</td>)}</tr>)}</tbody><tfoot><tr><td>Contratar</td>{plans.map(plan=><td key={plan.code}><a href={`/contratar/?plano=${plan.code}&ciclo=monthly`}>Escolher {plan.name}</a></td>)}</tr></tfoot></table></div></section>
    <footer className="standalonePlansFooter"><strong>LENOY IMOBILIÁRIAS</strong><span>Escolha o plano, pague e receba por e-mail o link para configurar sua imobiliária.</span></footer>
  </main>;
}
