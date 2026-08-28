"use client";

import { useMemo, useState } from "react";

type DemoProperty = {
  id: number;
  type: "Casa" | "Apartamento" | "Terreno";
  purpose: "Comprar" | "Alugar";
  title: string;
  location: string;
  price: string;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  area: string;
  description: string;
  image: string;
};

type PanelSection = "Visão geral" | "Imóveis" | "Desempenho" | "Qualidade" | "Documentos";
type AppScreen = "Início" | "Imóveis" | "Novo imóvel" | "Contatos / CRM" | "Acompanhamentos" | "Oportunidades" | "Visitas";

const properties: DemoProperty[] = [
  {
    id: 1,
    type: "Casa",
    purpose: "Comprar",
    title: "Casa contemporânea com suíte e espaço gourmet",
    location: "Jardim Europa · Curitiba/PR",
    price: "R$ 780.000",
    bedrooms: 3,
    bathrooms: 3,
    garages: 2,
    area: "186 m²",
    description: "Residência moderna com ambientes integrados, suíte ampla, cozinha planejada, churrasqueira coberta e quintal ensolarado.",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=82",
  },
  {
    id: 2,
    type: "Apartamento",
    purpose: "Comprar",
    title: "Apartamento central com varanda e vista aberta",
    location: "Centro · Ponta Grossa/PR",
    price: "R$ 465.000",
    bedrooms: 2,
    bathrooms: 2,
    garages: 1,
    area: "91 m²",
    description: "Apartamento iluminado, sala integrada à varanda, suíte, cozinha funcional e uma vaga coberta em condomínio completo.",
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=82",
  },
  {
    id: 3,
    type: "Casa",
    purpose: "Alugar",
    title: "Sobrado residencial com quintal e escritório",
    location: "Vila Nova · Sengés/PR",
    price: "R$ 2.850/mês",
    bedrooms: 4,
    bathrooms: 3,
    garages: 2,
    area: "212 m²",
    description: "Sobrado espaçoso com escritório no térreo, quatro dormitórios, área externa privativa e garagem para dois veículos.",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=82",
  },
  {
    id: 4,
    type: "Terreno",
    purpose: "Comprar",
    title: "Terreno plano em bairro residencial consolidado",
    location: "Jardim Primavera · Sengés/PR",
    price: "R$ 148.000",
    bedrooms: null,
    bathrooms: null,
    garages: null,
    area: "360 m²",
    description: "Lote plano, rua pavimentada, redes de água e energia disponíveis e excelente posição para residência ou investimento.",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=82",
  },
  {
    id: 5,
    type: "Casa",
    purpose: "Comprar",
    title: "Casa térrea com piscina e área de lazer",
    location: "Boa Vista · Itararé/SP",
    price: "R$ 635.000",
    bedrooms: 3,
    bathrooms: 2,
    garages: 3,
    area: "174 m²",
    description: "Casa térrea com três dormitórios, cozinha integrada, piscina, churrasqueira e garagem ampla para receber a família com conforto.",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=82",
  },
  {
    id: 6,
    type: "Terreno",
    purpose: "Comprar",
    title: "Terreno amplo para chácara ou projeto residencial",
    location: "Zona de expansão · Jaguariaíva/PR",
    price: "R$ 215.000",
    bedrooms: null,
    bathrooms: null,
    garages: null,
    area: "1.250 m²",
    description: "Área com ótima topografia, frente larga, acesso facilitado e espaço para residência, lazer, pomar ou pequeno empreendimento.",
    image: "https://images.unsplash.com/photo-1473445361085-b9a07f55608b?auto=format&fit=crop&w=1200&q=82",
  },
];

