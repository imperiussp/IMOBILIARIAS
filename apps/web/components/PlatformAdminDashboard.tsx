"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Agency = { id: string; name: string; slug: string; status: string; created_at: string };
type Domain = { agency_id: string; hostname: string; kind: string; is_primary: boolean; verified: boolean };
type Membership = { agency_id: string; active: boolean };
type Property = { agency_id: string; status: string };
type Subscription = { agency_id: string; status: string; plan_id: string | null };
type Plan = { id: string; name: string };

const demoAgencies: Agency[] = [
  { id: "demo-1", name: "João Imobiliária", slug: "joao-imobiliaria", status: "trial", created_at: new Date().toISOString() },
  { id: "demo-2", name: "Horizonte Imóveis", slug: "horizonte-imoveis", status: "active", created_at: new Date().toISOString() },
  { id: "demo-3", name: "Vale Sul Negócios", slug: "vale-sul", status: "active", created_at: new Date().toISOString() },
];

function statusLabel(status: string) {
  if (status === "active") return "Ativa";
  if (status === "trial") return "Teste";
  if (status === "past_due") return "Pagamento pendente";
  if (status === "suspended") return "Suspensa";
  return status;
}

export default function PlatformAdminDashboard() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabaseBrowser || !isSupabaseConfigured) {
      setAgencies(demoAgencies);
      setDomains([
        { agency_id: "demo-1", hostname: "joao-imobiliaria.imoveis.lenoy.com.br", kind: "platform", is_primary: true, verified: true },
        { agency_id: "demo-2", hostname: "www.horizonteimoveis.com.br", kind: "custom", is_primary: true, verified: true },
      ]);
      setMemberships([{ agency_id: "demo-1", active: true }, { agency_id: "demo-1", active: true }, { agency_id: "demo-2", active: true }, { agency_id: "demo-3", active: true }]);
      setProperties(Array.from({ length: 18 }, (_, index) => ({ agency_id: index < 6 ? "demo-1" : index < 13 ? "demo-2" : "demo-3", status: "available" })));
      return;
    }

    let active = true;
    void (async () => {
      const [agencyResult, domainResult, membershipResult, propertyResult, subscriptionResult, planResult] = await Promise.all([
        supabaseBrowser.from("agencies").select("id,name,slug,status,created_at").order("created_at", { ascending: false }),
        supabaseBrowser.from("agency_domains").select("agency_id,hostname,kind,is_primary,verified"),
        supabaseBrowser.from("agency_memberships").select("agency_id,active").eq("active", true),
        supabaseBrowser.from("properties").select("agency_id,status"),
        supabaseBrowser.from("agency_subscriptions").select("agency_id,status,plan_id"),
        supabaseBrowser.from("subscription_plans").select("id,name"),
      ]);
      if (!active) return;

      const firstError = agencyResult.error || domainResult.error || membershipResult.error || propertyResult.error || subscriptionResult.error || planResult.error;
      if (firstError) setMessage(firstError.message);
      setAgencies((agencyResult.data || []) as Agency[]);
      setDomains((domainResult.data || []) as Domain[]);
      setMemberships((membershipResult.data || []) as Membership[]);
      setProperties((propertyResult.data || []) as Property[]);
      setSubscriptions((subscriptionResult.data || []) as Subscription[]);
      setPlans((planResult.data || []) as Plan[]);
    })();
    return () => { active = false; };
  }, []);

  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan.name])), [plans]);
  const domainsByAgency = useMemo(() => new Map(agencies.map((agency) => [agency.id, domains.filter((domain) => domain.agency_id === agency.id)])), [agencies, domains]);
  const membersByAgency = useMemo(() => new Map(agencies.map((agency) => [agency.id, memberships.filter((member) => member.agency_id === agency.id).length])), [agencies, memberships]);
  const propertiesByAgency = useMemo(() => new Map(agencies.map((agency) => [agency.id, properties.filter((property) => property.agency_id === agency.id && property.status !== "inactive").length])), [agencies, properties]);
  const subscriptionByAgency = useMemo(() => new Map(subscriptions.filter((subscription) => ["trial", "active", "past_due"].includes(subscription.status)).map((subscription) => [subscription.agency_id, subscription])), [subscriptions]);

  const activeCount = agencies.filter((agency) => agency.status === "active").length;
  const trialCount = agencies.filter((agency) => agency.status === "trial").length;
  const pendingDomains = domains.filter((domain) => domain.kind === "custom" && !domain.verified).length;

  return <>
    <section className="platformMetrics">
      <article><span>Imobiliárias</span><strong>{agencies.length}</strong><small>{activeCount} ativas</small></article>
      <article><span>Em período de teste</span><strong>{trialCount}</strong><small>cadastros em onboarding</small></article>
      <article><span>Imóveis na plataforma</span><strong>{properties.filter((property) => property.status !== "inactive").length}</strong><small>todos os tenants</small></article>
      <article><span>Domínios pendentes</span><strong>{pendingDomains}</strong><small>aguardando verificação</small></article>
    </section>

    {message ? <div className="formMessage">Alguns dados globais não puderam ser carregados: {message}</div> : null}

    <section className="adminPanel" id="imobiliarias-plataforma">
      <div className="adminPanelHeader"><div><span className="eyebrow">CLIENTES DA PLATAFORMA</span><h2>Imobiliárias</h2><p>Visão global da operação SaaS. Esta área não usa o contexto de uma imobiliária específica.</p></div><span className="statusPill">{agencies.length} tenant(s)</span></div>
      <div className="adminTableWrap"><table className="adminTable platformTable"><thead><tr><th>Imobiliária</th><th>Status</th><th>Plano</th><th>Imóveis</th><th>Usuários</th><th>Domínio principal</th></tr></thead><tbody>
        {agencies.map((agency) => {
          const agencyDomains = domainsByAgency.get(agency.id) || [];
          const primaryDomain = agencyDomains.find((domain) => domain.is_primary) || agencyDomains[0];
          const subscription = subscriptionByAgency.get(agency.id);
          return <tr key={agency.id}>
            <td><strong>{agency.name}</strong><small className="tableSub">{agency.slug}.imoveis.lenoy.com.br</small></td>
            <td><span className={`platformStatus platformStatus-${agency.status}`}>{statusLabel(agency.status)}</span></td>
            <td>{subscription?.plan_id ? planById.get(subscription.plan_id) || "Plano configurado" : "Sem plano definido"}</td>
            <td>{propertiesByAgency.get(agency.id) || 0}</td>
            <td>{membersByAgency.get(agency.id) || 0}</td>
            <td>{primaryDomain ? <><strong>{primaryDomain.hostname}</strong><small className="tableSub">{primaryDomain.verified ? "Verificado" : "Pendente"}</small></> : "—"}</td>
          </tr>;
        })}
        {!agencies.length ? <tr><td colSpan={6}>Nenhuma imobiliária cadastrada.</td></tr> : null}
      </tbody></table></div>
    </section>
  </>;
}
