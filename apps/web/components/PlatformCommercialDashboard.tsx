"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Agency = { id: string; name: string; slug: string; email: string | null; status: string; created_at: string };
type BillingProfile = { agency_id: string; implementation_status: string; billing_cycle: string };
type Subscription = { agency_id: string; plan_id: string; status: string; starts_at: string; renews_at: string | null; ends_at: string | null; billing_cycle: string | null };
type Plan = { id: string; name: string; code: string; monthly_price: number | null; annual_price: number | null };
type Checkout = { id: string; agency_id: string; plan_id: string; status: string; amount: number | null; paid_amount: number | null; base_amount: number | null; discount_percent: number | null; billing_cycle: string | null; charge_type: string | null; created_at: string; completed_at: string | null };

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function date(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("pt-BR");
}

function agencyStatus(status: string) {
  if (status === "active") return "Ativo";
  if (status === "pending_payment") return "Aguardando pagamento";
  if (status === "trial") return "Em teste";
  if (status === "past_due") return "Pagamento atrasado";
  if (status === "suspended") return "Suspenso";
  if (status === "cancelled") return "Cancelado";
  return status || "—";
}

function subscriptionStatus(status: string | undefined) {
  if (!status) return "Sem assinatura";
  if (status === "active") return "Ativa";
  if (status === "trial") return "Teste";
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

function implementationLabel(status: string | undefined, cycle: string | undefined) {
  if (cycle === "annual" && (!status || status === "pending" || status === "waived")) return "Grátis no anual";
  if (status === "paid") return "Paga";
  if (status === "waived") return "Grátis";
  if (status === "pending") return "Pendente";
  return "—";
}

export default function PlatformCommercialDashboard() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [profiles, setProfiles] = useState<BillingProfile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabaseBrowser || !isSupabaseConfigured) return;
    void (async () => {
      const [agencyResult, profileResult, subscriptionResult, planResult, checkoutResult] = await Promise.all([
        supabaseBrowser.from("agencies").select("id,name,slug,email,status,created_at").order("created_at", { ascending: false }),
        supabaseBrowser.from("agency_billing_profiles").select("agency_id,implementation_status,billing_cycle"),
        supabaseBrowser.from("agency_subscriptions").select("agency_id,plan_id,status,starts_at,renews_at,ends_at,billing_cycle").order("starts_at", { ascending: false }),
        supabaseBrowser.from("subscription_plans").select("id,name,code,monthly_price,annual_price").order("display_order"),
        supabaseBrowser.from("billing_checkout_sessions").select("id,agency_id,plan_id,status,amount,paid_amount,base_amount,discount_percent,billing_cycle,charge_type,created_at,completed_at").order("created_at", { ascending: false }).limit(200),
      ]);
      const error = agencyResult.error || profileResult.error || subscriptionResult.error || planResult.error || checkoutResult.error;
      if (error) return setMessage(error.message);
      setAgencies((agencyResult.data || []) as Agency[]);
      setProfiles((profileResult.data || []) as BillingProfile[]);
      setSubscriptions((subscriptionResult.data || []) as Subscription[]);
      setPlans((planResult.data || []) as Plan[]);
      setCheckouts((checkoutResult.data || []) as Checkout[]);
    })();
  }, []);

  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const profileByAgency = useMemo(() => new Map(profiles.map((profile) => [profile.agency_id, profile])), [profiles]);
  const currentSubscriptionByAgency = useMemo(() => {
    const result = new Map<string, Subscription>();
    subscriptions.forEach((item) => {
      if (!result.has(item.agency_id)) result.set(item.agency_id, item);
    });
    return result;
  }, [subscriptions]);

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
  const paidThisMonth = checkouts.filter((checkout) => {
    if (checkout.status !== "paid") return false;
    const when = new Date(checkout.completed_at || checkout.created_at).getTime();
    return when >= monthStart && when < nextMonthStart;
  });
  const revenueThisMonth = paidThisMonth.reduce((sum, checkout) => sum + Number(checkout.paid_amount ?? checkout.amount ?? 0), 0);
  const pendingPayments = checkouts.filter((checkout) => ["created", "pending"].includes(checkout.status)).length;

  return <>
    <section className="commercialSummary" id="resumo-comercial">
      <article><span>Clientes cadastrados</span><strong>{agencies.length}</strong><small>todos os cadastros</small></article>
      <article><span>Clientes ativos</span><strong>{active}</strong><small>com acesso liberado</small></article>
      <article className={awaitingPayment ? "attention" : ""}><span>Aguardando pagamento</span><strong>{awaitingPayment}</strong><small>cadastros ainda não liberados</small></article>
      <article><span>Mensalistas</span><strong>{monthly}</strong><small>assinaturas mensais ativas</small></article>
      <article><span>Anuais</span><strong>{annual}</strong><small>assinaturas anuais ativas</small></article>
      <article className={overdue ? "danger" : ""}><span>Inadimplentes / suspensos</span><strong>{overdue}</strong><small>precisam de atenção</small></article>
      <article><span>Recebido neste mês</span><strong>{money(revenueThisMonth)}</strong><small>{paidThisMonth.length} pagamento(s) confirmado(s)</small></article>
      <article className={pendingPayments ? "attention" : ""}><span>Pagamentos pendentes</span><strong>{pendingPayments}</strong><small>cobranças ainda não concluídas</small></article>
    </section>

    <nav className="commercialQuickNav" aria-label="Atalhos da administração comercial">
      <a href="#clientes-comerciais">Clientes</a>
      <a href="#assinaturas-plataforma">Assinaturas e descontos</a>
      <a href="#planos-plataforma">Planos e preços</a>
      <a href="#cobranca-plataforma">Pagamentos</a>
    </nav>

    {message ? <div className="formMessage">Não foi possível carregar todos os dados comerciais: {message}</div> : null}

    <section className="adminPanel commercialClientsPanel" id="clientes-comerciais">
      <div className="adminPanelHeader"><div><span className="eyebrow">CLIENTES</span><h2>Cadastros, compras e acesso</h2><p>Veja quem se cadastrou, qual plano possui, como paga, situação da implantação e quando vence o acesso.</p></div><span className="statusPill">{agencies.length} cliente(s)</span></div>
      <div className="adminTableWrap commercialTableWrap"><table className="adminTable commercialTable"><thead><tr><th>Cliente</th><th>Cadastro</th><th>Plano</th><th>Cobrança</th><th>Implantação</th><th>Assinatura</th><th>Acesso</th><th>Próximo vencimento</th></tr></thead><tbody>
        {agencies.map((agency) => {
          const profile = profileByAgency.get(agency.id);
          const subscription = currentSubscriptionByAgency.get(agency.id);
          const plan = subscription ? planById.get(subscription.plan_id) : null;
          const cycle = subscription?.billing_cycle || profile?.billing_cycle;
          return <tr key={agency.id}>
            <td data-label="Cliente"><strong>{agency.name}</strong><small className="tableSub">{agency.email || "Sem e-mail"}</small><small className="tableSub">{agency.slug}.imoveis.lenoy.com.br</small></td>
            <td data-label="Cadastro">{date(agency.created_at)}</td>
            <td data-label="Plano">{plan?.name || "Ainda não escolhido"}</td>
            <td data-label="Cobrança">{cycleLabel(cycle)}</td>
            <td data-label="Implantação"><span className={`commercialStatus ${profile?.implementation_status || "none"}`}>{implementationLabel(profile?.implementation_status, cycle)}</span></td>
            <td data-label="Assinatura">{subscriptionStatus(subscription?.status)}</td>
            <td data-label="Acesso"><span className={`commercialStatus agency-${agency.status}`}>{agencyStatus(agency.status)}</span></td>
            <td data-label="Próximo vencimento">{date(subscription?.renews_at || subscription?.ends_at)}</td>
          </tr>;
        })}
        {!agencies.length ? <tr><td colSpan={8}>Nenhum cliente cadastrado.</td></tr> : null}
      </tbody></table></div>
    </section>
  </>;
}