function DemoHeader({ active }: { active: "hub" | "painel" | "site" | "aplicativo" }) {
  return (
    <header className="clientDemoTopbar">
      <a className="clientDemoBrand" href="/demonstracao/">
        <img src="/lenoy-imobiliarias-logo-20260826.png" alt="LENOY Imobiliárias" />
        <span>Demonstração</span>
      </a>
      <nav aria-label="Demonstrações">
        <a className={active === "painel" ? "active" : ""} href="/demonstracao/painel/">Painel</a>
        <a className={active === "site" ? "active" : ""} href="/demonstracao/site/">Site</a>
        <a className={active === "aplicativo" ? "active" : ""} href="/demonstracao/aplicativo/">Aplicativo</a>
      </nav>
      <a className="clientDemoPlanButton" href="/#planos">Ver planos e contratar</a>
    </header>
  );
}

function SafeDemoNotice({ text }: { text: string }) {
  if (!text) return null;
  return <div role="status" style={{ margin: "12px 0", padding: "10px 12px", borderRadius: 10, background: "#fff4d6", color: "#5d4712", fontWeight: 700 }}>{text}</div>;
}

export function DemoHub() {
  return (
    <main className="clientDemoPage clientDemoHubPage">
      <DemoHeader active="hub" />
      <section className="clientDemoHubHero">
        <span>VEJA ANTES DE CONTRATAR</span>
        <h1>Conheça exatamente o que sua imobiliária vai receber.</h1>
        <p>Escolha uma demonstração. O site, o painel e o aplicativo são navegáveis, usam somente dados fictícios e não enviam, gravam ou cadastram nenhuma informação.</p>
      </section>
      <section className="clientDemoChoiceGrid">
        <a href="/demonstracao/painel/" className="clientDemoChoiceCard panelChoice">
          <span>01</span><strong>Painel do corretor</strong><p>Navegue por visão geral, imóveis, desempenho, qualidade e documentos.</p><b>Abrir painel demo →</b>
        </a>
        <a href="/demonstracao/site/" className="clientDemoChoiceCard siteChoice">
          <span>02</span><strong>Site da imobiliária</strong><p>Navegue pelo site, filtre imóveis e abra os detalhes dos anúncios.</p><b>Abrir site demo →</b>
        </a>
        <a href="/demonstracao/aplicativo/" className="clientDemoChoiceCard appChoice">
          <span>03</span><strong>Aplicativo</strong><p>Navegue por imóveis, CRM, visitas, oportunidades e cadastro simulado.</p><b>Abrir aplicativo demo →</b>
        </a>
      </section>
      <section className="clientDemoHubBottom"><div><strong>Demonstração segura</strong><span>Todas as informações são fictícias. Nenhuma ação envia mensagem, grava dados ou cria cadastro.</span></div><a href="/#planos">Ver planos e contratar</a></section>
    </main>
  );
}

