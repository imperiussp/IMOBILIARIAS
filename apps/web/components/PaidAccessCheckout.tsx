"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number | null;
  annual_price: number | null;
  implementation_fee: number | null;
  annual_discount_percent: number | null;
  features: Record<string, unknown> | null;
};
type BillingStatus = {
  has_paid_access: boolean;
  implementation_status: "pending" | "paid" | "waived";
  billing_cycle: "monthly" | "annual" | null;
  subscription_status: string | null;
  plan_id: string | null;
  plan_name: string | null;
  ends_at: string | null;
};
type Discount = { plan_id: string; billing_cycle: "monthly" | "annual"; base_amount: number; final_amount: number; discount_percent: number };

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}
function billingError(value: unknown) {
  const code = String(value || "");
  if (code.includes("billing_blocked_by_release_control")) return "A cobrança está temporariamente bloqueada pela administração da plataforma.";
  if (code.includes("infinitepay_not_configured")) return "A forma de pagamento ainda não está disponível neste ambiente.";
  if (code.includes("implementation_price_not_configured")) return "A taxa de implantação deste plano ainda não foi configurada.";
  if (code.includes("plan_price_not_configured")) return "O preço deste plano ainda não foi configurado.";
  return code || "Não foi possível iniciar o pagamento agora.";
}

