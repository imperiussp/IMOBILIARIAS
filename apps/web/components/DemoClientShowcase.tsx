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

export function DemoHub() {
  return (
    <main className="clientDemoPage clientDemoHubPage">
      <DemoHeader active="hub" />
      <section className="clientDemoHubHero">
        <span>VEJA ANTES DE CONTRATAR</span>
        <h1>Conheça exatamente o que sua imobiliária vai receber.</h1>
        <p>Escolha uma demonstração. O site, o painel e o aplicativo abaixo são modelos do produto entregue ao cliente, com dados fictícios e sem criar nenhum cadastro.</p>
      </section>
      <section className="clientDemoChoiceGrid">
        <a href="/demonstracao/painel/" className="clientDemoChoiceCard panelChoice">
          <span>01</span><strong>Painel do corretor</strong><p>Veja a área de gestão com imóveis, contatos, visitas, oportunidades e ferramentas.</p><b>Ver painel →</b>
        </a>
        <a href="/demonstracao/site/" className="clientDemoChoiceCard siteChoice">
          <span>02</span><strong>Site da imobiliária</strong><p>Navegue por um site completo com banner, busca, casas, apartamentos e terrenos.</p><b>Ver site →</b>
        </a>
        <a href="/demonstracao/aplicativo/" className="clientDemoChoiceCard appChoice">
          <span>03</span><strong>Aplicativo</strong><p>Veja como o corretor acessa imóveis, CRM, visitas e atalhos pelo celular.</p><b>Ver aplicativo →</b>
        </a>
      </section>
      <section className="clientDemoHubBottom"><div><strong>Gostou do que viu?</strong><span>Os valores aparecem antes do cadastro e o acesso real só é liberado após a confirmação do pagamento.</span></div><a href="/#planos">Ver planos e contratar</a></section>
    </main>
  );
}

export function DemoClientSite() {
  const [filter, setFilter] = useState<"Todos" | "Comprar" | "Alugar" | "Terreno">("Todos");
  const [selected, setSelected] = useState<DemoProperty | null>(null);
  const visible = useMemo(() => properties.filter((item) => {
    if (filter === "Todos") return true;
    if (filter === "Terreno") return item.type === "Terreno";
    return item.purpose === filter;
  }), [filter]);

  return (
    <main className="clientDemoPage clientSiteDemoPage">
      <DemoHeader active="site" />
      <div className="clientDemoContextBar"><div><span>SITE MODELO</span><strong>Este é o visual do site da imobiliária do cliente.</strong></div><a href="/#planos">Ver planos e contratar</a></div>

      <section className="brokerSiteFrame">
        <header className="brokerSiteHeader">
          <a href="#inicio" className="brokerSiteLogo"><span>AV</span><div><strong>Alameda Imóveis</strong><small>CRECI 12345-F · Imobiliária modelo</small></div></a>
          <nav><a href="#inicio">Início</a><a href="#imoveis">Imóveis</a><a href="#sobre">Sobre</a><a href="#contato">Contato</a></nav>
          <button type="button" className="brokerWhatsButton">WhatsApp</button>
        </header>

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
                <div className="brokerPropertyBody"><small>{item.location}</small><h3>{item.title}</h3><strong>{item.price}</strong><div className="brokerPropertyMeta">{item.bedrooms !== null ? <span>🛏 {item.bedrooms} quartos</span> : null}{item.bathrooms !== null ? <span>🚿 {item.bathrooms} banheiros</span> : null}{item.garages !== null ? <span>🚗 {item.garages} vagas</span> : null}<span>▱ {item.area}</span></div><p>{item.description}</p><div className="brokerPropertyActions"><button type="button" onClick={() => setSelected(item)}>Ver detalhes</button><button type="button" className="disabledBuy" disabled>Comprar</button></div></div>
              </article>
            ))}
          </div>
        </section>

        <section id="sobre" className="brokerAboutSection"><div><span>SOBRE A IMOBILIÁRIA</span><h2>Atendimento próximo e imóveis bem apresentados.</h2><p>Este bloco demonstra como a história, os diferenciais, o CRECI, os canais de atendimento e a identidade da imobiliária aparecem para o comprador.</p></div><div className="brokerAboutStats"><article><strong>12 anos</strong><span>de atuação</span></article><article><strong>86</strong><span>imóveis ativos</span></article><article><strong>4,9</strong><span>avaliação média</span></article></div></section>

        <section id="contato" className="brokerContactSection"><div><span>FALE COM A GENTE</span><h2>Encontrou um imóvel interessante?</h2><p>No site real, os contatos chegam diretamente à imobiliária e entram no CRM.</p></div><div><strong>(41) 99999-0000</strong><span>contato@alamedaimoveis.com.br</span><small>Segunda a sexta · 8h às 18h</small></div></section>

        <footer className="brokerSiteFooter"><strong>Alameda Imóveis</strong><span>Site demonstrativo · dados e imóveis fictícios</span></footer>
      </section>

      {selected ? <div className="brokerPropertyModalBackdrop" onClick={() => setSelected(null)}><article className="brokerPropertyModal" onClick={(event) => event.stopPropagation()}><button className="brokerModalClose" onClick={() => setSelected(null)} aria-label="Fechar">×</button><img src={selected.image} alt={selected.title}/><div><span>{selected.type} · {selected.purpose}</span><h2>{selected.title}</h2><strong>{selected.price}</strong><p>{selected.description}</p><div className="brokerModalFacts">{selected.bedrooms !== null ? <b>{selected.bedrooms} quartos</b> : null}{selected.bathrooms !== null ? <b>{selected.bathrooms} banheiros</b> : null}{selected.garages !== null ? <b>{selected.garages} vagas</b> : null}<b>{selected.area}</b></div><button className="disabledBuy wide" disabled>Comprar — demonstração</button></div></article></div> : null}
    </main>
  );
}