export function DemoClientSite() {
  const [filter, setFilter] = useState<"Todos" | "Comprar" | "Alugar" | "Terreno">("Todos");
  const [selected, setSelected] = useState<DemoProperty | null>(null);
  const [notice, setNotice] = useState("");
  const visible = useMemo(() => properties.filter((item) => {
    if (filter === "Todos") return true;
    if (filter === "Terreno") return item.type === "Terreno";
    return item.purpose === filter;
  }), [filter]);

  return (
    <main className="clientDemoPage clientSiteDemoPage">
      <DemoHeader active="site" />
      <div className="clientDemoContextBar"><div><span>SITE DEMO NAVEGÁVEL</span><strong>Explore o site normalmente. Contatos e envios estão desativados.</strong></div><a href="/#planos">Ver planos e contratar</a></div>

      <section className="brokerSiteFrame">
        <header className="brokerSiteHeader">
          <a href="#inicio" className="brokerSiteLogo"><span>AV</span><div><strong>Alameda Imóveis</strong><small>CRECI 12345-F · Imobiliária modelo</small></div></a>
          <nav><a href="#inicio">Início</a><a href="#imoveis">Imóveis</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></nav>
          <button type="button" className="brokerWhatsButton" onClick={() => setNotice("Demonstração: o WhatsApp está desativado e nenhuma mensagem foi enviada.")}>WhatsApp</button>
        </header>
        <SafeDemoNotice text={notice} />

        <section id="inicio" className="brokerSiteHero">
          <div className="brokerHeroOverlay" />
          <div className="brokerHeroContent"><span>ENCONTRE SEU PRÓXIMO LUGAR</span><h1>Imóveis selecionados para morar, investir e construir.</h1><p>Uma apresentação profissional da sua carteira, com busca simples, informações completas e contato direto com a imobiliária.</p>
            <div className="brokerSearchBox"><button className={filter === "Comprar" ? "active" : ""} onClick={() => setFilter("Comprar")}>Comprar</button><button className={filter === "Alugar" ? "active" : ""} onClick={() => setFilter("Alugar")}>Alugar</button><button className={filter === "Terreno" ? "active" : ""} onClick={() => setFilter("Terreno")}>Terrenos</button><button className={filter === "Todos" ? "active" : ""} onClick={() => setFilter("Todos")}>Todos</button></div>
          </div>
        </section>

        <section id="imoveis" className="brokerPropertySection">
          <div className="brokerSectionHeading"><div><span>IMÓVEIS</span><h2>Imóveis em destaque</h2><p>{visible.length} opções no modelo demonstrativo</p></div><div className="brokerFilterPill">Filtro: <strong>{filter}</strong></div></div>
          <div className="brokerPropertyGrid">
            {visible.map((item) => (
              <article className="brokerPropertyCard" key={item.id}>
                <button className="brokerPropertyImage" type="button" onClick={() => setSelected(item)} aria-label={`Ver detalhes de ${item.title}`}>
                  <img src={item.image} alt={item.title} />
                  <span>{item.type}</span><em>{item.purpose}</em>
                </button>
                <div className="brokerPropertyBody"><small>{item.location}</small><h3>{item.title}</h3><strong>{item.price}</strong><div className="brokerPropertyMeta">{item.bedrooms !== null ? <span>🛏 {item.bedrooms} quartos</span> : null}{item.bathrooms !== null ? <span>🚿 {item.bathrooms} banheiros</span> : null}{item.garages !== null ? <span>🚗 {item.garages} vagas</span> : null}<span>▱ {item.area}</span></div><p>{item.description}</p><div className="brokerPropertyActions"><button type="button" onClick={() => setSelected(item)}>Ver detalhes</button><button type="button" onClick={() => setNotice("Demonstração: o interesse foi apenas simulado. Nenhum contato foi enviado.")}>Tenho interesse</button></div></div>
              </article>
            ))}
          </div>
        </section>

        <section id="sobre" className="brokerAboutSection"><div><span>SOBRE A IMOBILIÁRIA</span><h2>Atendimento próximo e imóveis bem apresentados.</h2><p>Este bloco demonstra como a história, os diferenciais, o CRECI, os canais de atendimento e a identidade da imobiliária aparecem para o comprador.</p></div><div className="brokerAboutStats"><article><strong>12 anos</strong><span>de atuação</span></article><article><strong>86</strong><span>imóveis ativos</span></article><article><strong>4,9</strong><span>avaliação média</span></article></div></section>

        <section id="contato" className="brokerContactSection"><div><span>FALE COM A GENTE</span><h2>Encontrou um imóvel interessante?</h2><p>No site real, os contatos chegam diretamente à imobiliária e entram no CRM. Nesta demonstração, o envio fica bloqueado.</p></div><div><strong>(41) 99999-0000</strong><span>contato@alamedaimoveis.com.br</span><small>Dados fictícios · nenhum envio ativo</small></div></section>

        <footer className="brokerSiteFooter"><strong>Alameda Imóveis</strong><span>Site demonstrativo · dados e imóveis fictícios</span></footer>
      </section>

      {selected ? <div className="brokerPropertyModalBackdrop" onClick={() => setSelected(null)}><article className="brokerPropertyModal" onClick={(event) => event.stopPropagation()}><button className="brokerModalClose" onClick={() => setSelected(null)} aria-label="Fechar">×</button><img src={selected.image} alt={selected.title}/><div><span>{selected.type} · {selected.purpose}</span><h2>{selected.title}</h2><strong>{selected.price}</strong><p>{selected.description}</p><div className="brokerModalFacts">{selected.bedrooms !== null ? <b>{selected.bedrooms} quartos</b> : null}{selected.bathrooms !== null ? <b>{selected.bathrooms} banheiros</b> : null}{selected.garages !== null ? <b>{selected.garages} vagas</b> : null}<b>{selected.area}</b></div><button className="disabledBuy wide" type="button" onClick={() => { setNotice("Demonstração: nenhum contato foi enviado."); setSelected(null); }}>Simular interesse — sem enviar</button></div></article></div> : null}
    </main>
  );
}

