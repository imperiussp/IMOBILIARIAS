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
  implementationFree?: boolean;
  featured?: boolean;
  summary: string;
  items: string[];
};

const plans: Plan[] = [
  { code:"inicial", name:"Start", monthly:"39,90", annual:"359,10", implementation:"99,00", summary:"Para começar com a estrutura essencial da imobiliária.", items:["Até 30 imóveis","1 usuário","2 acessos simultâneos","1 e-mail profissional","5 fotos por imóvel","Site exclusivo","Catálogo de imóveis","CRM com funil de vendas","Leads via site e portais","WhatsApp flutuante no site","Site otimizado para SEO"] },
  { code:"profissional", name:"Pro", monthly:"59,90", annual:"539,10", implementation:"99,00", featured:true, summary:"Para quem precisa de gestão completa e mais capacidade.", items:["Até 400 imóveis","Até 3 usuários","6 acessos simultâneos","3 e-mails profissionais","50 fotos por imóvel","Tudo do Start","Gestão completa","Aplicativo do corretor","CRM imobiliário completo","Controle de chaves","Controle de propostas","Vistorias","Agenda e visitas","IA para descrições"] },
  { code:"imobiliaria", name:"Business", monthly:"79,90", annual:"719,10", implementation:"100,00", summary:"Para equipes com operação comercial, documentos e inteligência artificial.", items:["Até 1.000 imóveis","Até 5 usuários","10 acessos simultâneos","5 e-mails profissionais","50 fotos por imóvel","Tudo do Pro","IA de oportunidades","Central de documentos","Gestão de vendas","Gestão de clientes","Permissões por usuário","Relatórios estratégicos","Reserva avançada de leads"] },
  { code:"premium", name:"Prime", monthly:"110,00", annual:"990,00", implementation:"Grátis", implementationFree:true, summary:"Para operações maiores com domínio próprio, equipes e automações avançadas.", items:["Até 3.000 imóveis","Até 10 usuários","20 acessos simultâneos","10 e-mails profissionais","50 fotos por imóvel","Tudo do Business","Domínio próprio","Gestão multi-equipe","Maior capacidade de IA","Prioridade operacional","Recursos avançados de automação"] },
];

const compareRows = [
  ["Imóveis","30","400","1.000","3.000"],
  ["Usuários","1","3","5","10"],
  ["Acessos simultâneos","2","6","10","20"],
  ["E-mails profissionais","1","3","5","10"],
  ["Fotos por imóvel","5","50","50","50"],
  ["Portais imobiliários","✓","✓","✓","✓"],
  ["Facebook Lead Ads","—","✓","✓","✓"],
  ["WhatsApp no site","✓","✓","✓","✓"],
  ["Domínio próprio","—","—","—","✓"],
  ["Site exclusivo","✓","✓","✓","✓"],
  ["Gestão completa","—","✓","✓","✓"],
  ["Aplicativo do corretor","—","✓","✓","✓"],
  ["CRM imobiliário","Básico","Completo","Completo","Completo"],
  ["Gestão de clientes","✓","✓","✓","✓"],
  ["Gestão de vendas","—","✓","✓","✓"],
  ["Controle de chaves","—","✓","✓","✓"],
  ["Controle de propostas","—","✓","✓","✓"],
  ["Agenda e visitas","—","✓","✓","✓"],
  ["Vistorias","—","✓","✓","✓"],
  ["Reserva avançada de leads","—","—","✓","✓"],
  ["Permissões por usuário","—","—","✓","✓"],
  ["Relatórios estratégicos","—","—","✓","✓"],
  ["Central de documentos","—","—","✓","✓"],
  ["Gestão multi-equipe","—","—","—","✓"],
  ["Descrições com IA","5/mês","15/mês","30/mês","50/mês"],
  ["IA de oportunidades","—","—","✓","✓"],
  ["Matching comprador × imóvel","—","—","✓","✓"],
  ["Contato automático com consentimento","—","—","✓","✓"],
  ["Implantação no mensal","R$ 99","R$ 99","R$ 100","Grátis"],
  ["Implantação no anual","Grátis","Grátis","Grátis","Grátis"],
  ["Desconto no anual","25%","25%","25%","25%"],
];

