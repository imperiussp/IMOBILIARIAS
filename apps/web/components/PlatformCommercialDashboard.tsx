"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Agency = { id: string; name: string; slug: string; email: string | null; status: string; created_at: string };
type BillingProfile = { agency_id: string; implementation_status: string; billing_cycle: string | null };
type Subscription = { id: string; agency_id: string; plan_id: string; status: string; starts_at: string; renews_at: string | null; ends_at: string | null; billing_cycle: string | null };
type Plan = { id: string; name: string; code: string; monthly_price: number | null; annual_price: number | null; implementation_fee: number | null; active: boolean };
type Checkout = { id: string; agency_id: string; plan_id: string; status: string; amount: number | null; paid_amount: number | null; base_amount: number | null; discount_percent: number | null; billing_cycle: string | null; charge_type: string | null; created_at: string; completed_at: string | null };
type Discount = { id: string; agency_id: string; plan_id: string; billing_cycle: "monthly" | "annual"; base_amount: number; final_amount: number; discount_percent: number; status: string };

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}
function date(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("pt-BR");
}
function dateInput(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}
function toIso(value: string) { return value ? new Date(`${value}T12:00:00`).toISOString() : null; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function agencyStatus(status: string) {
  if (status === "active") return "Ativo";
  if (status === "pending_payment") return "Aguardando pagamento";
  if (status === "trial") return "Conta interna";
  if (status === "past_due") return "Pagamento atrasado";
  if (status === "suspended") return "Suspenso";
  if (status === "cancelled") return "Cancelado";
  return status || "—";
}
function subscriptionStatus(status: string | undefined) {
  if (!status) return "Sem assinatura";
  if (status === "active") return "Ativa";
  if (status === "trial") return "Conta interna";
  if (status === "past_due") return "Pagamento atrasado";
  if (status === "cancelled") return "Cancelada";
  if (status === "expired") return "Encerrada";
  return status;
}
function cycleLabel(cycle: string | null | undefined) {
  if (cycle === "annual") return "Anual";
  if (cycle === "monthly") return "Mensal";
  return "—";
}
function implementationLabel(status: string | undefined, cycle: string | null | undefined) {
  if (cycle === "annual" && status === "waived") return "Grátis no anual";
  if (status === "paid") return "Paga";
  if (status === "waived") return "Grátis";
  if (status === "pending") return "Pendente";
  return "—";
}
function paymentStatus(status: string | undefined) {
  if (!status) return "Sem cobrança";
  if (status === "paid") return "Pagamento confirmado";
  if (status === "created" || status === "pending") return "Aguardando pagamento";
  if (status === "failed") return "Não concluído";
  if (status === "expired") return "Expirado";
  if (status === "cancelled") return "Cancelado";
  return status;
}
function chargeLabel(charge: string | null | undefined, cycle: string | null | undefined) {
  if (charge === "implementation") return "Implantação";
  if (cycle === "annual") return "Plano anual";
  return "Mensalidade";
}

function ClientEditor({ agency, profile, subscription, plans, latestCheckout, discount, onSaved }: {
  agency: Agency;
  profile: BillingProfile | undefined;
  subscription: Subscription | undefined;
  plans: Plan[];
  latestCheckout: Checkout | undefined;
  discount: Discount | undefined;
  onSaved: () => Promise<void>;
}) {
  const currentPlan = plans.find((plan) => plan.id === subscription?.plan_id) || null;
  const commercialPlans = plans.filter((plan) => plan.code !== "homologacao" && plan.active);
  const [name, setName] = useState(agency.name);
  const [createdAt, setCreatedAt] = useState(dateInput(agency.created_at));
  const [agencyAccess, setAgencyAccess] = useState(agency.status || "pending_payment");
  const [planId, setPlanId] = useState(subscription?.plan_id || commercialPlans[0]?.id || "");
  const [subscriptionState, setSubscriptionState] = useState(subscription?.status || "none");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">((subscription?.billing_cycle || profile?.billing_cycle || "monthly") as "monthly" | "annual");
  const [implementation, setImplementation] = useState(profile?.implementation_status || "pending");
  const [renewsAt, setRenewsAt] = useState(dateInput(subscription?.renews_at));
  const [endsAt, setEndsAt] = useState(dateInput(subscription?.ends_at));
  const [finalAmount, setFinalAmount] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0.00");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedPlan = plans.find((plan) => plan.id === planId) || null;
  const basePrice = selectedPlan ? Number(billingCycle === "annual" ? selectedPlan.annual_price || 0 : selectedPlan.monthly_price || 0) : 0;
  const matchingDiscount = discount && discount.plan_id === planId && discount.billing_cycle === billingCycle ? discount : null;

  useEffect(() => {
    setName(agency.name);
    setCreatedAt(dateInput(agency.created_at));
    setAgencyAccess(agency.status || "pending_payment");
    setPlanId(subscription?.plan_id || commercialPlans[0]?.id || "");
    setSubscriptionState(subscription?.status || "none");
    setBillingCycle((subscription?.billing_cycle || profile?.billing_cycle || "monthly") as "monthly" | "annual");
    setImplementation(profile?.implementation_status || "pending");
    setRenewsAt(dateInput(subscription?.renews_at));
    setEndsAt(dateInput(subscription?.ends_at));
  }, [agency.id, agency.name, agency.created_at, agency.status, subscription?.id, profile?.implementation_status, profile?.billing_cycle]);

  useEffect(() => {
    if (!basePrice) { setFinalAmount(""); setDiscountPercent("0.00"); return; }
    if (matchingDiscount) {
      setFinalAmount(Number(matchingDiscount.final_amount).toFixed(2));
      setDiscountPercent(Number(matchingDiscount.discount_percent).toFixed(2));
    } else {
      setFinalAmount(basePrice.toFixed(2));
      setDiscountPercent("0.00");
    }
  }, [planId, billingCycle, basePrice, matchingDiscount?.id]);

  function changeFinal(text: string) {
    setFinalAmount(text);
    const value = Number(text.replace(",", "."));
    if (!basePrice || !Number.isFinite(value)) return setDiscountPercent("0.00");
    setDiscountPercent(clamp(((basePrice - value) / basePrice) * 100, 0, 99.99).toFixed(2));
  }
  function changePercent(text: string) {
    setDiscountPercent(text);
    const percent = Number(text.replace(",", "."));
    if (!basePrice || !Number.isFinite(percent)) return;
    const safe = clamp(percent, 0, 99.99);
    setFinalAmount((basePrice * (1 - safe / 100)).toFixed(2));
  }

  async function save() {
    if (!supabaseBrowser) return;
    if (!name.trim()) return setMessage("Informe o nome do cliente.");
    if (subscriptionState !== "none" && !planId) return setMessage("Selecione um plano.");
    setSaving(true); setMessage("");
    const profileSave = await supabaseBrowser.rpc("platform_update_agency_commercial", {
      p_agency_id: agency.id,
      p_name: name.trim(),
      p_created_at: toIso(createdAt),
      p_agency_status: agencyAccess,
      p_plan_id: planId || null,
      p_subscription_status: subscriptionState,
      p_billing_cycle: billingCycle,
      p_implementation_status: implementation,
      p_renews_at: toIso(renewsAt),
      p_ends_at: toIso(endsAt),
    });
    if (profileSave.error) { setSaving(false); return setMessage(profileSave.error.message); }

    if (planId && basePrice > 0 && subscriptionState !== "none") {
      const final = Number(finalAmount.replace(",", "."));
      if (!Number.isFinite(final) || final <= 0 || final > basePrice) { setSaving(false); return setMessage("Dados principais salvos. Corrija o valor da próxima cobrança."); }
      const discountSave = final < basePrice
        ? await supabaseBrowser.rpc("platform_set_agency_billing_discount", { p_agency_id: agency.id, p_plan_id: planId, p_billing_cycle: billingCycle, p_final_amount: final })
        : await supabaseBrowser.rpc("platform_clear_agency_billing_discount", { p_agency_id: agency.id, p_plan_id: planId, p_billing_cycle: billingCycle });
      if (discountSave.error) { setSaving(false); return setMessage(`Dados do cliente salvos, mas o desconto não foi alterado: ${discountSave.error.message}`); }
    }

    setSaving(false);
    setMessage("Cliente atualizado.");
    await onSaved();
  }

  return <div className="commercialClientEditor">
    <div className="commercialEditorGrid two">
      <label>Nome do cliente<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Data do cadastro<input type="date" value={createdAt} onChange={(event) => setCreatedAt(event.target.value)} /></label>
    </div>
    <div className="commercialEditorGrid three">
      <label>Plano<select value={planId} onChange={(event) => setPlanId(event.target.value)}>
        {!planId ? <option value="">Selecione</option> : null}
        {currentPlan?.code === "homologacao" ? <option value={currentPlan.id}>Conta interna atual</option> : null}
        {commercialPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
      </select></label>
      <label>Cobrança<select value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as "monthly" | "annual")}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></label>
      <label>Implantação<select value={implementation} onChange={(event) => setImplementation(event.target.value)}><option value="pending">Pendente</option><option value="paid">Paga</option><option value="waived">Grátis / dispensada</option></select></label>
    </div>
    <div className="commercialEditorGrid three">
      <label>Assinatura<select value={subscriptionState} onChange={(event) => setSubscriptionState(event.target.value)}><option value="none">Sem assinatura</option><option value="active">Ativa</option><option value="past_due">Pagamento atrasado</option><option value="cancelled">Cancelada</option><option value="expired">Encerrada</option><option value="trial">Conta interna / teste</option></select></label>
      <label>Acesso<select value={agencyAccess} onChange={(event) => setAgencyAccess(event.target.value)}><option value="pending_payment">Aguardando pagamento</option><option value="active">Liberado</option><option value="past_due">Pagamento atrasado</option><option value="suspended">Suspenso</option><option value="cancelled">Cancelado</option><option value="trial">Conta interna / teste</option></select></label>
      <label>Preço normal<input value={money(basePrice)} readOnly /></label>
    </div>
    <div className="commercialEditorGrid two">
      <label>Próximo vencimento<input type="date" value={renewsAt} onChange={(event) => setRenewsAt(event.target.value)} /></label>
      <label>Fim do acesso / assinatura<input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
    </div>
    <div className="commercialDiscountInline">
      <div><strong>Valor da próxima cobrança</strong><small>Altere o valor ou a porcentagem; um campo recalcula o outro.</small></div>
      <label>Valor (R$)<input type="number" min="0.01" step="0.01" value={finalAmount} onChange={(event) => changeFinal(event.target.value)} /></label>
      <label>Desconto (%)<input type="number" min="0" max="99.99" step="0.01" value={discountPercent} onChange={(event) => changePercent(event.target.value)} /></label>
    </div>
    <div className="commercialBillingSnapshot">
      <strong>Dados da cobrança mais recente</strong>
      {latestCheckout ? <div className="commercialBillingSnapshotGrid">
        <span><small>Tipo</small><b>{chargeLabel(latestCheckout.charge_type, latestCheckout.billing_cycle)}</b></span>
        <span><small>Status</small><b>{paymentStatus(latestCheckout.status)}</b></span>
        <span><small>Valor normal</small><b>{money(latestCheckout.base_amount ?? latestCheckout.amount)}</b></span>
        <span><small>Valor cobrado</small><b>{money(latestCheckout.paid_amount ?? latestCheckout.amount)}</b></span>
        <span><small>Data</small><b>{date(latestCheckout.completed_at || latestCheckout.created_at)}</b></span>
      </div> : <small>Nenhuma cobrança registrada para este cliente.</small>}
    </div>
    <div className="commercialEditorActions">
      <button className="button primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? "Salvando..." : "Salvar alterações"}</button>
    </div>
    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}

