"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { getCurrentAgency, type CurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import AdminBrokerGoals from "./AdminBrokerGoals";
import AdminBrokerPerformance from "./AdminBrokerPerformance";
import AdminBrokers from "./AdminBrokers";
import AdminBuyerDeliveryMonitor from "./AdminBuyerDeliveryMonitor";
import AdminBuyerOutreach from "./AdminBuyerOutreach";
import AdminBuyerPreferences from "./AdminBuyerPreferences";
import AdminDocuments from "./AdminDocuments";
import AdminDomains from "./AdminDomains";
import AdminFollowups from "./AdminFollowups";
import AdminInfinitePayCheckout from "./AdminInfinitePayCheckout";
import AdminLeadQualificationBoard from "./AdminLeadQualificationBoard";
import AdminLeadTimeline from "./AdminLeadTimeline";
import AdminLiveData from "./AdminLiveData";
import AdminPlan from "./AdminPlan";
import AdminProfessionalEmails from "./AdminProfessionalEmails";
import AdminPropertyForm from "./AdminPropertyForm";
import AdminSiteSettings from "./AdminSiteSettings";
import AdminUsers from "./AdminUsers";
import AdminVisitSchedule from "./AdminVisitSchedule";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

type PlanState = {
  name: string;
  renewsAt: string | null;
  endsAt: string | null;
  features: Record<string, unknown>;
};

type Summary = {
  properties: number;
  contacts: number;
  pendingFollowups: number;
  upcomingVisits: number;
  historyEvents: number;
  brokerPerformance: number;
  brokerGoals: number;
  opportunities: number;
  deliveryAttempts: number;
};

type AppView =
  | "home"
  | "imoveis"
  | "novo-imovel"
  | "contatos"
  | "classificacao"
  | "perfil-compra"
  | "oportunidades"
  | "entregas"
  | "acompanhamentos"
  | "visitas"
  | "historico-contato"
  | "documentos"
  | "desempenho-corretores"
  | "metas-corretores"
  | "corretores"
  | "usuarios"
  | "meu-plano"
  | "alterar-plano"
  | "emails"
  | "identidade"
  | "dominios";

type MenuItem = {
  view: AppView;
  label: string;
  detail: string;
  adminOnly?: boolean;
  when?: (summary: Summary, outreachAllowed: boolean) => boolean;
};

const emptySummary: Summary = {
  properties: 0,
  contacts: 0,
  pendingFollowups: 0,
  upcomingVisits: 0,
  historyEvents: 0,
  brokerPerformance: 0,
  brokerGoals: 0,
  opportunities: 0,
  deliveryAttempts: 0,
};

const menuItems: MenuItem[] = [
  { view: "home", label: "Início", detail: "Resumo do aplicativo" },
  { view: "imoveis", label: "Imóveis", detail: "Catálogo e anúncios" },
  { view: "novo-imovel", label: "Novo imóvel", detail: "Cadastrar imóvel", adminOnly: true },
  { view: "contatos", label: "Contatos", detail: "Leads recebidos", when: (s) => s.contacts > 0 },
  { view: "classificacao", label: "Classificação", detail: "Organizar contatos", when: (s) => s.contacts > 0 },
  { view: "perfil-compra", label: "Perfil de compra", detail: "Preferências do comprador", when: (s) => s.contacts > 0 },
  { view: "oportunidades", label: "Oportunidades automáticas", detail: "Matches permitidos pelo plano", adminOnly: true, when: (s, allowed) => allowed && s.contacts > 0 },
  { view: "entregas", label: "Entrega das oportunidades", detail: "Envios e retornos", adminOnly: true, when: (s, allowed) => allowed && s.deliveryAttempts > 0 },
  { view: "acompanhamentos", label: "Acompanhamentos", detail: "Próximas ações", when: (s) => s.pendingFollowups > 0 },
  { view: "visitas", label: "Visitas aos imóveis", detail: "Agenda e próximas visitas" },
  { view: "historico-contato", label: "Histórico do contato", detail: "Linha do tempo do CRM", when: (s) => s.historyEvents > 0 },
  { view: "documentos", label: "Documentos", detail: "Central de documentos", adminOnly: true },
  { view: "desempenho-corretores", label: "Desempenho dos corretores", detail: "Indicadores da equipe", adminOnly: true, when: (s) => s.brokerPerformance > 0 },
  { view: "metas-corretores", label: "Metas dos corretores", detail: "Metas com dados registrados", adminOnly: true, when: (s) => s.brokerGoals > 0 },
  { view: "corretores", label: "Corretores", detail: "Equipe comercial", adminOnly: true },
  { view: "usuarios", label: "Usuários", detail: "Acessos da equipe", adminOnly: true },
  { view: "meu-plano", label: "Meu plano", detail: "Vigência e limites", adminOnly: true },
  { view: "alterar-plano", label: "Alterar / renovar plano", detail: "Pagamento e mudança de plano", adminOnly: true },
  { view: "emails", label: "E-mails profissionais", detail: "Criar e gerenciar caixas", adminOnly: true },
  { view: "identidade", label: "Identidade e aparência", detail: "Logo, cores e visual", adminOnly: true },
  { view: "dominios", label: "Domínios", detail: "Domínio próprio", adminOnly: true },
];

