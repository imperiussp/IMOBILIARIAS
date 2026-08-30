import PlatformPublicReleaseNotice from "./PlatformPublicReleaseNotice";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

const demoRows = [
  { buyer: "Marina Souza", property: "IM-1042 · Casa com 3 quartos", match: "94%", channel: "WhatsApp", status: "Em revisão" },
  { buyer: "Carlos Mendes", property: "IM-0931 · Apartamento central", match: "89%", channel: "E-mail", status: "Aprovada" },
  { buyer: "Ana Lima", property: "IM-1188 · Sobrado residencial", match: "87%", channel: "WhatsApp", status: "Enviada" },
];

const appProperties = [
  { code: "IM-1210", title: "Casa residencial", detail: "3 quartos · 2 vagas", status: "Publicado" },
  { code: "IM-1208", title: "Apartamento central", detail: "2 quartos · 1 suíte", status: "Rascunho" },
  { code: "IM-1202", title: "Sala comercial", detail: "Centro · 82 m²", status: "Publicado" },
];

const planBenefits = [
  "Site exclusivo",
  "Catálogo de imóveis",
  "Leads via site e portais",
  "Portais imobiliários",
  "Facebook Lead Ads",
  "WhatsApp flutuante no site",
  "Site otimizado para SEO",
  "CRM com funil de vendas",
  "CRM imobiliário completo",
  "Gestão completa",
  "Gestão de clientes",
  "Gestão de vendas",
  "Aplicativo do corretor",
  "Controle de chaves",
  "Controle de propostas",
  "Agenda e visitas",
  "Vistorias",
  "IA para descrições",
  "Reserva avançada de leads",
  "Permissões por usuário",
  "Relatórios estratégicos",
  "Central de documentos",
  "IA de oportunidades",
  "Matching comprador × imóvel",
  "Contato automático com consentimento",
  "Domínio próprio",
  "Gestão multi-equipe",
  "Maior capacidade de IA",
  "Prioridade operacional",
  "Recursos avançados de automação",
];

const plans = [
  { name:"Start", featured:false, limits:["Até 30 imóveis","1 usuário","2 acessos simultâneos","1 e-mail profissional","5 fotos por imóvel"], features:["Site exclusivo","Catálogo de imóveis","Leads via site e portais","Portais imobiliários","WhatsApp flutuante no site","Site otimizado para SEO","CRM com funil de vendas","Gestão de clientes","IA para descrições"] },
  { name:"Pro", featured:true, limits:["Até 400 imóveis","Até 3 usuários","6 acessos simultâneos","3 e-mails profissionais","50 fotos por imóvel"], features:["Site exclusivo","Catálogo de imóveis","Leads via site e portais","Portais imobiliários","Facebook Lead Ads","WhatsApp flutuante no site","Site otimizado para SEO","CRM com funil de vendas","CRM imobiliário completo","Gestão completa","Gestão de clientes","Gestão de vendas","Aplicativo do corretor","Controle de chaves","Controle de propostas","Agenda e visitas","Vistorias","IA para descrições"] },
  { name:"Business", featured:false, limits:["Até 1.000 imóveis","Até 5 usuários","10 acessos simultâneos","5 e-mails profissionais","50 fotos por imóvel"], features:["Site exclusivo","Catálogo de imóveis","Leads via site e portais","Portais imobiliários","Facebook Lead Ads","WhatsApp flutuante no site","Site otimizado para SEO","CRM com funil de vendas","CRM imobiliário completo","Gestão completa","Gestão de clientes","Gestão de vendas","Aplicativo do corretor","Controle de chaves","Controle de propostas","Agenda e visitas","Vistorias","IA para descrições","Reserva avançada de leads","Permissões por usuário","Relatórios estratégicos","Central de documentos","IA de oportunidades","Matching comprador × imóvel","Contato automático com consentimento"] },
  { name:"Prime", featured:false, limits:["Até 3.000 imóveis","Até 10 usuários","20 acessos simultâneos","10 e-mails profissionais","50 fotos por imóvel"], features:["Site exclusivo","Catálogo de imóveis","Leads via site e portais","Portais imobiliários","Facebook Lead Ads","WhatsApp flutuante no site","Site otimizado para SEO","CRM com funil de vendas","CRM imobiliário completo","Gestão completa","Gestão de clientes","Gestão de vendas","Aplicativo do corretor","Controle de chaves","Controle de propostas","Agenda e visitas","Vistorias","IA para descrições","Reserva avançada de leads","Permissões por usuário","Relatórios estratégicos","Central de documentos","IA de oportunidades","Matching comprador × imóvel","Contato automático com consentimento","Domínio próprio","Gestão multi-equipe","Maior capacidade de IA","Prioridade operacional","Recursos avançados de automação"] },
];