export default function PlansPage() {
  return <main className="standalonePlansPage">
    <header className="platformTopbar standalonePlansTopbar"><div className="container platformNav"><a className="brand" href="/"><img src="/lenoy-imobiliarias-logo-20260826.png" alt="LENOY IMOBILIÁRIAS" /></a><nav aria-label="Navegação principal"><a href="/demonstracao/">Demonstração</a><a href="/demonstracao/painel/">Painel</a><a href="/demonstracao/aplicativo/">Aplicativo</a><a className="active" href="/planos/">Planos</a></nav><div className="platformActions"><a className="button secondary" href="/login/">Entrar</a><a className="button primary" href="/demonstracao/">Ver demonstração</a></div></div></header>
    <section className="standalonePlansHero"><span>PLANOS E PREÇOS</span><h1>Escolha o plano ideal para sua imobiliária.</h1><p>Escolha mensal ou anual e vá direto ao pagamento. A configuração da imobiliária acontece somente depois que a InfinitePay confirmar a compra.</p></section>
    <section className="standalonePlansGrid" aria-label="Planos disponíveis">{plans.map(plan=><article key={plan.code} className={`standalonePlanCard ${plan.featured?"featured":""}`}>{plan.featured?<span className="standalonePlanBadge">MAIS ESCOLHIDO</span>:<span className="standalonePlanTag">PLANO</span>}<h2>{plan.name}</h2><p className="standalonePlanSummary">{plan.summary}</p><div className="standalonePriceMain"><strong>R$ {plan.monthly}</strong><span>/mês</span></div><div className="standaloneCycleBox"><div><small>MENSAL</small><b>R$ {plan.monthly}/mês</b>{plan.implementationFree?<span>Implantação grátis</span>:<span>Primeiro pagamento: implantação de R$ {plan.implementation}</span>}</div><a href={`/contratar/?plano=${plan.code}&ciclo=monthly`}>Contratar mensal</a></div><div className="standaloneCycleBox annual"><div><small>ANUAL · 25% OFF</small><b>R$ {plan.annual}/ano</b><span>Implantação grátis</span></div><a href={`/contratar/?plano=${plan.code}&ciclo=annual`}>Contratar anual</a></div><div className="standalonePlanFeatures">{plan.items.map(item=><span key={item}>✓ {item}</span>)}</div></article>)}</section>
    <div className="standaloneCompareJump"><a href="#comparativo">Comparar todos os planos</a></div>
    <section id="comparativo" className="standaloneCompareSection"><div className="standaloneCompareHeading"><span>COMPARATIVO</span><h2>Compare recurso por recurso.</h2><p>Escolha a coluna do plano que atende melhor sua operação e siga para o pagamento.</p></div><div className="standaloneCompareScroller"><table className="standaloneCompareTable"><thead><tr><th>Recurso</th>{plans.map(plan=><th key={plan.code}>{plan.name}</th>)}</tr></thead><tbody>{compareRows.map(row=><tr key={row[0]}><td>{row[0]}</td>{row.slice(1).map((value,index)=><td key={`${row[0]}-${index}`}>{value}</td>)}</tr>)}</tbody><tfoot><tr><td>Contratar</td>{plans.map(plan=><td key={plan.code}><a href={`/contratar/?plano=${plan.code}&ciclo=monthly`}>Escolher {plan.name}</a></td>)}</tr></tfoot></table></div></section>
    <footer className="standalonePlansFooter"><strong>LENOY IMOBILIÁRIAS</strong><span>Escolha o plano, pague e receba por e-mail o link para configurar sua imobiliária.</span></footer>
  </main>;
}