const viewTitles: Record<AppView, { kicker: string; title: string; text: string }> = {
  home: { kicker: "PAINEL", title: "Visão geral", text: "Somente o que precisa de atenção agora." },
  imoveis: { kicker: "IMÓVEIS", title: "Meus imóveis", text: "Catálogo, status e edição sem rolagem horizontal." },
  "novo-imovel": { kicker: "CADASTRO", title: "Novo imóvel", text: "Abra o formulário somente quando for cadastrar." },
  contatos: { kicker: "CRM", title: "Contatos recebidos", text: "Contatos existentes da imobiliária." },
  classificacao: { kicker: "CRM", title: "Classificação dos contatos", text: "Organize apenas os contatos que já existem." },
  "perfil-compra": { kicker: "COMPRADORES", title: "Perfil de compra", text: "O formulário começa fechado para manter a tela curta." },
  oportunidades: { kicker: "IA COMERCIAL", title: "Oportunidades automáticas", text: "Disponível somente quando o plano permitir e houver contatos." },
  entregas: { kicker: "MENSAGERIA", title: "Entrega das oportunidades", text: "Só aparece quando existir entrega registrada e o plano permitir." },
  acompanhamentos: { kicker: "CRM", title: "Acompanhamentos", text: "Mostrado somente quando houver ações pendentes." },
  visitas: { kicker: "AGENDA", title: "Visitas aos imóveis", text: "Próximas visitas ficam visíveis; o formulário começa fechado." },
  "historico-contato": { kicker: "CRM 360°", title: "Histórico do contato", text: "Só aparece quando existir histórico." },
  documentos: { kicker: "DOCUMENTOS", title: "Central de documentos", text: "Documentos agora abrem dentro do aplicativo." },
  "desempenho-corretores": { kicker: "EQUIPE", title: "Desempenho dos corretores", text: "Exibido somente quando houver indicadores." },
  "metas-corretores": { kicker: "EQUIPE", title: "Metas dos corretores", text: "Exibido somente quando houver metas registradas." },
  corretores: { kicker: "EQUIPE", title: "Corretores", text: "Gestão da equipe comercial." },
  usuarios: { kicker: "ACESSOS", title: "Usuários", text: "Gestão dos acessos da imobiliária." },
  "meu-plano": { kicker: "PLANO", title: "Meu plano", text: "Vigência, limites e recursos disponíveis." },
  "alterar-plano": { kicker: "PLANO", title: "Alterar ou renovar plano", text: "Contratação e renovação." },
  emails: { kicker: "E-MAIL", title: "E-mails profissionais", text: "Criação e gestão das caixas profissionais." },
  identidade: { kicker: "MARCA", title: "Identidade e aparência", text: "Logo, cores e aparência da imobiliária." },
  dominios: { kicker: "DOMÍNIO", title: "Domínios", text: "Configuração do domínio próprio." },
};

function numberFrom(result: { count?: number | null } | null | undefined) {
  return Number(result?.count || 0);
}

function appHref(view: AppView) {
  return view === "home" ? "/app/" : `/app/?view=${encodeURIComponent(view)}`;
}

function planAllowsOutreach(features: Record<string, unknown>, usage: { monthly_limit?: number | null } | null) {
  const explicit = [
    features.buyer_outreach,
    features.automatic_buyer_opportunities,
    features.ai_buyer_opportunities,
    features.buyer_opportunities,
  ].some((value) => value === true || Number(value) > 0);
  const usageAllows = Boolean(usage && (usage.monthly_limit == null || Number(usage.monthly_limit) > 0));
  return explicit || usageAllows;
}

