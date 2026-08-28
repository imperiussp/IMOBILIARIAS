"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Agency = { id: string; name: string; slug: string; status: string };
type Plan = { id: string; name: string; code: string; active: boolean; monthly_price: number | null; annual_price: number | null; implementation_fee: number | null };
type Subscription = { id: string; agency_id: string; plan_id: string; status: string; starts_at: string; renews_at: string | null; ends_at: string | null };
type Discount = { id: string; agency_id: string; plan_id: string; billing_cycle: "monthly" | "annual"; base_amount: number; final_amount: number; discount_percent: number; status: string; created_at: string };

const statusOptions = [
  ["trial", "Teste"],
  ["active", "Ativo"],
  ["past_due", "Pagamento pendente"],
  ["cancelled", "Cancelado"],
  ["expired", "Expirado"],
] as const;

const agencyStatusOptions = [
  ["trial", "Cadastro / aguardando ativação"],
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
function toIso(value: string) { return value ? new Date(`${value}T12:00:00`).toISOString() : null; }
function money(value: number | null | undefined) { return value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)); }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

export default function PlatformSubscriptionManager() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [planId, setPlanId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("active");
  const [renewsAt, setRenewsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [discountCycle, setDiscountCycle] = useState<"monthly" | "annual">("monthly");
  const [finalAmount, setFinalAmount] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabaseBrowser || !isSupabaseConfigured) return;
    const [agencyResult, planResult, subscriptionResult, discountResult] = await Promise.all([
      supabaseBrowser.from("agencies").select("id,name,slug,status").order("name"),
      supabaseBrowser.from("subscription_plans").select("id,name,code,active,monthly_price,annual_price,implementation_fee").order("display_order").order("name"),
      supabaseBrowser.from("agency_subscriptions").select("id,agency_id,plan_id,status,starts_at,renews_at,ends_at").order("starts_at", { ascending: false }),
      supabaseBrowser.from("agency_billing_discounts").select("id,agency_id,plan_id,billing_cycle,base_amount,final_amount,discount_percent,status,created_at").eq("status", "active").order("created_at", { ascending: false }),
    ]);
    const error = agencyResult.error || planResult.error || subscriptionResult.error || discountResult.error;
    if (error) return setMessage(error.message);
    setAgencies((agencyResult.data || []) as Agency[]);
    setPlans((planResult.data || []) as Plan[]);
    setSubscriptions((subscriptionResult.data || []) as Subscription[]);
    setDiscounts((discountResult.data || []) as Discount[]);
    setAgencyId((current) => current || String(agencyResult.data?.[0]?.id || ""));
  }

  useEffect(() => { void load(); }, []);

  const currentSubscription = useMemo(() => subscriptions.find((item) => item.agency_id === agencyId && ["trial", "active", "past_due"].includes(item.status)) || null, [subscriptions, agencyId]);
  const selectedAgency = agencies.find((item) => item.id === agencyId) || null;
  const selectedPlan = plans.find((item) => item.id === planId) || null;
  const basePrice = selectedPlan ? Number(discountCycle === "annual" ? selectedPlan.annual_price || 0 : selectedPlan.monthly_price || 0) : 0;
  const currentDiscount = discounts.find((item) => item.agency_id === agencyId && item.plan_id === planId && item.billing_cycle === discountCycle && item.status === "active") || null;

  useEffect(() => {
    if (!currentSubscription) {
      setPlanId((current) => current || plans.find((plan) => plan.active && plan.code !== "homologacao")?.id || plans.find((plan) => plan.active)?.id || plans[0]?.id || "");
      setSubscriptionStatus("active");
      setRenewsAt(""); setEndsAt("");
      return;
    }
    setPlanId(currentSubscription.plan_id);
    setSubscriptionStatus(currentSubscription.status);
    setRenewsAt(dateInput(currentSubscription.renews_at));
    setEndsAt(dateInput(currentSubscription.ends_at));
  }, [agencyId, currentSubscription?.id, plans.length]);

  useEffect(() => {
    if (!basePrice) { setFinalAmount(""); setDiscountPercent("0"); return; }
    if (currentDiscount) {
      setFinalAmount(Number(currentDiscount.final_amount).toFixed(2));
      setDiscountPercent(Number(currentDiscount.discount_percent).toFixed(2));
    } else {
      setFinalAmount(basePrice.toFixed(2));
      setDiscountPercent("0.00");
    }
  }, [agencyId, planId, discountCycle, currentDiscount?.id, basePrice]);

  function changeFinalAmount(text: string) {
    setFinalAmount(text);
    const value = Number(text.replace(",", "."));
    if (!basePrice || !Number.isFinite(value)) return setDiscountPercent("0.00");
    const percent = clamp(((basePrice - value) / basePrice) * 100, 0, 99.99);
    setDiscountPercent(percent.toFixed(2));
  }

  function changeDiscountPercent(text: string) {
    setDiscountPercent(text);
    const percent = Number(text.replace(",", "."));
    if (!basePrice || !Number.isFinite(percent)) return;
    const safe = clamp(percent, 0, 99.99);
    setFinalAmount((basePrice * (1 - safe / 100)).toFixed(2));
  }

  async function saveDiscount() {
    if (!supabaseBrowser || !agencyId || !planId || !basePrice) return setMessage("Selecione cliente, plano e ciclo com preço configurado.");
    const final = Number(finalAmount.replace(",", "."));
    if (!Number.isFinite(final) || final <= 0 || final > basePrice) return setMessage("Informe um valor final maior que zero e menor ou igual ao valor normal do plano.");
    setSaving(true); setMessage("");
    const { error } = await supabaseBrowser.rpc("platform_set_agency_billing_discount", { p_agency_id: agencyId, p_plan_id: planId, p_billing_cycle: discountCycle, p_final_amount: final });
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(final === basePrice ? "Valor normal restaurado." : `Desconto salvo: ${discountPercent}% · próximo ${discountCycle === "annual" ? "anual" : "mensal"} por ${money(final)}.`);
    await load();
  }

  async function clearDiscount() {
    if (!supabaseBrowser || !agencyId || !planId) return;
    setSaving(true); setMessage("");
    const { error } = await supabaseBrowser.rpc("platform_clear_agency_billing_discount", { p_agency_id: agencyId, p_plan_id: planId, p_billing_cycle: discountCycle });
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage("Desconto removido. A próxima cobrança volta ao valor normal do plano.");
    await load();
  }

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
    <div className="adminPanelHeader"><div><span className="eyebrow">ASSINATURAS</span><h2>Plano, cobrança e desconto por cliente</h2><p>O desconto é controlado pela LENOY e vale para a próxima cobrança do ciclo escolhido. Depois do pagamento confirmado, ele é consumido e a renovação seguinte volta ao preço normal.</p></div><span>{agencies.length} cliente(s)</span></div>
    <div className="propertyForm">
      <div className="formGrid"><label>Imobiliária / corretor<select value={agencyId} onChange={(event) => setAgencyId(event.target.value)}>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name} · {agency.slug}</option>)}</select></label><label>Status da imobiliária<select value={selectedAgency?.status || "trial"} onChange={(event) => void changeAgencyStatus(event.target.value)} disabled={!selectedAgency || saving}>{agencyStatusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="formGrid three"><label>Plano<select value={planId} onChange={(event) => setPlanId(event.target.value)}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.active ? "" : " · inativo"}</option>)}</select></label><label>Status da assinatura<select value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value)}>{statusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Assinatura atual<input value={currentSubscription ? `Desde ${new Date(currentSubscription.starts_at).toLocaleDateString("pt-BR")}` : "Sem assinatura ativa"} readOnly /></label></div>
      <div className="formGrid"><label>Próxima renovação<input type="date" value={renewsAt} onChange={(event) => setRenewsAt(event.target.value)} /></label><label>Término<input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label></div>
      <div className="formActions"><button className="button primary" type="button" disabled={saving || !agencyId || !planId} onClick={() => void saveSubscription()}>{saving ? "Salvando..." : "Salvar assinatura"}</button></div>
    </div>

    <div className="platformDiscountEditor">
      <div className="adminPanelHeader"><div><span className="eyebrow">DESCONTO INDIVIDUAL</span><h3>Alterar valor ou porcentagem</h3><p>Digite o valor que deseja cobrar e a porcentagem aparece automaticamente. Ou altere a porcentagem e o valor é recalculado.</p></div>{currentDiscount ? <span className="statusPill">Desconto ativo</span> : <span className="statusPill muted">Valor normal</span>}</div>
      <div className="formGrid three"><label>Ciclo do desconto<select value={discountCycle} onChange={(event) => setDiscountCycle(event.target.value as "monthly" | "annual")}><option value="monthly">Mensal</option><option value="annual">Anual · já inclui 25% OFF</option></select></label><label>Valor normal<input value={money(basePrice)} readOnly /></label><label>Implantação<input value={discountCycle === "annual" ? "GRÁTIS no anual" : selectedPlan ? `${money(selectedPlan.implementation_fee)} · pagamento único` : "—"} readOnly /></label></div>
      <div className="formGrid"><label>Valor que o cliente vai pagar (R$)<input type="number" min="0.01" step="0.01" value={finalAmount} onChange={(event) => changeFinalAmount(event.target.value)} /></label><label>Desconto (%)<input type="number" min="0" max="99.99" step="0.01" value={discountPercent} onChange={(event) => changeDiscountPercent(event.target.value)} /></label></div>
      <div className="discountLiveSummary"><strong>{Number(discountPercent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% de desconto</strong><span>{money(basePrice)} → <b>{money(Number(finalAmount || basePrice))}</b></span><small>{discountCycle === "annual" ? "O valor anual base já contém o desconto comercial padrão de 25%. O desconto individual acima é adicional." : "No primeiro acesso mensal, a implantação é cobrada separadamente. Este desconto fica reservado para a próxima mensalidade do plano."}</small></div>
      <div className="formActions"><button className="button secondary" type="button" disabled={saving || !currentDiscount} onClick={() => void clearDiscount()}>Restaurar valor do plano</button><button className="button primary" type="button" disabled={saving || !agencyId || !planId || !basePrice} onClick={() => void saveDiscount()}>{saving ? "Salvando..." : "Aplicar desconto"}</button></div>
    </div>

    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
