"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Plan = { id: string; name: string; description: string | null; monthly_price: number | null; annual_price: number | null; active: boolean };
type Session = { id: string; plan_id: string; billing_cycle: "monthly" | "annual" | null; status: string; amount: number | null; checkout_url: string | null; receipt_url: string | null; created_at: string };

function money(value: number | null) {
  if (value == null) return "não definido";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function statusLabel(status: string) {
  if (status === "paid") return "Pago";
  if (status === "pending") return "Aguardando pagamento";
  if (status === "failed") return "Falhou";
  if (status === "cancelled") return "Cancelado";
  if (status === "expired") return "Expirado";
  return "Criado";
}

export default function AdminInfinitePayCheckout() {
  const [agencyId, setAgencyId] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const agency = await getCurrentAgency();
    if (!agency) return setMessage("Não foi possível identificar a imobiliária ativa.");
    setAgencyId(agency.agencyId);
    const [planResult, sessionResult] = await Promise.all([
      supabaseBrowser.from("subscription_plans").select("id,name,description,monthly_price,annual_price,active").eq("active", true).order("display_order").order("name"),
      supabaseBrowser.from("billing_checkout_sessions").select("id,plan_id,billing_cycle,status,amount,checkout_url,receipt_url,created_at").eq("agency_id", agency.agencyId).eq("provider", "infinitepay").order("created_at", { ascending: false }).limit(8),
    ]);
    if (planResult.error) return setMessage(planResult.error.message);
    if (sessionResult.error && sessionResult.error.code !== "42P01") return setMessage(sessionResult.error.message);
    const rows = (planResult.data || []) as Plan[];
    setPlans(rows);
    if (!planId && rows[0]) setPlanId(rows[0].id);
    setSessions((sessionResult.data || []) as Session[]);
  }

  async function confirmReturn() {
    if (!supabaseBrowser || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("pagamento") !== "retorno") return;
    const orderNsu = params.get("order_nsu") || "";
    const transactionNsu = params.get("transaction_nsu") || "";
    const slug = params.get("slug") || "";
    if (!orderNsu || !transactionNsu || !slug) return setMessage("Retorno da InfinitePay recebido. Aguardando confirmação automática do webhook.");
    setLoading(true);
    const result = await supabaseBrowser.functions.invoke("confirm-infinitepay-payment", { body: {
      order_nsu: orderNsu,
      transaction_nsu: transactionNsu,
      slug,
      receipt_url: params.get("receipt_url") || "",
      capture_method: params.get("capture_method") || "",
    } });
    setLoading(false);
    if (result.error || result.data?.error) return setMessage(result.data?.error || result.error?.message || "Não foi possível confirmar o pagamento.");
    setMessage(result.data?.paid ? "Pagamento confirmado pela InfinitePay e assinatura ativada." : "Pagamento ainda não confirmado.");
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    await load();
  }

  useEffect(() => { void load().then(() => confirmReturn()); }, []);

  const selected = useMemo(() => plans.find((plan) => plan.id === planId) || null, [plans, planId]);
  const selectedPrice = selected ? (cycle === "annual" ? selected.annual_price : selected.monthly_price) : null;

  async function startCheckout() {
    if (!supabaseBrowser || !agencyId || !planId) return;
    if (selectedPrice == null || Number(selectedPrice) <= 0) return setMessage("Este plano ainda não possui preço configurado para este ciclo.");
    setLoading(true); setMessage("");
    const result = await supabaseBrowser.functions.invoke("create-infinitepay-checkout", { body: { agency_id: agencyId, plan_id: planId, billing_cycle: cycle } });
    setLoading(false);
    if (result.error || result.data?.error) return setMessage(result.data?.error || result.error?.message || "Não foi possível criar o checkout.");
    const url = String(result.data?.checkout_url || "");
    if (!url) return setMessage("A InfinitePay não retornou um endereço de pagamento.");
    window.location.assign(url);
  }

  return <div className="adminPanel" id="pagamento-infinitepay">
    <div className="adminPanelHeader"><div><span className="eyebrow">PAGAMENTO</span><h2>InfinitePay</h2><p>Checkout integrado com confirmação por webhook e verificação de retorno antes de ativar o plano.</p></div><span>{loading ? "Processando..." : "Integração preparada"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">A cobrança ficará disponível somente no Supabase exclusivo do IMOBILIARIAS, com a InfiniteTag e os segredos configurados no backend.</div> : null}
    <div className="propertyForm">
      <div className="formGrid"><label>Plano<select value={planId} onChange={(e) => setPlanId(e.target.value)}><option value="">Selecione</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label><label>Cobrança<select value={cycle} onChange={(e) => setCycle(e.target.value as "monthly" | "annual")}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></label></div>
      {selected ? <div className="domainPrimaryCard"><div><span className="eyebrow">VALOR CONFIGURADO</span><strong>{money(selectedPrice)}</strong><small>{selected.description || selected.name} · {cycle === "annual" ? "ciclo anual" : "ciclo mensal"}</small></div><button className="button primary" type="button" onClick={() => void startCheckout()} disabled={loading || !isSupabaseConfigured || selectedPrice == null || Number(selectedPrice) <= 0}>{loading ? "Aguarde..." : "Pagar com InfinitePay"}</button></div> : null}
    </div>
    {message ? <div className="formMessage">{message}</div> : null}
    <div className="accessList">{sessions.map((session) => <article className="accessRow" key={session.id}><div className="accessIdentity"><strong>{statusLabel(session.status)} · {money(session.amount)}</strong><span>{session.billing_cycle === "annual" ? "Plano anual" : "Plano mensal"}</span><small>{new Date(session.created_at).toLocaleString("pt-BR")}</small></div><div className="accessActions">{session.status === "pending" && session.checkout_url ? <a className="miniButton" href={session.checkout_url}>Continuar pagamento</a> : null}{session.status === "paid" && session.receipt_url ? <a className="miniButton" href={session.receipt_url} target="_blank" rel="noreferrer">Comprovante</a> : null}</div></article>)}</div>
  </div>;
}