const comparisonGroups = [
  { title:"Estrutura", rows:[
    ["Imóveis","30","400","1.000","3.000"],
    ["Usuários","1","3","5","10"],
    ["Acessos simultâneos","2","6","10","20"],
    ["E-mails profissionais","1","3","5","10"],
    ["Fotos por imóvel","5","50","50","50"],
  ]},
  { title:"Integrações", rows:[
    ["Portais imobiliários","✓","✓","✓","✓"],
    ["Facebook Lead Ads","—","✓","✓","✓"],
    ["WhatsApp no site","✓","✓","✓","✓"],
    ["Domínio próprio","—","—","—","✓"],
  ]},
  { title:"Recursos incluídos", rows:[
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
  ]},
  { title:"IA e automação", rows:[
    ["Descrições com IA","5/mês","15/mês","30/mês","50/mês"],
    ["IA de oportunidades","—","—","✓","✓"],
    ["Matching comprador × imóvel","—","—","✓","✓"],
    ["Contato automático com consentimento","—","—","✓","✓"],
  ]},
];

function Mark({value}:{value:string}){return <span className={value==="✓"?"check":value==="—"?"dash":""}>{value}</span>}

export default function PlatformLanding() {
  return (
    <main className="platformLanding">
      <header className="platformTopbar"><div className="container platformNav"><a className="brand" href="./"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" style={{ width: 112, maxWidth: "28vw", height: "auto", display: "block" }} /></a><nav><a href="#recursos">Recursos</a><a href="#painel-demo">Painel</a><a href="#app-demo">Aplicativo</a><a href="#planos">Planos</a></nav><div className="platformActions"><a className="button secondary" href="login/">Entrar</a><a className="button primary" href="cadastro/">Criar imobiliária</a></div></div></header>
      <PlatformPublicReleaseNotice />

      <section className="container section platformHero"><div><span className="eyebrow">PLATAFORMA SaaS PARA IMOBILIÁRIAS</span><h1>Seu site, seus imóveis, sua equipe. Tudo em um só lugar.</h1><p>Crie a imobiliária, personalize a marca, publique imóveis, organize corretores e leads e use um endereço exclusivo dentro da LENOY ou seu próprio domínio.</p><div className="platformHeroActions"><a className="button primary" href="cadastro/">Começar agora</a><a className="button secondary" href="#painel-demo">Ver nova versão visual</a></div><div className="platformTrustLine"><span>Site próprio</span><span>CRM</span><span>Aplicativo do corretor</span><span>IA comercial</span></div></div><div className="platformHeroCard"><div className="platformHeroCardTop"><div><span>AMBIENTE DA IMOBILIÁRIA</span><strong>João Imobiliária</strong></div><span className="platformOnlineDot">● Online</span></div><div className="platformMiniGrid"><article><small>Imóveis</small><b>42</b></article><article><small>Leads</small><b>18</b></article><article><small>Corretores</small><b>4</b></article><article><small>Oportunidades</small><b>9</b></article></div><div className="platformHeroStatus"><span>IA comercial</span><b>7 oportunidades ativas</b></div><div className="platformHeroActivity"><span>Agora</span><p><b>Marina Souza</b> respondeu sobre o imóvel IM-1042</p></div></div></section>

      <section className="platformStrip"><div className="container platformStripGrid"><article><strong>1 plataforma</strong><span>para site, CRM, equipe e operação</span></article><article><strong>Multi-imobiliária</strong><span>cada cliente com ambiente isolado</span></article><article><strong>Domínio próprio</strong><span>ou subdomínio dentro da LENOY</span></article><article><strong>Offline</strong><span>cadastro de fotos pelo app mesmo sem sinal</span></article></div></section>

      <section className="softSection" id="recursos"><div className="container section"><div className="sectionHeading"><div><span className="eyebrow">RECURSOS</span><h2>Uma plataforma para operar a imobiliária inteira.</h2></div></div><div className="trustGrid"><article><strong>Site exclusivo</strong><p>Marca, cores, contatos e catálogo próprios para cada cliente.</p></article><article><strong>Gestão completa</strong><p>Imóveis, corretores, equipe, leads, visitas, documentos, domínios e histórico em um único painel.</p></article><article><strong>Aplicativo do corretor</strong><p>Cadastro e fotos pelo celular com estrutura de sincronização offline.</p></article><article><strong>IA de oportunidades</strong><p>Identifica imóveis compatíveis e prepara contatos personalizados.</p></article><article><strong>CRM imobiliário</strong><p>Funil, retornos, histórico do cliente, visitas e desempenho comercial.</p></article><article><strong>Central de documentos</strong><p>Modelos, versões, anexos privados e checklist documental por imóvel.</p></article></div></div></section>

      <section className="container section" id="painel-demo"><div className="sectionHeading"><div><span className="eyebrow">NOVA VERSÃO VISUAL</span><h2>Painel comercial com leitura rápida do que precisa de atenção.</h2><p className="sectionIntro">Visual demonstrativo com dados fictícios para mostrar a direção atual do produto.</p></div><span className="demoBadge">DEMONSTRAÇÃO</span></div><div className="demoDashboard"><div className="demoSidebar"><div><small>IMOBILIÁRIA</small><strong>João Imobiliária</strong></div><a className="active" href="#painel-demo">Visão geral</a><a href="#painel-demo">Imóveis</a><a href="#painel-demo">CRM</a><a href="#painel-demo">Visitas</a><a href="#painel-demo">Oportunidades IA</a><a href="#painel-demo">Documentos</a><a href="#painel-demo">Equipe</a></div><div className="demoContent"><div className="demoTopline"><div><span className="eyebrow">VISÃO COMERCIAL</span><h3>Oportunidades IA</h3><p>Compatibilidade, contato e retorno do comprador em uma única leitura.</p></div><span className="demoLive">● Operação ativa</span></div><div className="demoMetricGrid"><article><small>Contatos no mês</small><strong>38 / 120</strong><span>32% do limite</span></article><article><small>Taxa de resposta</small><strong>47%</strong><span>+8% vs. mês anterior</span></article><article><small>Sinais de interesse</small><strong>11</strong><span>5 pediram detalhes</span></article><article><small>Pedidos de visita</small><strong>4</strong><span>2 para hoje</span></article></div><div className="demoFlow"><article><span>01</span><strong>24</strong><small>Detectadas</small></article><i>→</i><article><span>02</span><strong>9</strong><small>Em revisão</small></article><i>→</i><article><span>03</span><strong>6</strong><small>Aprovadas</small></article><i>→</i><article><span>04</span><strong>15</strong><small>Enviadas</small></article></div><div className="demoTableCard"><div className="demoTableHeader"><div><strong>Compradores com imóvel compatível</strong><span>Filtrar: Todas</span></div></div><div className="demoTable"><div className="demoTableRow demoTableHead"><span>Comprador</span><span>Imóvel</span><span>Match</span><span>Canal</span><span>Situação</span></div>{demoRows.map(row=><div className="demoTableRow" key={row.buyer}><span><b>{row.buyer}</b></span><span>{row.property}</span><span><b>{row.match}</b></span><span>{row.channel}</span><span><em>{row.status}</em></span></div>)}</div></div><div className="demoInsightGrid"><article><span>HORÁRIO SILENCIOSO</span><strong>Livre</strong><small>Envios permitidos neste momento</small></article><article><span>CONSENTIMENTO</span><strong>100%</strong><small>Somente contatos autorizados entram no envio</small></article><article><span>RETORNOS</span><strong>6 novos</strong><small>Incluindo interesse, detalhes e visita</small></article></div></div></div></section>

      <section className="softSection" id="app-demo"><div className="container section appShowcase"><div className="appShowcaseCopy"><span className="eyebrow">APLICATIVO DO CORRETOR</span><h2>Do imóvel visitado ao anúncio, direto pelo celular.</h2><p>O corretor cadastra o imóvel, tira fotos, organiza a sequência e publica no ambiente correto da imobiliária. Sem internet, a fila fica preparada para sincronizar quando o sinal voltar.</p><div className="appFeatureList"><article><b>01</b><div><strong>Fotografe</strong><span>Câmera ou galeria, com organização das imagens.</span></div></article><article><b>02</b><div><strong>Cadastre</strong><span>Dados, descrição, preço, finalidade e responsável.</span></div></article><article><b>03</b><div><strong>Sincronize</strong><span>Fila offline separada por imobiliária e imóvel.</span></div></article></div></div><div className="phoneStage"><div className="phoneMock"><div className="phoneTop"><span>9:41</span><b>LENOY IMOBILIÁRIAS</b><span>•••</span></div><div className="phoneScreen"><div className="phoneWelcome"><span className="eyebrow">CORRETOR</span><strong>Olá, Rafael</strong><small>3 imóveis recentes</small></div><button type="button" className="phonePrimary">＋ Cadastrar novo imóvel</button><div className="phoneStatus"><span>Fila offline</span><b>1 aguardando sincronização</b></div><div className="phonePropertyList">{appProperties.map(item=><article key={item.code}><div className="phoneThumb">⌂</div><div><small>{item.code}</small><strong>{item.title}</strong><span>{item.detail}</span></div><em>{item.status}</em></article>)}</div><div className="phoneNav"><span>⌂<small>Início</small></span><span>▦<small>Imóveis</small></span><span className="active">＋<small>Novo</small></span><span>◉<small>Leads</small></span></div></div></div><div className="phoneFloatingCard"><span>✓</span><div><strong>Imóvel salvo offline</strong><small>Será enviado quando houver conexão.</small></div></div></div></div></section>

      <section className="container section"><div className="sectionHeading"><div><span className="eyebrow">OPERAÇÃO EM UM RELANCE</span><h2>Informação útil antes de virar problema.</h2></div></div><div className="operationsGrid"><article><span>VISITAS DE HOJE</span><strong>6</strong><p>2 aguardando confirmação do cliente.</p></article><article><span>LEADS SEM RETORNO</span><strong>3</strong><p>Contatos que ultrapassaram o prazo interno.</p></article><article><span>IMÓVEIS INCOMPLETOS</span><strong>5</strong><p>Anúncios com dados ou documentos pendentes.</p></article><article><span>CONVERSÃO</span><strong>18%</strong><p>Leads ganhos em relação aos atendidos.</p></article></div></section>

      <section className="container section" id="como-funciona"><div className="sectionHeading"><div><span className="eyebrow">COMECE EM POUCOS PASSOS</span><h2>Do cadastro ao site da imobiliária.</h2></div></div><div className="steps"><article><span>01</span><h3>Crie a conta</h3><p>Informe os dados da imobiliária e escolha seu endereço na plataforma.</p></article><article><span>02</span><h3>Personalize</h3><p>Cadastre logo, cores, CRECI, WhatsApp e os dados comerciais.</p></article><article><span>03</span><h3>Publique e acompanhe</h3><p>Cadastre imóveis, receba contatos, acompanhe oportunidades e organize o atendimento da equipe.</p></article></div></section>

      <section className="softSection" id="planos"><div className="container section"><div className="sectionHeading"><div><span className="eyebrow">PLANOS</span><h2>Escolha a estrutura certa para sua imobiliária.</h2><p className="sectionIntro">Os recursos do plano e do comparativo usam a mesma estrutura. Valores permanecem a definir antes do lançamento.</p></div><div className="plansIntroActions"><a className="button secondary" href="#comparativo-planos">Comparar planos</a></div></div><div className="plansLegend"><span>✓ Incluído</span><span>– Não incluído</span><span>Limites podem ser ajustados no painel da plataforma</span></div><div className="plansGrid">{plans.map(plan=><article className={`planCard ${plan.featured?"featured":""}`} key={plan.name}>{plan.featured?<span className="planTag">MAIS EQUILIBRADO</span>:<span className="planTag">PLANO LENOY</span>}<h3>{plan.name}</h3><div className="planPrice"><strong>Preço a definir</strong><span>mensalidade configurável</span></div><div className="planLimits">{plan.limits.map(item=><span key={item}>{item}</span>)}</div><div className="planFeatureList">{planBenefits.map(item=><span className={plan.features.includes(item)?"yes":"no"} key={item}>{item}</span>)}</div><a className={`button ${plan.featured?"secondary":"primary"}`} href="cadastro/">Começar</a></article>)}</div>
      <div className="planCompareWrap" id="comparativo-planos"><table className="planCompare"><thead><tr><th>Comparativo completo</th><th>Start</th><th>Pro</th><th>Business</th><th>Prime</th></tr></thead><tbody>{comparisonGroups.map(group=><FragmentGroup key={group.title} title={group.title} rows={group.rows}/>)}</tbody></table></div><p className="planCompareNote">O comparativo inclui estrutura, integrações, operação, CRM, documentos e inteligência artificial. Os limites comerciais finais ainda podem ser ajustados antes do lançamento.</p></div></section>

      <footer className="container section platformFooter"><div><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" style={{ width: 110, height: "auto", display: "block" }} /><p>Plataforma para imobiliárias.</p></div><div><a href="login/">Entrar</a> · <a href="cadastro/">Criar conta</a></div></footer>
    </main>
  );
}

function FragmentGroup({title,rows}:{title:string;rows:string[][]}){
  return <>{<tr className="group"><td colSpan={5}>{title}</td></tr>}{rows.map(row=><tr key={`${title}-${row[0]}`}><td>{row[0]}</td>{row.slice(1).map((value,index)=><td key={`${row[0]}-${index}`}><Mark value={value}/></td>)}</tr>)}</>;
}