export default function MobileWebApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [agency, setAgency] = useState<CurrentAgency | null>(null);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [outreachAllowed, setOutreachAllowed] = useState(false);
  const [view, setView] = useState<AppView>("home");
  const [loading, setLoading] = useState(true);
  const [visitFormOpen, setVisitFormOpen] = useState(false);
  const [buyerFormOpen, setBuyerFormOpen] = useState(false);

  const isAdmin = agency?.role === "owner" || agency?.role === "admin";

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view") as AppView | null;
    if (requested && Object.prototype.hasOwnProperty.call(viewTitles, requested)) setView(requested);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getCurrentAgency();
      if (!active) return;
      setAgency(current);
      if (!current || !supabaseBrowser) {
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();
      const [
        propertiesResult,
        contactsResult,
        followupResult,
        visitResult,
        historyResult,
        performanceResult,
        goalsResult,
        opportunitiesResult,
        deliveryResult,
        subscriptionResult,
        usageResult,
      ] = await Promise.all([
        supabaseBrowser.from("properties").select("id", { count: "exact", head: true }).eq("agency_id", current.agencyId),
        supabaseBrowser.from("leads").select("id", { count: "exact", head: true }).eq("agency_id", current.agencyId),
        supabaseBrowser.from("lead_followups").select("id", { count: "exact", head: true }).eq("agency_id", current.agencyId).is("completed_at", null),
        supabaseBrowser.from("property_visit_appointments").select("id", { count: "exact", head: true }).eq("agency_id", current.agencyId).eq("status", "scheduled").gte("scheduled_at", now),
        supabaseBrowser.from("lead_activity_events").select("id", { count: "exact", head: true }).eq("agency_id", current.agencyId),
        supabaseBrowser.from("agency_broker_performance").select("broker_id", { count: "exact", head: true }).eq("agency_id", current.agencyId),
        supabaseBrowser.from("broker_monthly_goal_progress").select("broker_id", { count: "exact", head: true }).eq("agency_id", current.agencyId),
        supabaseBrowser.from("buyer_property_opportunities").select("id", { count: "exact", head: true }).eq("agency_id", current.agencyId),
        supabaseBrowser.from("buyer_outreach_delivery_attempts").select("id", { count: "exact", head: true }).eq("agency_id", current.agencyId),
        supabaseBrowser.from("agency_subscriptions").select("renews_at,ends_at,subscription_plans(name,features)").eq("agency_id", current.agencyId).order("starts_at", { ascending: false }).limit(1).maybeSingle(),
        supabaseBrowser.from("agency_buyer_outreach_usage").select("monthly_limit").eq("agency_id", current.agencyId).maybeSingle(),
      ]);

      if (!active) return;
      setSummary({
        properties: numberFrom(propertiesResult),
        contacts: numberFrom(contactsResult),
        pendingFollowups: numberFrom(followupResult),
        upcomingVisits: numberFrom(visitResult),
        historyEvents: numberFrom(historyResult),
        brokerPerformance: numberFrom(performanceResult),
        brokerGoals: numberFrom(goalsResult),
        opportunities: numberFrom(opportunitiesResult),
        deliveryAttempts: numberFrom(deliveryResult),
      });

      const rawPlan = subscriptionResult.data?.subscription_plans as unknown as { name?: string; features?: Record<string, unknown> } | { name?: string; features?: Record<string, unknown> }[] | null;
      const planRow = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;
      const features = planRow?.features || {};
      setPlan({
        name: planRow?.name || "Plano atual",
        renewsAt: subscriptionResult.data?.renews_at || null,
        endsAt: subscriptionResult.data?.ends_at || null,
        features,
      });
      setOutreachAllowed(planAllowsOutreach(features, usageResult.data as { monthly_limit?: number | null } | null));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  const visibleMenu = useMemo(() => menuItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return item.when ? item.when(summary, outreachAllowed) : true;
  }), [isAdmin, outreachAllowed, summary]);

  async function signOut() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    window.location.href = "/login/?redirect=%2Fapp%2F";
  }

  const meta = viewTitles[view];

  return (
    <main className="mobileAppWorkspace">
      <style>{mobileCss}</style>
      <header className="mobileAppTopbar">
        <a className="mobileAppBrand" href="/app/" aria-label="Voltar ao início do aplicativo">
          <img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" />
          <span><small>LENOY IMOBILIÁRIAS</small><strong>Painel do corretor</strong></span>
        </a>
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" className="mobileMenuButton">☰</button>
      </header>

      <section className="mobileAppContent">
        {view === "home" ? renderHome() : (
          <>
            <div className="mobilePageHeading">
              <a href="/app/" className="mobileBackLink">‹ Início</a>
              <span>{meta.kicker}</span>
              <h1>{meta.title}</h1>
              <p>{meta.text}</p>
            </div>
            {renderView()}
          </>
        )}
      </section>

      {menuOpen ? (
        <div className="mobileMenuLayer" role="dialog" aria-modal="true" aria-label="Menu do aplicativo">
          <button type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} className="mobileMenuBackdrop" />
          <aside className="mobileMenuDrawer">
            <div className="mobileDrawerHead">
              <div className="mobileDrawerBrand"><img src={lenoyLogo} alt="" /><div><small>LENOY IMOBILIÁRIAS</small><strong>Menu</strong><span>{agency?.agencyName || "Sua imobiliária"}</span></div></div>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" className="mobileCloseButton">×</button>
            </div>
            <nav className="mobileMenuList">
              {visibleMenu.map((item) => (
                <a key={item.view} href={appHref(item.view)} onClick={() => setMenuOpen(false)} className={view === item.view ? "active" : ""}>
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span><b>›</b>
                </a>
              ))}
            </nav>
            <button type="button" onClick={() => void signOut()} className="mobileSignOut">Sair da conta</button>
          </aside>
        </div>
      ) : null}
    </main>
  );

  function renderHome() {
    return <>
      <section className="mobileHero">
        <div><span>PAINEL</span><h1>{agency?.agencyName || "Sua imobiliária"}</h1><p>Informações relevantes e ações rápidas, sem carregar o painel inteiro.</p></div>
        {isAdmin ? <a href={appHref("meu-plano")} className="mobilePlanBadge"><small>PLANO</small><strong>{plan?.name || (loading ? "..." : "—")}</strong></a> : null}
      </section>

      <section className="mobileStatsGrid">
        <article><span>Imóveis</span><strong>{loading ? "—" : summary.properties}</strong></article>
        {summary.contacts > 0 ? <article><span>Contatos</span><strong>{summary.contacts}</strong></article> : null}
        {summary.upcomingVisits > 0 ? <article><span>Próximas visitas</span><strong>{summary.upcomingVisits}</strong></article> : null}
        {summary.pendingFollowups > 0 ? <article><span>Acompanhamentos</span><strong>{summary.pendingFollowups}</strong></article> : null}
      </section>

      <div className="mobileSectionTitle"><span>ATALHOS</span><h2>O que precisa fazer agora?</h2></div>
      <div className="mobileActionGrid">
        {isAdmin ? <ActionCard title="Novo imóvel" text="Cadastrar imóvel" href={appHref("novo-imovel")} dark /> : null}
        <ActionCard title="Meus imóveis" text="Consultar e editar" href={appHref("imoveis")} />
        {summary.contacts > 0 ? <ActionCard title="Contatos" text={`${summary.contacts} recebido(s)`} href={appHref("contatos")} /> : null}
        {summary.upcomingVisits > 0 ? <ActionCard title="Visitas" text={`${summary.upcomingVisits} próxima(s)`} href={appHref("visitas")} /> : null}
        {summary.pendingFollowups > 0 ? <ActionCard title="Acompanhamentos" text={`${summary.pendingFollowups} pendente(s)`} href={appHref("acompanhamentos")} /> : null}
        {isAdmin ? <ActionCard title="Meu plano" text="Vigência e alteração" href={appHref("meu-plano")} /> : null}
      </div>

      {isAdmin ? <section className="mobilePlanCard"><div><span>CONTA DA IMOBILIÁRIA</span><strong>{plan?.name || "Plano atual"}</strong><small>{plan?.renewsAt || plan?.endsAt ? `Vigência: ${formatDate(plan.renewsAt || plan.endsAt)}` : "Consulte vigência e limites"}</small></div><a href={appHref("alterar-plano")}>Alterar / renovar <b>›</b></a></section> : null}
      <p className="mobileMenuHint">As demais ferramentas ficam organizadas no menu ☰.</p>
    </>;
  }

  function renderView() {
    switch (view) {
      case "imoveis":
        return <div className="mobileModule livePropertiesOnly"><AdminLiveData /></div>;
      case "novo-imovel":
        return isAdmin ? <CollapsedModule title="Abrir cadastro de imóvel"><div className="mobileFormCard"><AdminPropertyForm /></div></CollapsedModule> : <Unavailable text="Este recurso é administrativo." />;
      case "contatos":
        return summary.contacts > 0 ? <div className="mobileModule liveContactsOnly"><AdminLiveData /></div> : <Unavailable text="Nenhum contato recebido." />;
      case "classificacao":
        return summary.contacts > 0 ? <div className="mobileModule"><AdminLeadQualificationBoard /></div> : <Unavailable text="A classificação aparece quando houver contatos." />;
      case "perfil-compra":
        return summary.contacts > 0 ? <div className={`mobileModule buyerProfile ${buyerFormOpen ? "formOpen" : "formClosed"}`}><button className="mobileOpenButton" onClick={() => setBuyerFormOpen((value) => !value)}>{buyerFormOpen ? "Fechar formulário" : "Abrir formulário de perfil"}</button><AdminBuyerPreferences /></div> : <Unavailable text="O perfil de compra aparece quando houver contatos." />;
      case "oportunidades":
        return isAdmin && outreachAllowed && summary.contacts > 0 ? <CollapsedModule title="Abrir oportunidades automáticas"><AdminBuyerOutreach /></CollapsedModule> : <Unavailable text="Este recurso não está disponível para o plano atual ou não há contatos." />;
      case "entregas":
        return isAdmin && outreachAllowed && summary.deliveryAttempts > 0 ? <CollapsedModule title={`Abrir entregas (${summary.deliveryAttempts})`}><AdminBuyerDeliveryMonitor /></CollapsedModule> : <Unavailable text="Nenhuma entrega disponível para exibição." />;
      case "acompanhamentos":
        return summary.pendingFollowups > 0 ? <CollapsedModule title={`Abrir acompanhamentos (${summary.pendingFollowups})`}><AdminFollowups /></CollapsedModule> : <Unavailable text="Nenhum acompanhamento pendente." />;
      case "visitas":
        return <div className={`mobileModule visitsModule ${visitFormOpen ? "formOpen" : "formClosed"}`}><button className="mobileOpenButton" onClick={() => setVisitFormOpen((value) => !value)}>{visitFormOpen ? "Fechar formulário de visita" : "Agendar nova visita"}</button><AdminVisitSchedule /></div>;
      case "historico-contato":
        return summary.historyEvents > 0 ? <div className="mobileModule"><AdminLeadTimeline /></div> : <Unavailable text="Ainda não há histórico de contatos." />;
      case "documentos":
        return isAdmin ? <div className="mobileModule"><AdminDocuments /></div> : <Unavailable text="Este recurso é administrativo." />;
      case "desempenho-corretores":
        return isAdmin && summary.brokerPerformance > 0 ? <CollapsedModule title="Abrir desempenho dos corretores"><AdminBrokerPerformance /></CollapsedModule> : <Unavailable text="Ainda não há dados de desempenho." />;
      case "metas-corretores":
        return isAdmin && summary.brokerGoals > 0 ? <CollapsedModule title="Abrir metas dos corretores"><AdminBrokerGoals /></CollapsedModule> : <Unavailable text="Ainda não há metas com dados registrados." />;
      case "corretores":
        return isAdmin ? <div className="mobileModule"><AdminBrokers /></div> : <Unavailable text="Este recurso é administrativo." />;
      case "usuarios":
        return isAdmin ? <div className="mobileModule"><AdminUsers /></div> : <Unavailable text="Este recurso é administrativo." />;
      case "meu-plano":
        return isAdmin ? <div className="mobileModule"><AdminPlan /></div> : <Unavailable text="Este recurso é administrativo." />;
      case "alterar-plano":
        return isAdmin ? <div className="mobileModule"><AdminInfinitePayCheckout /></div> : <Unavailable text="Este recurso é administrativo." />;
      case "emails":
        return isAdmin ? <div className="mobileModule"><AdminProfessionalEmails /></div> : <Unavailable text="Este recurso é administrativo." />;
      case "identidade":
        return isAdmin ? <div className="mobileModule"><AdminSiteSettings /></div> : <Unavailable text="Este recurso é administrativo." />;
      case "dominios":
        return isAdmin ? <div className="mobileModule"><AdminDomains /></div> : <Unavailable text="Este recurso é administrativo." />;
      default:
        return null;
    }
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function ActionCard({ title, text, href, dark = false }: { title: string; text: string; href: string; dark?: boolean }) {
  return <a href={href} className={`mobileActionCard ${dark ? "dark" : ""}`}><span>＋</span><strong>{title}</strong><small>{text}</small></a>;
}

function CollapsedModule({ title, children }: { title: string; children: ReactNode }) {
  return <details className="mobileCollapsedModule"><summary><strong>{title}</strong><span>+</span></summary><div className="mobileCollapsedBody mobileModule">{children}</div></details>;
}

function Unavailable({ text }: { text: string }) {
  return <div className="mobileEmptyState">{text}</div>;
}

const mobileCss = `
.mobileAppWorkspace{min-height:100dvh;background:#f5f1ea;color:#07182d;font-family:Inter,Arial,sans-serif;overflow-x:hidden}
.mobileAppTopbar{position:sticky;top:0;z-index:60;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 11px;background:rgba(255,255,255,.98);border-bottom:1px solid #e8e0d4;box-shadow:0 7px 22px rgba(7,24,45,.06)}
.mobileAppBrand{display:flex;align-items:center;gap:9px;min-width:0;color:#07182d;text-decoration:none}.mobileAppBrand img{width:38px;height:38px;object-fit:contain;flex:0 0 auto}.mobileAppBrand span{display:grid;min-width:0}.mobileAppBrand small{font-size:8px;line-height:1.1;letter-spacing:1.35px;font-weight:900;color:#a1782e}.mobileAppBrand strong{margin-top:2px;font-size:15px;line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mobileMenuButton{width:44px;height:42px;display:grid;place-items:center;flex:0 0 auto;border:0;border-radius:13px;background:#07182d;color:#fff;font-size:22px;font-weight:900;cursor:pointer}
.mobileAppContent{width:min(100%,760px);margin:0 auto;padding:14px 13px calc(32px + env(safe-area-inset-bottom,0px))}
.mobileHero{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px;border-radius:22px;background:#07182d;color:#fff;box-shadow:0 16px 34px rgba(7,24,45,.13)}.mobileHero>div{min-width:0}.mobileHero span,.mobileSectionTitle span,.mobilePageHeading>span,.mobilePlanCard>div>span{display:block;font-size:8px;font-weight:900;letter-spacing:1.5px;color:#d6ac58}.mobileHero h1{margin:5px 0 0;font-size:24px;line-height:1.05}.mobileHero p{margin:7px 0 0;max-width:390px;font-size:12px;line-height:1.45;color:#c7d1db}.mobilePlanBadge{min-width:82px;padding:9px;border-radius:14px;background:#d6ac58;color:#07182d;text-decoration:none;text-align:center}.mobilePlanBadge small{display:block;font-size:7px;font-weight:900;letter-spacing:1px}.mobilePlanBadge strong{display:block;margin-top:3px;font-size:11px;line-height:1.05}
.mobileStatsGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:11px}.mobileStatsGrid article{padding:13px;border-radius:16px;background:#fff;border:1px solid #e6ded2}.mobileStatsGrid span{display:block;font-size:9px;color:#77828c}.mobileStatsGrid strong{display:block;margin-top:4px;font-size:21px}
.mobileSectionTitle{margin:18px 2px 0}.mobileSectionTitle span{color:#a1782e}.mobileSectionTitle h2{margin:4px 0 0;font-size:19px;line-height:1.15}
.mobileActionGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:11px}.mobileActionCard{min-height:116px;display:flex;flex-direction:column;padding:14px;border-radius:17px;border:1px solid #e6ded2;background:#fff;color:#07182d;text-decoration:none;box-shadow:0 7px 18px rgba(7,24,45,.035)}.mobileActionCard>span{font-size:20px;line-height:1;color:#a1782e}.mobileActionCard>strong{margin-top:auto;font-size:13px}.mobileActionCard>small{margin-top:4px;font-size:9px;line-height:1.35;color:#76828c}.mobileActionCard.dark{background:#07182d;border-color:#07182d;color:#fff}.mobileActionCard.dark>span{color:#d6ac58}.mobileActionCard.dark>small{color:#b8c3cd}
.mobilePlanCard{margin-top:12px;padding:14px;border-radius:17px;background:#fff;border:1px solid #e6ded2}.mobilePlanCard>div>span{color:#a1782e}.mobilePlanCard>div>strong,.mobilePlanCard>div>small{display:block}.mobilePlanCard>div>strong{margin-top:4px;font-size:17px}.mobilePlanCard>div>small{margin-top:4px;font-size:10px;color:#75808a}.mobilePlanCard>a{display:flex;align-items:center;justify-content:space-between;margin-top:11px;min-height:43px;padding:0 12px;border-radius:12px;background:#f5f1ea;color:#07182d;text-decoration:none;font-size:11px;font-weight:900}.mobileMenuHint{margin:12px 3px 0;font-size:10px;color:#78838c;text-align:center}
.mobilePageHeading{padding:3px 2px 12px}.mobileBackLink{display:inline-block;margin-bottom:9px;color:#82601f;text-decoration:none;font-size:11px;font-weight:850}.mobilePageHeading>span{color:#a1782e}.mobilePageHeading h1{margin:4px 0 0;font-size:23px;line-height:1.08}.mobilePageHeading p{margin:6px 0 0;font-size:11px;line-height:1.45;color:#707d87}
.mobileOpenButton{width:100%;min-height:46px;margin:0 0 10px;border:0;border-radius:14px;background:#07182d;color:#fff;font-size:11px;font-weight:900;cursor:pointer}.mobileEmptyState{padding:18px;border:1px dashed #d7cdbf;border-radius:17px;background:#fff;color:#6e7b85;font-size:12px;text-align:center}
.mobileCollapsedModule{border:1px solid #e3dace;border-radius:17px;background:#fff;overflow:hidden}.mobileCollapsedModule>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;padding:0 14px;cursor:pointer}.mobileCollapsedModule>summary::-webkit-details-marker{display:none}.mobileCollapsedModule>summary strong{font-size:12px}.mobileCollapsedModule>summary span{font-size:22px;color:#a1782e}.mobileCollapsedModule[open]>summary span{transform:rotate(45deg)}.mobileCollapsedBody{padding:0 10px 10px}
.mobileFormCard{padding:3px}.buyerProfile.formClosed #perfil-compra form.propertyForm,.visitsModule.formClosed #agenda-visitas>form.propertyForm{display:none!important}
.livePropertiesOnly>.formNotice,.livePropertiesOnly>.adminMetrics,.livePropertiesOnly>#contatos{display:none!important}.liveContactsOnly>.formNotice,.liveContactsOnly>.adminMetrics,.liveContactsOnly>#imoveis,.liveContactsOnly>.editPanel{display:none!important}
.mobileModule .adminPanel{margin:0 0 10px!important;padding:13px!important;border-radius:17px!important;box-shadow:none!important;max-width:100%!important;overflow:hidden}.mobileModule .adminPanelHeader{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:7px!important}.mobileModule .adminPanelHeader h2,.mobileModule .adminPanelHeader h3{font-size:18px!important;line-height:1.12!important}.mobileModule .adminPanelHeader p{font-size:10px!important;line-height:1.4!important}.mobileModule .adminPanelTools,.mobileModule .adminActions,.mobileModule .accessActions,.mobileModule .tableActions{display:flex!important;flex-wrap:wrap!important;gap:6px!important;max-width:100%!important}
.mobileModule .adminMetrics,.mobileModule .statsGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.mobileModule .adminMetrics article,.mobileModule .statsGrid article{min-width:0!important;padding:10px!important}.mobileModule .adminMetrics strong,.mobileModule .statsGrid strong{font-size:18px!important}.mobileModule .adminMetrics span,.mobileModule .statsGrid span,.mobileModule .adminMetrics small{font-size:8px!important}
.mobileModule .formGrid,.mobileModule .formGrid.three,.mobileModule .formGrid.four,.mobileModule .grid2{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}.mobileModule .propertyForm{padding:10px!important;border-radius:14px!important}.mobileModule input,.mobileModule select,.mobileModule textarea{max-width:100%!important;min-width:0!important;font-size:12px!important}.mobileModule label{font-size:10px!important}.mobileModule .formActions{display:flex!important;flex-wrap:wrap!important;gap:7px!important}.mobileModule .button,.mobileModule .miniButton{min-height:40px!important;font-size:10px!important}
.mobileModule .adminTableWrap{width:100%!important;max-width:100%!important;overflow:visible!important}.mobileModule .adminTable{display:block!important;width:100%!important;min-width:0!important}.mobileModule .adminTable thead{display:none!important}.mobileModule .adminTable tbody{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;width:100%!important}.mobileModule .adminTable tr{display:flex!important;min-width:0!important;flex-direction:column!important;gap:2px!important;padding:10px!important;border:1px solid #e7dfd5!important;border-radius:14px!important;background:#fff!important}.mobileModule .adminTable td{display:block!important;width:auto!important;max-width:100%!important;padding:3px 0!important;border:0!important;font-size:9px!important;line-height:1.35!important;overflow-wrap:anywhere!important;white-space:normal!important}.mobileModule .adminTable td strong{font-size:10px!important}.mobileModule .adminTable select{width:100%!important}.mobileModule .tableSub{display:block!important;font-size:8px!important;line-height:1.35!important}
.mobileModule .leadGrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.mobileModule .leadCard{min-width:0!important;padding:10px!important;border-radius:14px!important}.mobileModule .leadCard p,.mobileModule .leadCard a,.mobileModule .leadCard textarea{font-size:9px!important}.mobileModule .accessList{display:grid!important;gap:8px!important}.mobileModule .accessRow{display:block!important;padding:10px!important;border-radius:14px!important}.mobileModule .accessIdentity strong{font-size:11px!important}.mobileModule .accessIdentity span,.mobileModule .accessIdentity small{font-size:9px!important;line-height:1.35!important}.mobileModule .domainPrimaryCard{display:block!important;padding:10px!important;border-radius:14px!important}.mobileModule .formNotice,.mobileModule .formMessage,.mobileModule .emptyMini{font-size:9px!important;line-height:1.4!important;padding:9px!important}
.mobileMenuLayer{position:fixed;inset:0;z-index:120;display:flex}.mobileMenuBackdrop{position:absolute;inset:0;border:0;background:rgba(3,11,21,.6)}.mobileMenuDrawer{position:relative;margin-left:auto;width:min(88vw,360px);height:100%;overflow-y:auto;padding:calc(env(safe-area-inset-top,0px) + 14px) 12px calc(env(safe-area-inset-bottom,0px) + 16px);background:#fff;box-shadow:-18px 0 42px rgba(3,11,21,.22)}.mobileDrawerHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:12px;border-bottom:1px solid #ebe3d8}.mobileDrawerBrand{display:flex;align-items:center;gap:8px;min-width:0}.mobileDrawerBrand img{width:38px;height:38px;object-fit:contain}.mobileDrawerBrand div{display:grid;min-width:0}.mobileDrawerBrand small{font-size:7px;font-weight:900;letter-spacing:1.2px;color:#a1782e}.mobileDrawerBrand strong{font-size:18px}.mobileDrawerBrand span{margin-top:2px;font-size:9px;color:#77828b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mobileCloseButton{width:40px;height:40px;flex:0 0 auto;border:0;border-radius:12px;background:#f3eee6;color:#07182d;font-size:26px;cursor:pointer}.mobileMenuList{display:grid;gap:6px;padding-top:10px}.mobileMenuList a{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:54px;padding:8px 11px;border-radius:13px;border:1px solid #eee7dd;background:#faf8f5;color:#07182d;text-decoration:none}.mobileMenuList a.active{background:#07182d;color:#fff;border-color:#07182d}.mobileMenuList a span{min-width:0}.mobileMenuList a strong,.mobileMenuList a small{display:block}.mobileMenuList a strong{font-size:11px}.mobileMenuList a small{margin-top:2px;font-size:8px;color:#7b8790}.mobileMenuList a.active small{color:#bdc7d0}.mobileMenuList a b{font-size:20px;color:#a1782e}.mobileSignOut{width:100%;min-height:45px;margin-top:10px;border:1px solid #ecd3d3;border-radius:12px;background:#fff5f5;color:#a13b3b;font-size:10px;font-weight:900;cursor:pointer}
@media(max-width:360px){.mobileAppContent{padding-left:10px;padding-right:10px}.mobileActionCard{min-height:108px;padding:11px}.mobileModule .adminTable tbody,.mobileModule .leadGrid{gap:6px}.mobileModule .adminTable tr{padding:8px}.mobileAppBrand strong{font-size:14px}}
`;