function PanelOverview({ onSimulate }: { onSimulate: (message: string) => void }) {
  const panelTools = ["Contatos recebidos","Alertas operacionais","Funil comercial","Tempo de resposta","Classificação de contatos","Perfil de compra","Oportunidades automáticas","Agenda de visitas","Checklist documental","Novo imóvel","Corretores","Personalizar"];
  return <><div className="panelDemoTitle"><div><span>PAINEL</span><h1>Visão geral</h1><p>Acesso rápido ao que importa.</p></div><button type="button" onClick={() => onSimulate("Cadastro simulado: nenhum imóvel foi gravado.")}>+ Cadastrar imóvel</button></div><div className="panelDemoMetrics"><article><small>Imóveis</small><strong>42</strong><span>38 publicados</span></article><article><small>Contatos</small><strong>18</strong><span>5 novos hoje</span></article><article><small>Visitas</small><strong>6</strong><span>2 para hoje</span></article><article><small>Oportunidades</small><strong>9</strong><span>3 com interesse</span></article></div><div className="panelDemoSectionTitle"><span>ACESSOS</span><h2>Ferramentas da imobiliária</h2></div><div className="panelToolGrid">{panelTools.map((tool,index)=><article key={tool} onClick={() => onSimulate(`${tool}: visualização demonstrativa. Nenhum dado foi alterado.`)} style={{ cursor: "pointer" }}><b>{["✉","!","◎","◷","★","⌂","✦","▦","☑","＋","♟","✎"][index]}</b><span>{tool}</span><small>{index < 4 ? "Acompanhe os dados e pendências" : "Abra quando precisar"}</small></article>)}</div><div className="panelDemoLower"><article><span>DESEMPENHO DOS IMÓVEIS</span><strong>128 visualizações</strong><small>12 favoritos · 7 contatos · 4 visitas</small></article><article><span>QUALIDADE DOS ANÚNCIOS</span><strong>91%</strong><small>36 anúncios completos</small></article><article><span>AGENDA</span><strong>Próxima visita 14:30</strong><small>Casa IM-1042 · Marina Souza</small></article></div></>;
}

function PanelProperties() {
  return <><div className="panelDemoTitle"><div><span>IMÓVEIS</span><h1>Catálogo</h1><p>Exemplo de gestão dos anúncios cadastrados.</p></div><button type="button" disabled>+ Novo imóvel — demo</button></div><div className="panelToolGrid">{properties.slice(0, 6).map((item, index) => <article key={item.id}><b>{index + 1}</b><span>{item.title}</span><small>{item.location} · {item.price} · {index === 2 ? "Rascunho" : "Publicado"}</small></article>)}</div></>;
}