export default function PlatformCommercialDashboard() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [profiles, setProfiles] = useState<BillingProfile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    if (!supabaseBrowser || !isSupabaseConfigured) return;
    const [agencyResult, profileResult, subscriptionResult, planResult, checkoutResult, discountResult] = await Promise.all([
      supabaseBrowser.from("agencies").select("id,name,slug,email,status,created_at").order("created_at", { ascending: false }),
      supabaseBrowser.from("agency_billing_profiles").select("agency_id,implementation_status,billing_cycle"),
      supabaseBrowser.from("agency_subscriptions").select("id,agency_id,plan_id,status,starts_at,renews_at,ends_at,billing_cycle").order("starts_at", { ascending: false }),
      supabaseBrowser.from("subscription_plans").select("id,name,code,monthly_price,annual_price,implementation_fee,active").order("display_order"),
      supabaseBrowser.from("billing_checkout_sessions").select("id,agency_id,plan_id,status,amount,paid_amount,base_amount,discount_percent,billing_cycle,charge_type,created_at,completed_at").order("created_at", { ascending: false }).limit(300),
      supabaseBrowser.from("agency_billing_discounts").select("id,agency_id,plan_id,billing_cycle,base_amount,final_amount,discount_percent,status").eq("status", "active"),
    ]);
    const error = agencyResult.error || profileResult.error || subscriptionResult.error || planResult.error || checkoutResult.error || discountResult.error;
    if (error) return setMessage(error.message);
    setAgencies((agencyResult.data || []) as Agency[]);
    setProfiles((profileResult.data || []) as BillingProfile[]);
    setSubscriptions((subscriptionResult.data || []) as Subscription[]);
    setPlans((planResult.data || []) as Plan[]);
    setCheckouts((checkoutResult.data || []) as Checkout[]);
    setDiscounts((discountResult.data || []) as Discount[]);
  }

  useEffect(() => { void load(); }, []);

  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const profileByAgency = useMemo(() => new Map(profiles.map((profile) => [profile.agency_id, profile])), [profiles]);
  const currentSubscriptionByAgency = useMemo(() => {
    const result = new Map<string, Subscription>();
    subscriptions.forEach((item) => { if (!result.has(item.agency_id)) result.set(item.agency_id, item); });
    return result;
  }, [subscriptions]);
  const latestCheckoutByAgency = useMemo(() => {
    const result = new Map<string, Checkout>();
    checkouts.forEach((item) => { if (!result.has(item.agency_id)) result.set(item.agency_id, item); });
    return result;
  }, [checkouts]);

  const active = agencies.filter((agency) => agency.status === "active").length;
  const awaitingPayment = agencies.filter((agency) => agency.status === "pending_payment").length;
  const overdue = agencies.filter((agency) => ["past_due", "suspended"].includes(agency.status)).length;
  const monthly = agencies.filter((agency) => {
    const subscription = currentSubscriptionByAgency.get(agency.id);
    return subscription?.status === "active" && (subscription.billing_cycle || profileByAgency.get(agency.id)?.billing_cycle) === "monthly";
  }).length;
  const annual = agencies.filter((agency) => {
    const subscription = currentSubscriptionByAgency.get(agency.id);
    return subscription?.status === "active" && (subscription.billing_cycle || profileByAgency.get(agency.id)?.billing_cycle) === "annual";
  }).length;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const paidThisMonth = checkouts.filter((checkout) => checkout.status === "paid" && new Date(checkout.completed_at || checkout.created_at).getTime() >= monthStart && new Date(checkout.completed_at || checkout.created_at).getTime() < nextMonthStart);
  const revenueThisMonth = paidThisMonth.reduce((sum, checkout) => sum + Number(checkout.paid_amount ?? checkout.amount ?? 0), 0);
  const pendingPayments = checkouts.filter((checkout) => ["created", "pending"].includes(checkout.status)).length;

  return <>
    <section className="commercialSummary" id="resumo-comercial">
      <article><span>Clientes</span><strong>{agencies.length}</strong><small>cadastrados</small></article>
      <article><span>Ativos</span><strong>{active}</strong><small>acesso liberado</small></article>
      <article className={awaitingPayment ? "attention" : ""}><span>Aguardando</span><strong>{awaitingPayment}</strong><small>pagamento</small></article>
      <article><span>Mensalistas</span><strong>{monthly}</strong><small>assinaturas ativas</small></article>
      <article><span>Anuais</span><strong>{annual}</strong><small>assinaturas ativas</small></article>
      <article className={overdue ? "danger" : ""}><span>Inadimplentes</span><strong>{overdue}</strong><small>ou suspensos</small></article>
      <article><span>Recebido no mês</span><strong>{money(revenueThisMonth)}</strong><small>{paidThisMonth.length} pagamento(s)</small></article>
      <article className={pendingPayments ? "attention" : ""}><span>Pendentes</span><strong>{pendingPayments}</strong><small>cobranças abertas</small></article>
    </section>

    {message ? <div className="formMessage">Não foi possível carregar todos os dados comerciais: {message}</div> : null}

    <section className="adminPanel commercialClientsPanel" id="clientes-comerciais">
      <div className="adminPanelHeader"><div><span className="eyebrow">CLIENTES</span><h2>Cadastros, compras e acesso</h2><p>Abra um cliente para alterar plano, cobrança, implantação, vencimento, acesso e desconto.</p></div><span className="statusPill">{agencies.length} cliente(s)</span></div>
      <div className="commercialClientGrid">
        {agencies.map((agency) => {
          const profile = profileByAgency.get(agency.id);
          const subscription = currentSubscriptionByAgency.get(agency.id);
          const plan = subscription ? planById.get(subscription.plan_id) : null;
          const cycle = subscription?.billing_cycle || profile?.billing_cycle;
          const latestCheckout = latestCheckoutByAgency.get(agency.id);
          const discount = discounts.find((item) => item.agency_id === agency.id && item.plan_id === subscription?.plan_id && item.billing_cycle === cycle);
          const displayPlan = plan?.code === "homologacao" ? "Conta interna" : plan?.name || "Ainda não escolhido";
          return <article className={`commercialClientCard ${editingId === agency.id ? "isEditing" : ""}`} key={agency.id}>
            <header className="commercialClientHeader">
              <div><strong>{agency.name}</strong><span>{agency.email || "Sem e-mail"}</span><small>{agency.slug}.imoveis.lenoy.com.br</small></div>
              <span className={`commercialStatus agency-${agency.status}`}>{agencyStatus(agency.status)}</span>
            </header>
            <div className="commercialClientFacts">
              <span><small>Cadastro</small><b>{date(agency.created_at)}</b></span>
              <span><small>Plano</small><b>{displayPlan}</b></span>
              <span><small>Cobrança</small><b>{cycleLabel(cycle)}</b></span>
              <span><small>Implantação</small><b>{implementationLabel(profile?.implementation_status, cycle)}</b></span>
              <span><small>Assinatura</small><b>{subscriptionStatus(subscription?.status)}</b></span>
              <span><small>Vencimento</small><b>{date(subscription?.renews_at || subscription?.ends_at)}</b></span>
              <span><small>Última cobrança</small><b>{latestCheckout ? money(latestCheckout.paid_amount ?? latestCheckout.amount) : "—"}</b></span>
              <span><small>Situação financeira</small><b>{paymentStatus(latestCheckout?.status)}</b></span>
            </div>
            <button className="commercialEditClientButton" type="button" onClick={() => setEditingId((current) => current === agency.id ? null : agency.id)}>{editingId === agency.id ? "Fechar edição" : "Editar cliente"}</button>
            {editingId === agency.id ? <ClientEditor agency={agency} profile={profile} subscription={subscription} plans={plans} latestCheckout={latestCheckout} discount={discount} onSaved={load} /> : null}
          </article>;
        })}
        {!agencies.length ? <div className="formNotice">Nenhum cliente cadastrado.</div> : null}
      </div>
    </section>
  </>;
}
