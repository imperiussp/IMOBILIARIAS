"use client";

import { useMemo, useState } from "react";

type DemoTab = "painel" | "site" | "aplicativo";

const propertyCards = [
  { code: "IM-1042", title: "Casa moderna com 3 quartos", place: "Centro · Sengés/PR", price: "R$ 489.000", meta: "3 quartos · 2 vagas · 168 m²", className: "houseOne" },
  { code: "IM-1087", title: "Apartamento com suíte e varanda", place: "Jardim Europa · Curitiba/PR", price: "R$ 620.000", meta: "2 quartos · 1 vaga · 92 m²", className: "houseTwo" },
  { code: "IM-1104", title: "Sobrado residencial com quintal", place: "Vila Nova · Ponta Grossa/PR", price: "R$ 745.000", meta: "4 quartos · 3 vagas · 214 m²", className: "houseThree" },
];

const panelModules = [
  ["✉", "Contatos recebidos", "Leads e mensagens"],
  ["!", "Alertas operacionais", "Pendências e avisos"],
  ["◎", "Funil comercial", "Negociações e etapas"],
  ["◷", "Tempo de resposta", "Velocidade de atendimento"],
  ["★", "Classificação de contatos", "Prioridade e perfil"],
  ["⌂", "Perfil de compra", "Preferências do comprador"],
  ["✦", "Oportunidades automáticas", "Matches para compradores"],
  ["▦", "Agenda de visitas", "Visitas e compromissos"],
  ["☑", "Checklist documental", "Documentos do imóvel"],
  ["＋", "Novo imóvel", "Cadastro + descrição com IA"],
  ["♟", "Corretores", "Equipe comercial"],
  ["✎", "Personalizar", "Marca no site e aplicativo"],
];

const appMenu = [
  ["⌂", "Início", "Resumo do aplicativo"],
  ["▦", "Imóveis", "Catálogo e anúncios"],
  ["＋", "Novo imóvel", "Cadastrar imóvel"],
  ["✉", "Contatos / CRM", "Clientes e leads"],
  ["◷", "Acompanhamentos", "Próximas ações"],
  ["★", "Oportunidades", "Compatibilidades encontradas"],
];