function PanelPerformance() {
  return <><div className="panelDemoTitle"><div><span>DESEMPENHO</span><h1>Resultados dos anúncios</h1><p>Dados fictícios para demonstrar a leitura comercial.</p></div></div><div className="panelDemoMetrics"><article><small>Visualizações</small><strong>1.284</strong><span>+18% no mês</span></article><article><small>Favoritos</small><strong>96</strong><span>7,5% dos acessos</span></article><article><small>Contatos</small><strong>43</strong><span>3,3% de conversão</span></article><article><small>Visitas</small><strong>14</strong><span>6 confirmadas</span></article></div><div className="panelDemoLower"><article><span>MAIOR INTERESSE</span><strong>Casa Jardim Europa</strong><small>184 visualizações · 9 contatos</small></article><article><span>ORIGEM</span><strong>Site próprio 62%</strong><small>Portais 24% · Indicação 14%</small></article><article><span>TEMPO DE RESPOSTA</span><strong>8 min</strong><small>Média demonstrativa</small></article></div></>;
}

function PanelQuality() {
  const checks = ["Fotos em boa resolução","Preço informado","Descrição completa","Localização preenchida","Características do imóvel","Contato responsável"];
  return <><div className="panelDemoTitle"><div><span>QUALIDADE</span><h1>Qualidade dos anúncios</h1><p>Checklist demonstrativo para melhorar a apresentação dos imóveis.</p></div></div><div className="panelDemoMetrics"><article><small>Nota geral</small><strong>91%</strong><span>Excelente</span></article><article><small>Completos</small><strong>36</strong><span>de 42 imóveis</span></article><article><small>Pendências</small><strong>6</strong><span>itens para revisar</span></article><article><small>Fotos</small><strong>94%</strong><span>em boa resolução</span></article></div><div className="panelToolGrid">{checks.map((item, index) => <article key={item}><b>{index < 4 ? "✓" : "!"}</b><span>{item}</span><small>{index < 4 ? "Conforme" : "2 anúncios precisam de revisão"}</small></article>)}</div></>;
}

function PanelDocuments() {
  const docs = [["Contrato de intermediação","Atualizado","12/08/2026"],["Matrícula do imóvel IM-1042","Conferido","21/08/2026"],["Ficha de visita · Marina Souza","Assinado","26/08/2026"],["Proposta · IM-0931","Em análise","27/08/2026"],["Checklist documental · IM-1188","Pendente","28/08/2026"]];
  return <><div className="panelDemoTitle"><div><span>DOCUMENTOS</span><h1>Central de documentos</h1><p>Exemplo de organização documental. Nenhum arquivo real está disponível.</p></div></div><div className="panelToolGrid">{docs.map(([name,status,date]) => <article key={name}><b>▤</b><span>{name}</span><small>{status} · {date}</small></article>)}</div></>;
}

export function DemoClientPanel() {
  const [section, setSection] = useState<PanelSection>("Visão geral");
  const [notice, setNotice] = useState("");
  const sections: PanelSection[] = ["Visão geral", "Imóveis", "Desempenho", "Qualidade", "Documentos"];
  return (
    <main className="clientDemoPage clientPanelDemoPage">
      <DemoHeader active="painel" />
      <div className="clientDemoContextBar"><div><span>PAINEL DEMO NAVEGÁVEL</span><strong>Clique nos menus. Alterações e cadastros são apenas simulados.</strong></div><a href="/#planos">Ver preços e contratar</a></div>
      <section className="panelOnlyStage">
        <div className="panelDemoWindow">
          <header><img src="/lenoy-imobiliarias-logo-20260826.png" alt="LENOY"/><div><span>Alameda Imóveis</span><button type="button" onClick={() => { window.location.href = "/demonstracao/site/"; }}>Ver site demo</button></div></header>
          <div className="panelDemoBody"><aside><strong>Gestão</strong>{sections.map((item) => <span key={item} className={section === item ? "active" : ""} role="button" tabIndex={0} onClick={() => { setSection(item); setNotice(""); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { setSection(item); setNotice(""); } }}>{item}</span>)}</aside><div className="panelDemoContent"><SafeDemoNotice text={notice} />{section === "Visão geral" ? <PanelOverview onSimulate={setNotice} /> : null}{section === "Imóveis" ? <PanelProperties /> : null}{section === "Desempenho" ? <PanelPerformance /> : null}{section === "Qualidade" ? <PanelQuality /> : null}{section === "Documentos" ? <PanelDocuments /> : null}</div></div>
        </div>
      </section>
    </main>
  );
}

