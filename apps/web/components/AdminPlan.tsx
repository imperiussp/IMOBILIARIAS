"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Plan = {
  name: string;
  description: string | null;
  monthly_price: number | null;
  annual_price: number | null;
  max_properties: number | null;
  max_users: number | null;
  max_ai_descriptions: number | null;
  features: Record<string, unknown> | null;
};

type Subscription = {
  status: "trial" | "active" | "past_due" | "cancelled" | "expired";
  starts_at: string;
  renews_at: string | null;
  ends_at: string | null;
  subscription_plans: Plan | null;
};

const statusLabels: Record<Subscription["status"], string> = {
  trial: "Período de teste",
  active: "Ativo",
  past_due: "Pagamento pendente",
  cancelled: "Cancelado",
  expired: "Expirado",
};

function date(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function limit(value: number | null, suffix = "") {
  return value == null ? "Sem limite definido" : `${value.toLocaleString("pt-BR")}${suffix}`;
}

export default function AdminPlan() {
  const [agencyName, setAgencyName] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));

  async function load() {
    if (!supabaseBrowser) return;
    setLoading(true); setMessage("");
    const currentAgency = await getCurrentAgency();
    if (!currentAgency) {
      setLoading(false);
      setMessage("Não foi possível identificar a imobiliária desta conta.");
      return;
    }
    setAgencyName(currentAgency.agencyName);
    const { data, error } = await supabaseBrowser
      .from("agency_subscriptions")
      .select("status,starts_at,renews_at,ends_at,subscription_plans(name,description,monthly_price,annual_price,max_properties,max_users,max_ai_descriptions,features)")
      .eq("agency_id", currentAgency.agencyId)
      .in("status", ["trial", "active", "past_due"])
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLoading(false);
    if (error) return setMessage(error.message);
    setSubscription((data || null) as unknown as Subscription | null);
  }

  useEffect(() => { void load(); }, []);

  const plan = subscription?.subscription_plans || null;

  return <div className="adminPanel" id="meu-plano">
    <div className="adminPanelHeader"><div><span className="eyebrow">ASSINATURA</span><h2>Meu plano</h2><p>Plano e limites vinculados somente a {agencyName || "esta imobiliária"}.</p></div><span>{loading ? "Carregando..." : subscription ? statusLabels[subscription.status] : "Sem assinatura ativa"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">Os dados reais do plano aparecerão quando o Supabase de produção estiver conectado.</div> : null}
    {message ? <div className="formMessage">{message}</div> : null}
    {!loading && !message && !subscription ? <div className="emptyMini">Nenhum plano ativo foi vinculado a esta imobiliária ainda.</div> : null}
    {subscription && plan ? <div className="adminMetrics planMetrics">
      <article><span>Plano atual</span><strong>{plan.name}</strong><small>{plan.description || statusLabels[subscription.status]}</small></article>
      <article><span>Imóveis</span><strong>{limit(plan.max_properties)}</strong><small>Limite configurado no plano</small></article>
      <article><span>Usuários</span><strong>{limit(plan.max_users)}</strong><small>Equipe permitida</small></article>
      <article><span>Descrições com IA</span><strong>{limit(plan.max_ai_descriptions, "/mês")}</strong><small>Quando o recurso for ativado</small></article>
    </div> : null}
    {subscription ? <div className="domainPrimaryCard"><div><span className="eyebrow">VIGÊNCIA</span><strong>{statusLabels[subscription.status]}</strong><small>Início: {date(subscription.starts_at)} · Renovação: {date(subscription.renews_at)} · Término: {date(subscription.ends_at)}</small></div></div> : null}
  </div>;
}