export default function PaidAccessCheckout({ agencyId, agencyName, appMode = false, brokerOnly = false }: { agencyId: string; agencyName: string; appMode?: boolean; brokerOnly?: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [preferredPlanCode, setPreferredPlanCode] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const [planResult, statusResult, discountResult, userResult] = await Promise.all([
      supabaseBrowser.from("subscription_plans").select("id,code,name,description,monthly_price,annual_price,implementation_fee,annual_discount_percent,features").eq("active", true).order("display_order").order("name"),
      supabaseBrowser.rpc("agency_billing_status", { p_agency_id: agencyId }),
      supabaseBrowser.rpc("agency_billing_discount_snapshot", { p_agency_id: agencyId }),
      supabaseBrowser.auth.getUser(),
    ]);
    if (planResult.error) setMessage("Não foi possível carregar os planos agora.");
    const rows = ((planResult.data || []) as Plan[]).filter((plan) => String(plan.features?.internal_only || "false").toLowerCase() !== "true");
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const metadata = userResult.data.user?.user_metadata || {};
    const requestedCode = String(params?.get("plano") || metadata.selected_plan_code || "").toLowerCase();
    const requestedCycle = String(params?.get("ciclo") || metadata.selected_billing_cycle || "").toLowerCase();
    const validPreferred = rows.some((plan) => plan.code === requestedCode) ? requestedCode : "";
    setPreferredPlanCode(validPreferred);
    if (requestedCycle === "annual" || requestedCycle === "monthly") setCycle(requestedCycle);
    setPlans(validPreferred ? [...rows].sort((a,b) => a.code === validPreferred ? -1 : b.code === validPreferred ? 1 : 0) : rows);
    if (!statusResult.error && Array.isArray(statusResult.data) && statusResult.data[0]) setStatus(statusResult.data[0] as BillingStatus);
    if (!discountResult.error && Array.isArray(discountResult.data)) setDiscounts(discountResult.data as Discount[]);
  }

  async function confirmReturn() {
    if (!supabaseBrowser || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("pagamento") !== "retorno") return;
    const orderNsu = params.get("order_nsu") || "";
    const transactionNsu = params.get("transaction_nsu") || "";
    const slug = params.get("slug") || "";
    if (!orderNsu || !transactionNsu || !slug) {
      setMessage("Retorno recebido. Aguardando a confirmação segura do pagamento pelo servidor.");
      return;
    }
    setMessage("Confirmando o pagamento com a InfinitePay...");
    const result = await supabaseBrowser.functions.invoke("confirm-infinitepay-payment", { body: {
      order_nsu: orderNsu,
      transaction_nsu: transactionNsu,
      slug,
      receipt_url: params.get("receipt_url") || "",
      capture_method: params.get("capture_method") || "",
    } });
    if (result.error || result.data?.error) {
      setMessage("Pagamento ainda não confirmado. O acesso será liberado somente depois da confirmação do servidor.");
      return;
    }
    if (result.data?.paid) {
      window.history.replaceState({}, "", window.location.pathname);
      window.location.reload();
      return;
    }
    setMessage("Pagamento ainda em processamento.");
  }

  useEffect(() => { void load().then(() => confirmReturn()); }, [agencyId]);

  const implementationPending = !status || status.implementation_status === "pending";
  const discountMap = useMemo(() => new Map(discounts.map((item) => [`${item.plan_id}:${item.billing_cycle}`, item])), [discounts]);

  async function startCheckout(plan: Plan) {
    if (!supabaseBrowser) return;
    setBusyId(plan.id); setMessage("");
    const result = await supabaseBrowser.functions.invoke("create-infinitepay-checkout", { body: {
      agency_id: agencyId,
      plan_id: plan.id,
      billing_cycle: cycle,
      return_path: appMode ? "/app/" : "/admin/",
    } });
    setBusyId("");
    if (result.error || result.data?.error) return setMessage(billingError(result.data?.error || result.error?.message));
    const url = String(result.data?.checkout_url || "");
    if (!url) return setMessage("O pagamento não retornou um endereço válido.");
    window.location.assign(url);
  }

  async function checkAccess() {
    if (!supabaseBrowser) return;
    setMessage("Verificando confirmação do pagamento...");
    const result = await supabaseBrowser.rpc("agency_billing_status", { p_agency_id: agencyId });
    const row = Array.isArray(result.data) ? result.data[0] as BillingStatus | undefined : undefined;
    if (row?.has_paid_access) return window.location.reload();
    setMessage("O pagamento ainda não foi confirmado pelo servidor.");
  }

  if (brokerOnly) return <main className="loginPage paidAccessPage"><div className="loginShell"><div className="loginCard paidAccessBrokerCard"><span className="eyebrow">ASSINATURA PENDENTE</span><h1>Aguardando liberação</h1><p>O acesso de corretores será liberado automaticamente quando o pagamento da assinatura de <strong>{agencyName}</strong> for confirmado.</p><button className="button secondary full" type="button" onClick={() => void checkAccess()}>Verificar liberação</button><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;

  return <main className="loginPage paidAccessPage"><div className="paidAccessShell">
    <div className="paidAccessHeading"><span className="eyebrow">ETAPA 2 DE 2 · PAGAMENTO</span><h1>Conclua a contratação.</h1><p>Seu cadastro <strong>{agencyName}</strong> já existe. {preferredPlanCode ? "O plano escolhido no cadastro aparece destacado abaixo. " : ""}O painel e o aplicativo são liberados somente depois da confirmação do pagamento pelo servidor.</p></div>
    <div className="paidCycleSwitch"><button type="button" className={cycle === "monthly" ? "active" : ""} onClick={() => setCycle("monthly")}>Mensal</button><button type="button" className={cycle === "annual" ? "active" : ""} onClick={() => setCycle("annual")}>Anual · 25% OFF</button></div>
    <div className="paidAccessPlans">{plans.map((plan) => {
      const discount = discountMap.get(`${plan.id}:${cycle}`);
      const normalSubscription = cycle === "annual" ? Number(plan.annual_price || 0) : Number(plan.monthly_price || 0);
      const effectiveSubscription = discount ? Number(discount.final_amount) : normalSubscription;
      const firstMonthly = implementationPending ? Number(plan.implementation_fee || 0) : effectiveSubscription;
      const payable = cycle === "annual" ? effectiveSubscription : firstMonthly;
      const isDiscounted = Boolean(discount && effectiveSubscription < normalSubscription);
      const preferred = plan.code === preferredPlanCode;
      return <article className={`paidAccessPlan ${plan.code === "profissional" ? "featured" : ""} ${preferred ? "preferred" : ""}`} key={plan.id}>
        {preferred ? <span className="paidPlanBadge preferredBadge">PLANO ESCOLHIDO</span> : plan.code === "profissional" ? <span className="paidPlanBadge">MAIS ESCOLHIDO</span> : null}
        <h2>{plan.name}</h2><p>{plan.description}</p>
        <div className="paidPlanMonthly"><strong>{money(plan.monthly_price)}</strong><span>/mês</span></div>
        {cycle === "monthly" ? <div className="paidPlanCharge"><small>{implementationPending ? "PRIMEIRO PAGAMENTO" : "PRÓXIMA COBRANÇA"}</small><strong>{money(payable)}</strong><span>{implementationPending ? `Implantação · pagamento único. A mensalidade de ${money(plan.monthly_price)} vence após os primeiros 30 dias.` : "Mensalidade do plano"}</span>{isDiscounted && !implementationPending ? <em>Desconto especial: {Number(discount?.discount_percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</em> : null}</div>
        : <div className="paidPlanCharge annual"><small>12 MESES · 25% OFF</small><strong>{isDiscounted ? <><s>{money(normalSubscription)}</s> {money(effectiveSubscription)}</> : money(normalSubscription)}</strong><span>🎁 Implantação totalmente grátis</span>{isDiscounted ? <em>+ desconto especial: {Number(discount?.discount_percent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</em> : null}</div>}
        <button className="button primary full" type="button" disabled={busyId === plan.id || payable <= 0} onClick={() => void startCheckout(plan)}>{busyId === plan.id ? "Abrindo pagamento..." : cycle === "annual" ? `Pagar anual · ${money(payable)}` : implementationPending ? `Pagar implantação · ${money(payable)}` : `Pagar mensal · ${money(payable)}`}</button>
      </article>;
    })}</div>
    <div className="paidAccessSecurity"><strong>Liberação protegida</strong><span>O retorno do navegador não libera a conta. O acesso só é ativado depois que a InfinitePay confirma o pagamento no servidor.</span></div>
    {message ? <div className="formMessage paidAccessMessage">{message}<button type="button" className="miniButton" onClick={() => void checkAccess()}>Verificar acesso</button></div> : null}
  </div></main>;
}
