"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Agency = { id: string; name: string; slug: string; status: string };
type Plan = { id: string; name: string; code: string; active: boolean };
type Subscription = { id: string; agency_id: string; plan_id: string; status: string; starts_at: string; renews_at: string | null; ends_at: string | null };

const statusOptions = [
  ["trial", "Teste"],
  ["active", "Ativo"],
  ["past_due", "Pagamento pendente"],
  ["cancelled", "Cancelado"],
  ["expired", "Expirado"],
] as const;

const agencyStatusOptions = [
  ["trial", "Teste"],
  ["active", "Ativa"],
  ["past_due", "Pagamento pendente"],
  ["suspended", "Suspensa"],
  ["cancelled", "Cancelada"],
] as const;

function dateInput(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIso(value: string) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

export default function PlatformSubscriptionManager() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [planId, setPlanId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("active");
  const [renewsAt, setRenewsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabaseBrowser || !isSupabaseConfigured) return;
    const [agencyResult, planResult, subscriptionResult] = await Promise.all([
      supabaseBrowser.from("agencies").select("id,name,slug,status").order("name"),
      supabaseBrowser.from("subscription_plans").select("id,name,code,active").order("display_order").order("name"),
      supabaseBrowser.from("agency_subscriptions").select("id,agency_id,plan_id,status,starts_at,renews_at,ends_at").order("starts_at", { ascending: false }),
    ]);
    const error = agencyResult.error || planResult.error || subscriptionResult.error;
    if (error) return setMessage(error.message);
    setAgencies((agencyResult.data || []) as Agency[]);
    setPlans((planResult.data || []) as Plan[]);
    setSubscriptions((subscriptionResult.data || []) as Subscription[]);
    setAgencyId((current) => current || String(agencyResult.data?.[0]?.id || ""));
  }

  useEffect(() => { void load(); }, []);

  const currentSubscription = useMemo(() => subscriptions.find((item) => item.agency_id === agencyId && ["trial", "active", "past_due"].includes(item.status)) || null, [subscriptions, agencyId]);
  const selectedAgency = agencies.find((item) => item.id === agencyId) || null;

  useEffect(() => {
    if (!currentSubscription) {
      setPlanId(plans.find((plan) => plan.active)?.id || plans[0]?.id || "");
      setSubscriptionStatus("active");
      setRenewsAt(""); setEndsAt("");
      return;
    }
    setPlanId(currentSubscription.plan_id);
    setSubscriptionStatus(currentSubscription.status);
    setRenewsAt(dateInput(currentSubscription.renews_at));
    setEndsAt(dateInput(currentSubscription.ends_at));
  }, [agencyId, currentSubscription?.id, plans.length]);

  async function saveSubscription() {
    if (!supabaseBrowser || !agencyId || !planId) return setMessage("Selecione a imobiliária e o plano.");
    setSaving(true); setMessage("");
    const { error } = await supabaseBrowser.rpc("platform_set_agency_subscription", {
      p_agency_id: agencyId,
      p_plan_id: planId,
      p_status: subscriptionStatus,
      p_renews_at: toIso(renewsAt),
      p_ends_at: toIso(endsAt),
    });
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage("Assinatura atualizada com segurança.");
    await load();
  }

  async function changeAgencyStatus(status: string) {
    if (!supabaseBrowser || !agencyId) return;
    const label = agencyStatusOptions.find(([value]) => value === status)?.[1] || status;
    if (!window.confirm(`Alterar o status de ${selectedAgency?.name || "esta imobiliária"} para ${label}?`)) return;
    setSaving(true); setMessage("");
    const { error } = await supabaseBrowser.rpc("platform_set_agency_status", { p_agency_id: agencyId, p_status: status });
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(`Status da imobiliária alterado para ${label}.`);
    await load();
  }

  if (!isSupabaseConfigured) return <div className="adminPanel"><div className="adminPanelHeader"><div><span className="eyebrow">ASSINATURAS</span><h2>Gestão comercial</h2></div></div><div className="formNotice">A gestão real de assinaturas será ativada quando o Supabase exclusivo de produção estiver conectado.</div></div>;

  return <div className="adminPanel" id="assinaturas-plataforma">
    <div className="adminPanelHeader"><div><span className="eyebrow">ASSINATURAS</span><h2>Plano por imobiliária</h2><p>Troque plano, vigência e situação comercial sem dar à imobiliária permissão para alterar a própria assinatura.</p></div><span>{agencies.length} cliente(s)</span></div>
    <div className="propertyForm">
      <div className="formGrid"><label>Imobiliária<select value={agencyId} onChange={(event) => setAgencyId(event.target.value)}>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name} · {agency.slug}</option>)}</select></label><label>Status da imobiliária<select value={selectedAgency?.status || "trial"} onChange={(event) => void changeAgencyStatus(event.target.value)} disabled={!selectedAgency || saving}>{agencyStatusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="formGrid three"><label>Plano<select value={planId} onChange={(event) => setPlanId(event.target.value)}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.active ? "" : " · inativo"}</option>)}</select></label><label>Status da assinatura<select value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value)}>{statusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Assinatura atual<input value={currentSubscription ? `Desde ${new Date(currentSubscription.starts_at).toLocaleDateString("pt-BR")}` : "Sem assinatura ativa"} readOnly /></label></div>
      <div className="formGrid"><label>Próxima renovação<input type="date" value={renewsAt} onChange={(event) => setRenewsAt(event.target.value)} /></label><label>Término<input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label></div>
      <div className="formActions"><button className="button primary" type="button" disabled={saving || !agencyId || !planId} onClick={() => void saveSubscription()}>{saving ? "Salvando..." : "Salvar assinatura"}</button></div>
    </div>
    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
