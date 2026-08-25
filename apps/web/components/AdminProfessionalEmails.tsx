"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Usage = {
  plan_name: string;
  email_limit: number;
  used_emails: number;
  remaining_emails: number;
  can_create: boolean;
};

type Mailbox = {
  id: string;
  email_address: string;
  domain: string;
  quota_mb: number;
  status: "pending" | "active" | "suspended" | "error" | "deleted";
  created_at: string;
};

type DomainRow = { hostname: string; verified: boolean };
type ProvisionResult = { ok?: boolean; email?: string; error?: string };

const statusLabel: Record<Mailbox["status"], string> = {
  pending: "Preparando",
  active: "Ativo",
  suspended: "Suspenso",
  error: "Com problema",
  deleted: "Removido",
};

async function edgeErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : "Não foi possível criar a conta de e-mail.";
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!context?.json) return fallback;
  try {
    const payload = await context.json() as ProvisionResult;
    return payload?.error || fallback;
  } catch {
    return fallback;
  }
}

export default function AdminProfessionalEmails() {
  const [agencyId, setAgencyId] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<string[]>(["imoveis.lenoy.com.br"]);
  const [localPart, setLocalPart] = useState("");
  const [domain, setDomain] = useState("imoveis.lenoy.com.br");
  const [password, setPassword] = useState("");
  const [quotaMb, setQuotaMb] = useState("1024");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const currentAgency = await getCurrentAgency();
    if (!currentAgency) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    setAgencyId(currentAgency.agencyId);
    const [usageResult, mailResult, domainResult] = await Promise.all([
      supabaseBrowser.rpc("agency_email_usage_snapshot", { p_agency_id: currentAgency.agencyId }),
      supabaseBrowser.from("agency_mailboxes").select("id,email_address,domain,quota_mb,status,created_at").eq("agency_id", currentAgency.agencyId).is("deleted_at", null).order("created_at", { ascending: false }),
      supabaseBrowser.from("agency_domains").select("hostname,verified").eq("agency_id", currentAgency.agencyId).eq("verified", true),
    ]);
    if (usageResult.error) setMessage(usageResult.error.message);
    const usageRows = Array.isArray(usageResult.data) ? usageResult.data : [];
    setUsage((usageRows[0] || null) as Usage | null);
    if (!mailResult.error) setMailboxes((mailResult.data || []) as Mailbox[]);
    const verified = ((domainResult.data || []) as DomainRow[]).map((row) => row.hostname.toLowerCase()).filter(Boolean);
    setDomains(Array.from(new Set(["imoveis.lenoy.com.br", ...verified])));
  }

  useEffect(() => { void load(); }, []);

  const normalizedLocalPart = useMemo(() => localPart.trim().toLowerCase().replace(/\s+/g, ""), [localPart]);
  const previewAddress = normalizedLocalPart ? `${normalizedLocalPart}@${domain}` : `nome@${domain}`;

  async function createMailbox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId || busy) return;
    if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(normalizedLocalPart)) return setMessage("Use letras minúsculas, números, ponto, traço ou sublinhado no nome do e-mail.");
    if (password.length < 10) return setMessage("A senha do e-mail precisa ter pelo menos 10 caracteres.");
    setBusy(true); setMessage("");

    const { data, error } = await supabaseBrowser.functions.invoke("provision-professional-email", {
      body: { agency_id: agencyId, local_part: normalizedLocalPart, domain, password, quota_mb: Number(quotaMb || 1024) },
    });
    setBusy(false);

    if (error) return setMessage(await edgeErrorMessage(error));
    const payload = (data || {}) as ProvisionResult;
    if (!payload.ok) return setMessage(payload.error || "Não foi possível criar a conta de e-mail.");

    setLocalPart(""); setPassword("");
    setMessage(`${payload.email} criado com sucesso.`);
    await load();
  }

  return <div className="adminPanel" id="emails-profissionais">
    <div className="adminPanelHeader"><div><span className="eyebrow">RECURSO OPCIONAL</span><h2>E-mails profissionais</h2><p>Seu plano disponibiliza contas de e-mail, mas nenhuma é criada automaticamente. Use somente quando precisar.</p></div><span>{usage ? `${usage.used_emails}/${usage.email_limit} em uso` : "Carregando..."}</span></div>

    {usage ? <div className="emailUsageLine"><strong>{usage.remaining_emails}</strong><span>conta(s) ainda disponível(is) no {usage.plan_name}. Contas criadas: {usage.used_emails} de {usage.email_limit}.</span></div> : null}
    <div className="formNotice">Sem domínio próprio, o endereço usa <strong>@imoveis.lenoy.com.br</strong>. Se a imobiliária tiver um domínio próprio já verificado, ele também aparece como opção. Criar e-mail é sempre uma decisão do cliente.</div>

    <form className="propertyForm" onSubmit={createMailbox}>
      <div className="emailCreateGrid">
        <label>Nome do e-mail<input value={localPart} onChange={(event) => setLocalPart(event.target.value.toLowerCase())} placeholder="contato" autoCapitalize="none" /></label>
        <label>Domínio<select value={domain} onChange={(event) => setDomain(event.target.value)}>{domains.map((item) => <option key={item} value={item}>@{item}</option>)}</select></label>
        <label>Espaço da caixa<select value={quotaMb} onChange={(event) => setQuotaMb(event.target.value)}><option value="512">512 MB</option><option value="1024">1 GB</option><option value="2048">2 GB</option></select></label>
      </div>
      <div className="formGrid"><label>Endereço que será criado<div className="emailAddressPreview">{previewAddress}</div></label><label>Senha inicial<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Mínimo de 10 caracteres" /></label></div>
      <div className="formActions"><button className="button primary" disabled={busy || !usage?.can_create}>{busy ? "Criando..." : usage?.can_create ? "Criar e-mail" : "Limite indisponível"}</button></div>
    </form>

    {mailboxes.length ? <div className="adminTableWrap" style={{ marginTop: 18 }}><table className="adminTable"><thead><tr><th>Conta</th><th>Status</th><th>Espaço</th><th>Criada em</th></tr></thead><tbody>{mailboxes.map((mailbox) => <tr key={mailbox.id}><td><strong>{mailbox.email_address}</strong></td><td><span className={`mailboxStatus ${mailbox.status}`}>{statusLabel[mailbox.status]}</span></td><td>{mailbox.quota_mb >= 1024 ? `${(mailbox.quota_mb / 1024).toLocaleString("pt-BR")} GB` : `${mailbox.quota_mb} MB`}</td><td>{new Date(mailbox.created_at).toLocaleDateString("pt-BR")}</td></tr>)}</tbody></table></div> : <div className="emptyMini" style={{ marginTop: 18 }}>Nenhuma conta criada. Isso não consome nada do servidor enquanto o cliente não usar o recurso.</div>}
    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