function AppHome({ setScreen }: { setScreen: (screen: AppScreen) => void }) {
  const menu: [string, AppScreen, string][] = [
    ["▦","Imóveis","Catálogo e anúncios"],
    ["＋","Novo imóvel","Cadastrar pelo celular"],
    ["✉","Contatos / CRM","Clientes e leads"],
    ["◷","Acompanhamentos","Próximas ações"],
    ["★","Oportunidades","Compatibilidades encontradas"],
    ["✓","Visitas","Agenda e compromissos"],
  ];
  return <><small>PAINEL</small><h2>Início</h2><p>Acesso rápido ao que importa.</p><div className="appPhoneMetrics"><article><strong>42</strong><span>Imóveis</span></article><article><strong>18</strong><span>Contatos</span></article><article><strong>6</strong><span>Visitas</span></article><article><strong>9</strong><span>Oportunidades</span></article></div><button type="button" className="appPhonePrimary" onClick={() => setScreen("Novo imóvel")}>＋ Cadastrar novo imóvel</button><div className="appPhoneMenu">{menu.map(([icon,title,text])=><article key={title} onClick={() => setScreen(title)} style={{ cursor: "pointer" }}><b>{icon}</b><div><strong>{title}</strong><span>{text}</span></div><em>›</em></article>)}</div></>;
}

function AppPropertyList() {
  return <><small>IMÓVEIS</small><h2>Catálogo</h2><p>Consulte os anúncios da imobiliária.</p><div className="appPhoneMenu">{properties.slice(0, 4).map((item, index) => <article key={item.id}><b>{index + 1}</b><div><strong>{item.title}</strong><span>{item.price} · {index === 2 ? "Rascunho" : "Publicado"}</span></div><em>›</em></article>)}</div></>;
}

function AppNewProperty({ setNotice }: { setNotice: (message: string) => void }) {
  return <><small>NOVO IMÓVEL</small><h2>Cadastro simulado</h2><p>Veja os campos sem criar nenhum registro.</p><div className="appPhoneMenu"><article><b>1</b><div><strong>Tipo do imóvel</strong><span>Casa</span></div></article><article><b>2</b><div><strong>Finalidade</strong><span>Venda</span></div></article><article><b>3</b><div><strong>Localização</strong><span>Curitiba/PR</span></div></article><article><b>4</b><div><strong>Fotos</strong><span>12 imagens fictícias</span></div></article></div><button type="button" className="appPhonePrimary" onClick={() => setNotice("Cadastro simulado: nenhum imóvel foi salvo e nenhuma foto foi enviada.")}>Simular salvar — sem gravar</button></>;
}

function AppCrm() {
  const leads = [["Marina Souza","Casa Jardim Europa","Novo contato"],["Carlos Mendes","Apartamento Centro","Aguardando retorno"],["Ana Lima","Sobrado Vila Nova","Visita marcada"]];
  return <><small>CRM</small><h2>Contatos</h2><p>Clientes e interessados fictícios.</p><div className="appPhoneMenu">{leads.map(([name,property,status]) => <article key={name}><b>✉</b><div><strong>{name}</strong><span>{property} · {status}</span></div><em>›</em></article>)}</div></>;
}

function AppFollowups() {
  return <><small>ACOMPANHAMENTOS</small><h2>Próximas ações</h2><p>Fila demonstrativa de retornos.</p><div className="appPhoneMenu"><article><b>09:30</b><div><strong>Retornar Marina</strong><span>Enviar detalhes do imóvel IM-1042</span></div></article><article><b>11:00</b><div><strong>Confirmar visita</strong><span>Carlos Mendes · apartamento central</span></div></article><article><b>15:40</b><div><strong>Revisar proposta</strong><span>Ana Lima · IM-0931</span></div></article></div></>;
}