export function DemoClientPanel() {
  const panelTools = ["Contatos recebidos","Alertas operacionais","Funil comercial","Tempo de resposta","Classificação de contatos","Perfil de compra","Oportunidades automáticas","Agenda de visitas","Checklist documental","Novo imóvel","Corretores","Personalizar"];
  return (
    <main className="clientDemoPage clientPanelDemoPage">
      <DemoHeader active="painel" />
      <div className="clientDemoContextBar"><div><span>PAINEL MODELO</span><strong>Este é o tipo de painel que o corretor utiliza após a contratação.</strong></div><a href="/#planos">Ver preços e contratar</a></div>
      <section className="panelOnlyStage">
        <div className="panelDemoWindow">
          <header><img src="/lenoy-imobiliarias-logo-20260826.png" alt="LENOY"/><div><span>Alameda Imóveis</span><button type="button">Ver site</button></div></header>
          <div className="panelDemoBody"><aside><strong>Gestão</strong><span className="active">Visão geral</span><span>Imóveis</span><span>Desempenho</span><span>Qualidade</span><span>Documentos</span></aside><div className="panelDemoContent"><div className="panelDemoTitle"><div><span>PAINEL</span><h1>Visão geral</h1><p>Acesso rápido ao que importa.</p></div><button type="button">+ Cadastrar imóvel</button></div><div className="panelDemoMetrics"><article><small>Imóveis</small><strong>42</strong><span>38 publicados</span></article><article><small>Contatos</small><strong>18</strong><span>5 novos hoje</span></article><article><small>Visitas</small><strong>6</strong><span>2 para hoje</span></article><article><small>Oportunidades</small><strong>9</strong><span>3 com interesse</span></article></div><div className="panelDemoSectionTitle"><span>ACESSOS</span><h2>Ferramentas da imobiliária</h2></div><div className="panelToolGrid">{panelTools.map((tool,index)=><article key={tool}><b>{["✉","!","◎","◷","★","⌂","✦","▦","☑","＋","♟","✎"][index]}</b><span>{tool}</span><small>{index < 4 ? "Acompanhe os dados e pendências" : "Abra quando precisar"}</small></article>)}</div><div className="panelDemoLower"><article><span>DESEMPENHO DOS IMÓVEIS</span><strong>128 visualizações</strong><small>12 favoritos · 7 contatos · 4 visitas</small></article><article><span>QUALIDADE DOS ANÚNCIOS</span><strong>91%</strong><small>36 anúncios completos</small></article><article><span>AGENDA</span><strong>Próxima visita 14:30</strong><small>Casa IM-1042 · Marina Souza</small></article></div></div></div>
        </div>
      </section>
    </main>
  );
}

export function DemoClientApp() {
  const menu = [
    ["▦","Imóveis","Catálogo e anúncios"],
    ["＋","Novo imóvel","Cadastrar pelo celular"],
    ["✉","Contatos / CRM","Clientes e leads"],
    ["◷","Acompanhamentos","Próximas ações"],
    ["★","Oportunidades","Compatibilidades encontradas"],
    ["✓","Visitas","Agenda e compromissos"],
  ];
  return (
    <main className="clientDemoPage clientAppDemoPage">
      <DemoHeader active="aplicativo" />
      <section className="appOnlyStage"><div className="appOnlyCopy"><span>APLICATIVO MODELO</span><h1>Veja como o corretor trabalha pelo celular.</h1><p>A demonstração mostra apenas o aplicativo. Não abre o site SaaS e não utiliza dados reais.</p><div className="appOnlyBullets"><article><b>01</b><span>Cadastre e consulte imóveis</span></article><article><b>02</b><span>Acompanhe contatos e interessados</span></article><article><b>03</b><span>Organize visitas e oportunidades</span></article></div><a href="/#planos">Ver preços e contratar</a></div><div className="appPhoneMock"><div className="appPhoneStatus"><span>9:41</span><strong>LENOY</strong><span>●●●</span></div><header><div><span>AI</span><div><strong>Alameda Imóveis</strong><small>Corretor: Rafael Martins</small></div></div><b>☰</b></header><div className="appPhoneScreen"><small>PAINEL</small><h2>Início</h2><p>Acesso rápido ao que importa.</p><div className="appPhoneMetrics"><article><strong>42</strong><span>Imóveis</span></article><article><strong>18</strong><span>Contatos</span></article><article><strong>6</strong><span>Visitas</span></article><article><strong>9</strong><span>Oportunidades</span></article></div><button type="button" className="appPhonePrimary">＋ Cadastrar novo imóvel</button><div className="appPhoneMenu">{menu.map(([icon,title,text])=><article key={title}><b>{icon}</b><div><strong>{title}</strong><span>{text}</span></div><em>›</em></article>)}</div></div><footer><span className="active">⌂<small>Início</small></span><span>▦<small>Imóveis</small></span><span>＋<small>Novo</small></span><span>✉<small>CRM</small></span></footer></div></section>
    </main>
  );
}