function PanelDemo() {
  return (
    <section className="demoTourStage demoTourPanelStage" aria-label="Demonstração do painel">
      <div className="demoTourCaption"><div><span>PAINEL DO CORRETOR</span><h2>Veja como vai ficar o seu painel</h2><p>É a mesma estrutura que o cliente recebe após a contratação. Aqui os dados são apenas fictícios e nenhuma alteração é salva.</p></div><b>DEMONSTRAÇÃO</b></div>
      <div className="demoRealPanel">
        <div className="demoRealTopbar"><img src="/lenoy-imobiliarias-logo-20260826.png" alt="LENOY Imobiliárias"/><div><span>Imobiliária Modelo</span><button type="button">Ver site</button></div></div>
        <div className="demoRealBody">
          <aside><strong>Gestão</strong><span className="active">Visão geral</span><span>Imóveis</span><span>Desempenho</span><span>Qualidade</span><span>Documentos</span></aside>
          <div className="demoRealContent">
            <div className="demoRealHeading"><div><small>PAINEL</small><h3>Visão geral</h3><p>Acesso rápido ao que importa na operação da imobiliária.</p></div><button type="button">+ Cadastrar imóvel</button></div>
            <div className="demoRealMetrics"><article><span>Imóveis</span><strong>42</strong><small>38 publicados</small></article><article><span>Contatos</span><strong>18</strong><small>5 novos hoje</small></article><article><span>Visitas</span><strong>6</strong><small>2 para hoje</small></article><article><span>Oportunidades</span><strong>9</strong><small>3 com interesse</small></article></div>
            <div className="demoRealSectionTitle"><div><small>ACESSOS</small><strong>Ferramentas da imobiliária</strong></div><span>mesmos módulos do painel</span></div>
            <div className="demoRealModules">{panelModules.map(([icon,title,text])=><article key={title}><b>{icon}</b><div><strong>{title}</strong><span>{text}</span></div></article>)}</div>
            <div className="demoRealBottom"><article><small>DESEMPENHO DOS IMÓVEIS</small><strong>128 visualizações</strong><span>12 favoritos · 7 contatos · 4 visitas</span></article><article><small>QUALIDADE DOS ANÚNCIOS</small><strong>91%</strong><span>36 anúncios completos</span></article><article><small>AGENDA</small><strong>Próxima visita 14:30</strong><span>Casa IM-1042 · Marina Souza</span></article></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteDemo() {
  return (
    <section className="demoTourStage" aria-label="Demonstração do site">
      <div className="demoTourCaption"><div><span>SITE DA IMOBILIÁRIA</span><h2>Veja como vai ficar o site da sua imobiliária</h2><p>Um único modelo de demonstração mostra a experiência real do site público. Depois da contratação entram a marca, o contato, os imóveis e as configurações do cliente.</p></div><b>DEMONSTRAÇÃO</b></div>
      <div className="demoTenantSite">
        <header><div className="demoTenantBrand"><span>IM</span><div><strong>Imobiliária Modelo</strong><small>Seu imóvel, nosso compromisso.</small></div></div><nav><span>Início</span><span>Imóveis</span><span>Comprar</span><span>Alugar</span><span>Contato</span></nav><button type="button">WhatsApp</button></header>
        <div className="demoTenantHero"><div><small>ENCONTRE SEU PRÓXIMO IMÓVEL</small><h3>Um site profissional para apresentar seus imóveis.</h3><p>Busca rápida, imóveis em destaque, detalhes completos e contato direto com a imobiliária.</p><div className="demoTenantSearch"><span>Comprar</span><span>Tipo do imóvel</span><span>Cidade</span><button type="button">Buscar imóveis</button></div></div><div className="demoTenantHeroCard"><span>IMÓVEL EM DESTAQUE</span><strong>Casa residencial · IM-1042</strong><b>R$ 489.000</b><small>3 quartos · 2 vagas · 168 m²</small></div></div>
        <section className="demoTenantProperties"><div className="demoTenantSectionTitle"><div><small>IMÓVEIS EM DESTAQUE</small><h3>O catálogo que seus clientes vão navegar</h3></div><span>Ver todos os imóveis →</span></div><div className="demoTenantGrid">{propertyCards.map((item,index)=><article key={item.code}><div className={`demoPropertyPhoto ${item.className}`}><span>{index===0?"DESTAQUE":"NOVO"}</span><b>⌂</b></div><div className="demoPropertyCopy"><small>{item.code} · {item.place}</small><h4>{item.title}</h4><strong>{item.price}</strong><p>{item.meta}</p><button type="button">Ver imóvel</button></div></article>)}</div></section>
        <section className="demoTenantBenefits"><article><b>⌕</b><div><strong>Busca simples</strong><span>Filtros para o comprador chegar mais rápido ao imóvel certo.</span></div></article><article><b>♡</b><div><strong>Imóveis completos</strong><span>Fotos, características, localização e contato em um só lugar.</span></div></article><article><b>◉</b><div><strong>Contato direto</strong><span>WhatsApp e formulário ligados à imobiliária.</span></div></article></section>
      </div>
    </section>
  );
}

function AppDemo() {
  return (
    <section className="demoTourStage" aria-label="Demonstração do aplicativo">
      <div className="demoTourCaption"><div><span>APLICATIVO DO CORRETOR</span><h2>Veja como vai ficar o seu aplicativo</h2><p>O aplicativo usa a mesma estrutura da operação: imóveis, CRM, interessados, visitas, acompanhamento e ferramentas administrativas no celular.</p></div><b>DEMONSTRAÇÃO</b></div>
      <div className="demoAppPresentation">
        <div className="demoAppCopy"><span>TRABALHE PELO CELULAR</span><h3>O painel essencial acompanha o corretor onde ele estiver.</h3><p>Esta visualização reproduz a organização do aplicativo real, sem criar conta e sem tocar em dados de clientes.</p><div className="demoAppFeatureCards"><article><b>01</b><span>Consulte e compartilhe imóveis</span></article><article><b>02</b><span>Converse com contatos e interessados</span></article><article><b>03</b><span>Cadastre imóveis e acompanhe visitas</span></article></div></div>
        <div className="demoPhone"><div className="demoPhoneStatus"><span>9:41</span><strong>LENOY</strong><span>●●●</span></div><div className="demoPhoneHeader"><div><span>IM</span><div><strong>Imobiliária Modelo</strong><small>Corretor: Rafael</small></div></div><b>☰</b></div><div className="demoPhoneContent"><small>PAINEL</small><h3>Início</h3><p>Acesso rápido ao que importa.</p><div className="demoPhoneMetrics"><article><strong>42</strong><span>Imóveis</span></article><article><strong>18</strong><span>Contatos</span></article><article><strong>6</strong><span>Visitas</span></article><article><strong>9</strong><span>Oportunidades</span></article></div><button className="demoPhonePrimary" type="button">＋ Cadastrar novo imóvel</button><div className="demoPhoneMenu">{appMenu.map(([icon,title,text])=><article key={title}><b>{icon}</b><div><strong>{title}</strong><span>{text}</span></div><em>›</em></article>)}</div></div><div className="demoPhoneNav"><span className="active">⌂<small>Início</small></span><span>▦<small>Imóveis</small></span><span>＋<small>Novo</small></span><span>✉<small>CRM</small></span></div></div>
      </div>
    </section>
  );
}

export default function DemoTour() {
  const [tab,setTab] = useState<DemoTab>("painel");
  const tabs = useMemo(() => ([
    { id: "painel" as DemoTab, title: "Painel", text: "Veja como vai ficar o seu painel" },
    { id: "site" as DemoTab, title: "Site", text: "Veja como vai ficar o seu site" },
    { id: "aplicativo" as DemoTab, title: "Aplicativo", text: "Veja como vai ficar o seu aplicativo" },
  ]), []);

  return <main className="demoTourPage">
    <header className="demoTourTopbar"><a href="../" className="demoTourLogo"><img src="/lenoy-imobiliarias-logo-20260826.png" alt="LENOY Imobiliárias"/></a><div className="demoTourTopActions"><a href="../#planos">Ver planos</a><a className="demoTourTopPrimary" href="../#planos">Contratar e pagar</a></div></header>
    <section className="demoTourHero"><span>VEJA ANTES DE CONTRATAR</span><h1>Veja sua imobiliária pronta antes de escolher o plano.</h1><p>Faça um tour entre o painel do corretor, o site público e o aplicativo. É uma demonstração do produto que será entregue — não é um painel criado especialmente para este visitante.</p><div className="demoTourHeroActions"><a className="primary" href="../#planos">Ver planos e contratar</a><a href="../">Voltar para a página inicial</a></div></section>
    <nav className="demoTourTabs" aria-label="Tour da plataforma">{tabs.map(item=><button key={item.id} type="button" className={tab===item.id?"active":""} onClick={()=>setTab(item.id)}><strong>{item.title}</strong><span>{item.text}</span></button>)}</nav>
    <div className="demoTourContent">{tab==="painel"?<PanelDemo/>:tab==="site"?<SiteDemo/>:<AppDemo/>}</div>
    <section className="demoTourCta"><div><span>GOSTOU DO QUE VIU?</span><h2>Agora escolha o plano para sua operação.</h2><p>Você vê o preço antes do cadastro. O acesso real só é liberado depois da confirmação segura do pagamento.</p></div><div><a className="primary" href="../#planos">Ver planos e preços</a><a href="../login/">Já tenho acesso</a></div></section>
  </main>;
}