function AppOpportunities() {
  return <><small>OPORTUNIDADES</small><h2>Compatibilidades</h2><p>Exemplos de matches encontrados.</p><div className="appPhoneMenu"><article><b>94%</b><div><strong>Marina Souza</strong><span>Casa Jardim Europa · alta compatibilidade</span></div></article><article><b>89%</b><div><strong>Carlos Mendes</strong><span>Apartamento Centro · boa compatibilidade</span></div></article><article><b>87%</b><div><strong>Ana Lima</strong><span>Sobrado Vila Nova · boa compatibilidade</span></div></article></div></>;
}

function AppVisits() {
  return <><small>VISITAS</small><h2>Agenda</h2><p>Compromissos fictícios para demonstração.</p><div className="appPhoneMenu"><article><b>10:00</b><div><strong>Marina Souza</strong><span>Casa Jardim Europa · Confirmada</span></div></article><article><b>14:30</b><div><strong>Carlos Mendes</strong><span>Apartamento Centro · Confirmada</span></div></article><article><b>17:00</b><div><strong>Ana Lima</strong><span>Sobrado Vila Nova · A confirmar</span></div></article></div></>;
}

export function DemoClientApp() {
  const [screen, setScreen] = useState<AppScreen>("Início");
  const [notice, setNotice] = useState("");
  const go = (next: AppScreen) => { setScreen(next); setNotice(""); };
  return (
    <main className="clientDemoPage clientAppDemoPage">
      <DemoHeader active="aplicativo" />
      <section className="appOnlyStage"><div className="appOnlyCopy"><span>APLICATIVO DEMO NAVEGÁVEL</span><h1>Use o aplicativo como se fosse um corretor.</h1><p>Navegue pelos menus e telas. Nenhum cadastro, mensagem ou alteração sai da demonstração.</p><div className="appOnlyBullets"><article><b>01</b><span>Consulte imóveis e anúncios</span></article><article><b>02</b><span>Navegue pelo CRM e acompanhamentos</span></article><article><b>03</b><span>Veja visitas, oportunidades e cadastro simulado</span></article></div><a href="/#planos">Ver preços e contratar</a></div><div className="appPhoneMock"><div className="appPhoneStatus"><span>9:41</span><strong>LENOY</strong><span>●●●</span></div><header><div><span>AI</span><div><strong>Alameda Imóveis</strong><small>Corretor: Rafael Martins</small></div></div><b>☰</b></header><div className="appPhoneScreen"><SafeDemoNotice text={notice} />{screen === "Início" ? <AppHome setScreen={go} /> : null}{screen === "Imóveis" ? <AppPropertyList /> : null}{screen === "Novo imóvel" ? <AppNewProperty setNotice={setNotice} /> : null}{screen === "Contatos / CRM" ? <AppCrm /> : null}{screen === "Acompanhamentos" ? <AppFollowups /> : null}{screen === "Oportunidades" ? <AppOpportunities /> : null}{screen === "Visitas" ? <AppVisits /> : null}</div><footer><span className={screen === "Início" ? "active" : ""} onClick={() => go("Início")} style={{ cursor: "pointer" }}>⌂<small>Início</small></span><span className={screen === "Imóveis" ? "active" : ""} onClick={() => go("Imóveis")} style={{ cursor: "pointer" }}>▦<small>Imóveis</small></span><span className={screen === "Novo imóvel" ? "active" : ""} onClick={() => go("Novo imóvel")} style={{ cursor: "pointer" }}>＋<small>Novo</small></span><span className={screen === "Contatos / CRM" ? "active" : ""} onClick={() => go("Contatos / CRM")} style={{ cursor: "pointer" }}>✉<small>CRM</small></span></footer></div></section>
    </main>
  );
}
