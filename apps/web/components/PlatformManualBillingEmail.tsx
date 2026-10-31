"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Preview = {
  agency_name: string;
  recipient: string;
  plan: string;
  billing_cycle: "monthly" | "annual";
  amount: number;
  due_date: string;
  subject: string;
  payment_enabled: boolean;
};
type RecordItem = {
  request_id: string;
  destination: string;
  due_date: string;
  amount: number;
  status: "sending" | "sent" | "failed";
  created_at: string;
  error_message: string | null;
  checkout_url: string | null;
};
function money(n: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n); }
function dateBR(s: string) { const v = s.slice(0, 10).split("-"); return v.length === 3 ? [v[2], v[1], v[0]].join("/") : s; }
async function errorText(error: unknown, data: any): Promise<string> {
  if (data?.error) return String(data.error);
  const maybe = error as { message?: string; context?: Response };
  if (maybe?.context) {
    try { const value = await maybe.context.clone().json(); if (value?.error) return String(value.error); } catch { /* Sem corpo JSON. */ }
  }
  return maybe?.message || "Não foi possível concluir a operação.";
}
export default function PlatformManualBillingEmail({ agencyId }: { agencyId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [history, setHistory] = useState<RecordItem[]>([]);
  const [busy, setBusy] = useState<"preview" | "send" | "history" | "">("");
  const [message, setMessage] = useState("");
  const [lastLink, setLastLink] = useState("");

  useEffect(() => {
    setPreview(null); setHistory([]); setMessage(""); setLastLink("");
  }, [agencyId]);

  async function invoke(action: "preview" | "send" | "history", requestId?: string) {
    if (!supabaseBrowser) throw Error("Supabase não configurado.");
    const result = await supabaseBrowser.functions.invoke("send-manual-billing-email", {
      body: { action, agency_id: agencyId, ...(requestId ? { request_id: requestId } : {}) },
    });
    if (result.error || result.data?.error) throw Error(await errorText(result.error, result.data));
    return result.data;
  }
  async function loadPreview() {
    setBusy("preview"); setMessage(""); setLastLink("");
    try { setPreview((await invoke("preview")) as Preview); }
    catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : "Falha ao consultar."); }
    finally { setBusy(""); }
  }
  async function loadHistory() {
    setBusy("history"); setMessage("");
    try { const result = await invoke("history"); setHistory((result?.history || []) as RecordItem[]); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao consultar o histórico."); }
    finally { setBusy(""); }
  }
  async function send() {
    if (!preview || busy) return;
    if (!preview.payment_enabled) return setMessage("A emissão de cobranças está indisponível.");
    const approved = window.confirm(
      "Enviar aviso de vencimento para " + preview.recipient +
      "?\n\nCliente: " + preview.agency_name +
      "\nPlano: " + preview.plan +
      "\nValor: " + money(preview.amount) +
      "\nVencimento: " + dateBR(preview.due_date) +
      "\n\nSerá gerado um link real da InfinitePay e o e-mail será enviado."
    );
    if (!approved) return;
    setBusy("send"); setMessage(""); setLastLink("");
    try {
      const result = await invoke("send", crypto.randomUUID());
      setLastLink(String(result?.checkout_url || ""));
      setMessage(result?.warning
        ? String(result.warning)
        : "E-mail de cobrança enviado para " + String(result?.recipient || preview.recipient) + ".");
      // Uma nova conferência evita mostrar como atual uma condição comercial já alterada.
      const historyResult = await invoke("history");
      setHistory((historyResult?.history || []) as RecordItem[]);
      setPreview(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha no envio."); }
    finally { setBusy(""); }
  }
  return (
    <section className="commercialBillingManualSend" aria-label="Cobrança manual por e-mail"
      style={{ marginTop: 18, padding: 18, border: "1px solid #dbe4ec", borderRadius: 14, background: "#f7fafc", color: "#17314a" }}>
      <div style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 16 }}>Enviar cobrança por e-mail</strong>
        <p style={{ fontSize: 13, margin: "6px 0 0" }}>
          Gere um aviso de vencimento com o valor contratado, a data e um botão para pagar pela InfinitePay.
          A prévia não envia e-mail. Salve eventuais alterações do cliente antes de preparar a cobrança.
        </p>
      </div>
      <div className="formActions" style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        <button type="button" className="button" onClick={() => void loadPreview()} disabled={Boolean(busy)}>
          {busy === "preview" ? "Consultando..." : "Visualizar cobrança"}
        </button>
        <button type="button" className="button" onClick={() => void loadHistory()} disabled={Boolean(busy)}>
          {busy === "history" ? "Consultando..." : "Histórico de envios"}
        </button>
      </div>
      {preview && (
        <div style={{ background: "#fff", border: "1px solid #e1e7ef", borderRadius: 12, marginTop: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 9 }}>Prévia do e-mail</div>
          <div style={{ fontSize: 12, color: "#637488", marginBottom: 14 }}>
            Para: {preview.recipient}<div>Assunto: {preview.subject}</div>
          </div>
          <div style={{ background: "#0b2946", padding: 16, color: "#fff", fontWeight: 700, borderRadius: "9px 9px 0 0" }}>
            LENOY IMOBILIÁRIAS
          </div>
          <div style={{ border: "1px solid #e0e7ef", borderTop: 0, padding: 16, borderRadius: "0 0 9px 9px", lineHeight: 1.7 }}>
            Olá, equipe da {preview.agency_name}!<p>Informamos os dados de vencimento da sua assinatura:</p>
            <div>Plano: {preview.plan}</div>
            <div>Periodicidade: {preview.billing_cycle === "annual" ? "Anual" : "Mensal"}</div>
            <div>Valor: {money(preview.amount)}</div>
            <div>Vencimento: {dateBR(preview.due_date)}</div>
            <div style={{ textAlign: "center", margin: "20px 0 10px" }}>
              <span style={{ display: "inline-block", background: "#0b2946", color: "#fff", padding: "12px 20px", borderRadius: 9, fontWeight: 700 }}>
                Pagar com InfinitePay
              </span>
            </div>
            <small style={{ color: "#697888" }}>O link seguro será incluído automaticamente no e-mail enviado.</small>
          </div>
          <div className="formActions" style={{ marginTop: 14 }}>
            <button type="button" className="button primary" disabled={Boolean(busy) || !preview.payment_enabled}
              onClick={() => void send()}>
              {busy === "send" ? "Enviando..." : "Confirmar e enviar e-mail"}
            </button>
          </div>
          {!preview.payment_enabled && <div className="formNotice">Cobranças reais estão desabilitadas no momento.</div>}
        </div>
      )}
      {message && <div className="formMessage" role="status" style={{ marginTop: 12 }}>{message}</div>}
      {lastLink && <p style={{ margin: "10px 0 0" }}><a href={lastLink} target="_blank" rel="noreferrer">Abrir o link de pagamento gerado</a></p>}
      {history.length > 0 && <div style={{ marginTop: 14 }}>
        <strong>Últimos envios manuais</strong>
        <ul style={{ paddingLeft: 20, margin: "9px 0", fontSize: 12 }}>
          {history.map((item) => <li key={item.request_id} style={{ marginBottom: 8 }}>
            {new Date(item.created_at).toLocaleString("pt-BR")} · {item.destination} · {money(item.amount)} ·
            venc. {dateBR(item.due_date)} ·
            {item.status === "sent" ? " Enviado" : item.status === "failed" ? " Falhou" : " Processando"}
            {item.error_message ? " — " + item.error_message : ""}
          </li>)}
        </ul>
      </div>}
    </section>
  );
}
