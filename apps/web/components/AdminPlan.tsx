"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Plan = {
  name: string;
  description: string | null;
};

type Subscription = {
  status: "trial" | "active" | "past_due" | "cancelled" | "expired";
  starts_at: string;
  renews_at: string | null;
  ends_at: string | null;
  subscription_plans: Plan | null;
};

type Usage = {
  plan_name: string;
  subscription_status: string;
  max_properties: number | null;
  used_properties: number;
  max_users: number | null;
  used_users: number;
  max_ai_descriptions: number | null;
  used_ai_descriptions: number;
  renews_at: string | null;
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

function usageText(used: number, maximum: number | null, suffix = "") {
  const usedText = Number(used || 0).toLocaleString("pt-BR");
  if (maximum == null) return `${usedText}${suffix}`;
  return `${usedText} / ${maximum.toLocaleString("pt-BR")}${suffix}`;
}

export default function AdminPlan() {
  const [agencyName, setAgencyName] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
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

    const [subscriptionResult, usageResult] = await Promise.all([
      supabaseBrowser
        .from("agency_subscriptions")
        .select("status,starts_at,renews_at,ends_at,subscription_plans(name,description)")
        .eq("agency_id", currentAgency.agencyId)
        .in("status", ["trial", "active", "past_due"])
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseBrowser.rpc("agency_usage_snapshot", { p_agency_id: currentAgency.agencyId }),
    ]);

    setLoading(false);
    if (subscriptionResult.error) return setMessage(subscriptionResult.error.message);
    if (usageResult.error && usageResult.error.code !== "42883") return setMessage(usageResult.error.message);

    setSubscription((subscriptionResult.data || null) as unknown as Subscription | null);
    const usageRows = Array.isArray(usageResult.data) ? usageResult.data : [];
    setUsage((usageRows[0] || null) as Usage | null);
  }

  useEffect(() => { void load(); }, []);

  const plan = subscription?.subscription_plans || null;
  const propertyLimitReached = Boolean(usage?.max_properties != null && usage.used_properties >= usage.max_properties);
  const userLimitReached = Boolean(usage?.max_users != null && usage.used_users >= usage.max_users);
  const aiLimitReached = Boolean(usage?.max_ai_descriptions != null && usage.used_ai_descriptions >= usage.max_ai_descriptions);

  return <div className="adminPanel" id="meu-plano">
    <div className="adminPanelHeader"><div><span className="eyebrow">ASSINATURA</span><h2>Meu plano</h2><p>Plano, vigência e consumo vinculados somente a {agencyName || "esta imobiliária"}.</p></div><span>{loading ? "Carregando..." : subscription ? statusLabels[subscription.status] : "Sem assinatura ativa"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">Os dados reais do plano aparecerão quando o Supabase de produção estiver conectado.</div> : null}
    {message ? <div className="formMessage">{message}</div> : null}
    {!loading && !message && !subscription ? <div className="emptyMini">Nenhum plano ativo foi vinculado a esta imobiliária ainda.</div> : null}
    {subscription && plan ? <div className="adminMetrics planMetrics">
      <article><span>Plano atual</span><strong>{plan.name}</strong><small>{plan.description || statusLabels[subscription.status]}</small></article>
      <article><span>Imóveis em uso</span><strong>{usage ? usageText(usage.used_properties, usage.max_properties) : "—"}</strong><small>{propertyLimitReached ? "Limite atingido" : "Ativos dentro do limite do plano"}</small></article>
      <article><span>Usuários em uso</span><strong>{usage ? usageText(usage.used_users, usage.max_users) : "—"}</strong><small>{userLimitReached ? "Limite atingido" : "Contas ativas da equipe"}</small></article>
      <article><span>Descrições com IA</span><strong>{usage ? usageText(usage.used_ai_descriptions, usage.max_ai_descriptions, "/mês") : "—"}</strong><small>{aiLimitReached ? "Limite mensal atingido" : "Contador mensal preparado para a IA"}</small></article>
    </div> : null}
    {subscription ? <div className="domainPrimaryCard"><div><span className="eyebrow">VIGÊNCIA</span><strong>{statusLabels[subscription.status]}</strong><small>Início: {date(subscription.starts_at)} · Renovação: {date(subscription.renews_at)} · Término: {date(subscription.ends_at)}</small></div></div> : null}
    {propertyLimitReached ? <div className="formNotice">Limite de imóveis atingido. O sistema bloqueia novos imóveis ativos até liberar espaço ou alterar o plano.</div> : null}
    {userLimitReached ? <div className="formNotice">Limite de usuários atingido. O sistema bloqueia a ativação de novos membros até liberar espaço ou alterar o plano.</div> : null}
    {aiLimitReached ? <div className="formNotice">Limite mensal de descrições com IA atingido. Uma nova geração ficará disponível após renovação do ciclo ou mudança de plano.</div> : null}
  </div>;
}
