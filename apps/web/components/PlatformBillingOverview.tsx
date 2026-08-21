"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Session = { id: string; agency_id: string; provider: string; status: string; amount: number | null; currency: string; created_at: string; plan_id: string };
type Event = { id: string; provider: string; event_type: string; processing_status: string; created_at: string; agency_id: string | null };
type Agency = { id: string; name: string };
type Plan = { id: string; name: string };

export default function PlatformBillingOverview() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabaseBrowser || !isSupabaseConfigured) return;
    void (async () => {
      const [sessionResult, eventResult, agencyResult, planResult] = await Promise.all([
        supabaseBrowser.from("billing_checkout_sessions").select("id,agency_id,provider,status,amount,currency,created_at,plan_id").order("created_at", { ascending: false }).limit(40),
        supabaseBrowser.from("billing_events").select("id,provider,event_type,processing_status,created_at,agency_id").order("created_at", { ascending: false }).limit(40),
        supabaseBrowser.from("agencies").select("id,name"),
        supabaseBrowser.from("subscription_plans").select("id,name"),
      ]);
      const error = sessionResult.error || eventResult.error || agencyResult.error || planResult.error;
      if (error) return setMessage(error.message);
      setSessions((sessionResult.data || []) as Session[]);
      setEvents((eventResult.data || []) as Event[]);
      setAgencies((agencyResult.data || []) as Agency[]);
      setPlans((planResult.data || []) as Plan[]);
    })();
  }, []);

  const agencyName = useMemo(() => new Map(agencies.map((item) => [item.id, item.name])), [agencies]);
  const planName = useMemo(() => new Map(plans.map((item) => [item.id, item.name])), [plans]);
  const paid = sessions.filter((item) => item.status === "paid").length;
  const pending = sessions.filter((item) => item.status === "created" || item.status === "pending").length;
  const failedEvents = events.filter((item) => item.processing_status === "failed").length;

  return <div className="adminPanel" id="cobranca-plataforma">
    <div className="adminPanelHeader"><div><span className="eyebrow">COBRANÇA</span><h2>Operação financeira</h2><p>Base preparada para checkout e webhooks sem acoplar a plataforma a um único provedor.</p></div><span>{isSupabaseConfigured ? `${sessions.length} checkout(s) recentes` : "Aguardando produção"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">Nenhuma cobrança está ativa. Esta área será alimentada somente depois da escolha/configuração do provedor real.</div> : <>
      <div className="adminMetrics planMetrics"><article><span>Pagos</span><strong>{paid}</strong><small>checkouts confirmados</small></article><article><span>Pendentes</span><strong>{pending}</strong><small>aguardando conclusão</small></article><article><span>Eventos com falha</span><strong>{failedEvents}</strong><small>precisam de reprocessamento</small></article><article><span>Eventos recebidos</span><strong>{events.length}</strong><small>webhooks recentes</small></article></div>
      {message ? <div className="formMessage">{message}</div> : null}
      <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Imobiliária</th><th>Plano</th><th>Provedor</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td>{agencyName.get(session.agency_id) || "—"}</td><td>{planName.get(session.plan_id) || "—"}</td><td>{session.provider}</td><td>{session.amount == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: session.currency || "BRL" }).format(session.amount)}</td><td><span className="statusPill">{session.status}</span></td><td>{new Date(session.created_at).toLocaleString("pt-BR")}</td></tr>)}{!sessions.length ? <tr><td colSpan={6}>Nenhum checkout registrado ainda.</td></tr> : null}</tbody></table></div>
    </>}
  </div>;
}
