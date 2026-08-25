"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

const PLATFORM_MAIL_DOMAIN = "imoveis.lenoy.com.br";
const MAIL_SERVER = "pro126.dnspro.com.br";
const WEBMAIL_URL = `https://${MAIL_SERVER}:2096/`;

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

type MailJob = {
  id: string;
  email_address: string;
  domain: string;
  quota_mb: number;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  requested_at: string;
  completed_at: string | null;
  last_error: string | null;
};

type DomainRow = {
  hostname: string;
  verified: boolean;
  kind: "platform" | "custom";
  is_primary: boolean;
};

type ProvisionResult = {
  ok?: boolean;
  queued?: boolean;
  email?: string;
  message?: string;
  error?: string;
};

type PasswordAssessment = {
  label: "Fraca" | "Média" | "Forte";
  accepted: boolean;
  guidance: string;
};

const statusLabel: Record<Mailbox["status"], string> = {
  pending: "Preparando",
  active: "Ativo",
  suspended: "Suspenso",
  error: "Com problema",
  deleted: "Removido",
};

const jobLabel: Record<MailJob["status"], string> = {
  queued: "Na fila",
  processing: "Criando no servidor",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

function mailDomainFromHostname(value: string) {
  const hostname = value.trim().toLowerCase().replace(/\.$/, "");
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

function assessPassword(value: string): PasswordAssessment {
  if (!value) {
    return {
      label: "Fraca",
      accepted: false,
      guidance: "Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.",
    };
  }

  const checks = [
    value.length >= 12,
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];
  const passed = checks.filter(Boolean).length;
  const accepted = checks.every(Boolean);

  if (accepted) {
    return {
      label: "Forte",
      accepted: true,
      guidance: "Senha adequada para envio ao servidor. O cPanel ainda faz a validação final de segurança.",
    };
  }

  if (passed >= 3 && value.length >= 10) {
    return {
      label: "Média",
      accepted: false,
      guidance: "Ainda pode ser recusada pelo servidor. Complete 12 caracteres e combine maiúscula, minúscula, número e símbolo.",
    };
  }

  return {
    label: "Fraca",
    accepted: false,
    guidance: "Senha muito simples. Use 12 ou mais caracteres e misture maiúsculas, minúsculas, números e símbolos.",
  };
}

async function edgeErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : "Não foi possível acessar o servidor de e-mail.";
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
  const [jobs, setJobs] = useState<MailJob[]>([]);
  const [customDomains, setCustomDomains] = useState<DomainRow[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [password, setPassword] = useState("");
  const [quotaMb, setQuotaMb] = useState("1024");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showMailSettings, setShowMailSettings] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const currentAgency = await getCurrentAgency();
    if (!currentAgency) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    setAgencyId(currentAgency.agencyId);

    const [usageResult, mailResult, domainResult, jobResult] = await Promise.all([
      supabaseBrowser.rpc("agency_email_usage_snapshot", { p_agency_id: currentAgency.agencyId }),
      supabaseBrowser
        .from("agency_mailboxes")
        .select("id,email_address,domain,quota_mb,status,created_at")
        .eq("agency_id", currentAgency.agencyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabaseBrowser
        .from("agency_domains")
        .select("hostname,verified,kind,is_primary")
        .eq("agency_id", currentAgency.agencyId)
        .eq("verified", true),
      supabaseBrowser.rpc("agency_mailbox_job_snapshot", { p_agency_id: currentAgency.agencyId }),
    ]);

    if (usageResult.error) setMessage(usageResult.error.message);
    const usageRows = Array.isArray(usageResult.data) ? usageResult.data : [];
    setUsage((usageRows[0] || null) as Usage | null);

    if (!mailResult.error) setMailboxes((mailResult.data || []) as Mailbox[]);
    if (!jobResult.error) {
      setJobs(((jobResult.data || []) as MailJob[]).filter((item) => item.status !== "completed" && item.status !== "cancelled"));
    }

    const domainMap = new Map<string, DomainRow>();
    for (const row of (domainResult.data || []) as DomainRow[]) {
      if (row.kind !== "custom") continue;
      const verifiedHostname = row.hostname.trim().toLowerCase().replace(/\.$/, "");
      if (!verifiedHostname || verifiedHostname === PLATFORM_MAIL_DOMAIN || verifiedHostname.endsWith(`.${PLATFORM_MAIL_DOMAIN}`)) continue;
      const mailHostname = mailDomainFromHostname(verifiedHostname);
      if (!mailHostname) continue;
      const previous = domainMap.get(mailHostname);
      domainMap.set(mailHostname, {
        ...row,
        hostname: mailHostname,
        is_primary: Boolean(row.is_primary || previous?.is_primary),
      });
    }
    const verifiedCustom = Array.from(domainMap.values());

    setCustomDomains(verifiedCustom);
    setCustomDomain((current) => {
      if (current && verifiedCustom.some((row) => row.hostname === current)) return current;
      return verifiedCustom.find((row) => row.is_primary)?.hostname || verifiedCustom[0]?.hostname || "";
    });
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const normalizedLocalPart = useMemo(() => localPart.trim().toLowerCase().replace(/\s+/g, ""), [localPart]);
  const passwordAssessment = useMemo(() => assessPassword(password), [password]);
  const platformPreview = normalizedLocalPart ? `${normalizedLocalPart}@${PLATFORM_MAIL_DOMAIN}` : `nome@${PLATFORM_MAIL_DOMAIN}`;
  const customPreview = customDomain
    ? `${normalizedLocalPart || "nome"}@${customDomain}`
    : "Configure e verifique primeiro o seu domínio próprio";

  async function testConnection() {
    if (!supabaseBrowser || !agencyId || testing) return;
    setTesting(true);
    setMessage("");
    const { data, error } = await supabaseBrowser.functions.invoke("provision-professional-email", {
      body: { agency_id: agencyId, action: "test" },
    });
    setTesting(false);
    if (error) return setMessage(await edgeErrorMessage(error));
    const payload = (data || {}) as ProvisionResult;
    setMessage(payload.ok
      ? (payload.message || "Conexão com o servidor de e-mail estabelecida.")
      : (payload.error || "Não foi possível conectar ao servidor de e-mail."));
  }

  async function queueMailbox(targetDomain: string) {
    if (!supabaseBrowser || !agencyId || busy) return;
    if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(normalizedLocalPart)) {
      return setMessage("Use letras minúsculas, números, ponto, traço ou sublinhado no nome do e-mail.");
    }
    if (!passwordAssessment.accepted) {
      return setMessage(`Senha ${passwordAssessment.label.toLowerCase()}: ${passwordAssessment.guidance}`);
    }
    if (!targetDomain) return setMessage("Configure e verifique o domínio próprio antes de criar um e-mail nele.");

    setBusy(true);
    setMessage("");
    const { data, error } = await supabaseBrowser.functions.invoke("provision-professional-email", {
      body: {
        agency_id: agencyId,
        local_part: normalizedLocalPart,
        domain: targetDomain,
        password,
        quota_mb: Number(quotaMb || 1024),
      },
    });
    setBusy(false);

    if (error) return setMessage(await edgeErrorMessage(error));
    const payload = (data || {}) as ProvisionResult;
    if (!payload.ok) return setMessage(payload.error || "Não foi possível enviar a criação da conta de e-mail.");

    setLocalPart("");
    setPassword("");
    setMessage(payload.queued
      ? `${payload.email} entrou na fila. O servidor local processará a conta automaticamente.`
      : (payload.message || `${payload.email} processado com sucesso.`));
    await load();
  }

  async function createPlatformMailbox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await queueMailbox(PLATFORM_MAIL_DOMAIN);
  }

  function goToDomains() {
    document.getElementById("dominios")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className="adminPanel" id="emails-profissionais" data-email-flow="fixed-domain">
    <div className="adminPanelHeader">
      <div>
        <span className="eyebrow">RECURSO OPCIONAL</span>
        <h2>E-mails profissionais</h2>
        <p>Seu plano disponibiliza contas de e-mail, mas nenhuma é criada automaticamente. Use somente quando precisar.</p>
      </div>
      <span>{usage ? `${usage.used_emails}/${usage.email_limit} em uso/processamento` : "Carregando..."}</span>
    </div>

    <div className="formNotice">
      <strong>Servidor de e-mail:</strong> o teste valida o worker local e a API do próprio cPanel.{" "}
      <button type="button" className="button secondary small" onClick={() => void testConnection()} disabled={testing || !agencyId}>
        {testing ? "Testando..." : "Testar conexão com o servidor"}
      </button>
    </div>

    {usage ? <div className="emailUsageLine">
      <strong>{usage.remaining_emails}</strong>
      <span>conta(s) ainda disponível(is) no {usage.plan_name}. Em uso ou processamento: {usage.used_emails} de {usage.email_limit}.</span>
    </div> : null}

    <div className="formNotice">
      A criação rápida usa sempre <strong>@{PLATFORM_MAIL_DOMAIN}</strong>. O domínio próprio fica em um fluxo separado e só é liberado depois de verificado.
      <button type="button" className="button secondary small" onClick={() => setCustomMode((value) => !value)} style={{ marginLeft: 10 }}>
        {customMode ? "Fechar domínio próprio" : "Usar meu próprio domínio"}
      </button>
    </div>

    <form className="propertyForm" onSubmit={createPlatformMailbox}>
      <div className="emailCreateGrid">
        <label>
          Nome do e-mail
          <input value={localPart} onChange={(event) => setLocalPart(event.target.value.toLowerCase())} placeholder="contato" autoCapitalize="none" />
        </label>
        <label>
          Domínio
          <div className="emailAddressPreview">@{PLATFORM_MAIL_DOMAIN}</div>
        </label>
        <label>
          Espaço da caixa
          <select value={quotaMb} onChange={(event) => setQuotaMb(event.target.value)}>
            <option value="512">512 MB</option>
            <option value="1024">1 GB</option>
            <option value="2048">2 GB</option>
          </select>
        </label>
      </div>
      <div className="formGrid">
        <label>Endereço que será criado<div className="emailAddressPreview">{platformPreview}</div></label>
        <label>
          Senha inicial
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="12+ caracteres, maiúscula, número e símbolo" />
          <small aria-live="polite"><strong>Força: {passwordAssessment.label}.</strong> {passwordAssessment.guidance}</small>
        </label>
      </div>
      <div className="formActions">
        <button className="button primary" disabled={busy || !usage?.can_create || !passwordAssessment.accepted}>
          {busy ? "Enviando..." : usage?.can_create ? (passwordAssessment.accepted ? "Criar e-mail" : "Crie uma senha forte") : "Limite indisponível"}
        </button>
      </div>
    </form>

    {customMode ? <div className="domainInstructions" style={{ marginTop: 18 }}>
      <strong>Usar meu próprio domínio</strong>
      {customDomains.length === 0 ? <>
        <p>Primeiro conecte e verifique o domínio da imobiliária. Depois ele será liberado aqui para criação de contas como <b>contato@suaimobiliaria.com.br</b>.</p>
        <button type="button" className="button secondary small" onClick={goToDomains}>Configurar domínio próprio</button>
      </> : <>
        <p>Escolha abaixo um dos domínios próprios já verificados. Se o site usa <b>www</b>, o e-mail usa automaticamente o domínio principal sem <b>www</b>.</p>
        <div className="accessList" style={{ marginTop: 12 }}>
          {customDomains.map((item) => <article className="accessRow" key={item.hostname}>
            <div className="accessIdentity">
              <strong>{item.hostname}</strong>
              <span>Domínio da imobiliária verificado</span>
              <small>{item.is_primary ? "Domínio principal" : "Domínio adicional"}</small>
            </div>
            <div className="accessActions">
              <button type="button" className={customDomain === item.hostname ? "miniButton" : "miniButton muted"} onClick={() => setCustomDomain(item.hostname)}>
                {customDomain === item.hostname ? "Selecionado" : "Usar este domínio"}
              </button>
            </div>
          </article>)}
        </div>
        <div className="formNotice" style={{ marginTop: 12 }}>
          Endereço com domínio próprio: <strong>{customPreview}</strong>
          <button
            type="button"
            className="button secondary small"
            style={{ marginLeft: 10 }}
            disabled={busy || !usage?.can_create || !customDomain || !passwordAssessment.accepted}
            onClick={() => void queueMailbox(customDomain)}
          >
            {busy ? "Enviando..." : passwordAssessment.accepted ? "Criar com meu domínio" : "Crie uma senha forte"}
          </button>
        </div>
      </>}
    </div> : null}

    <div className="domainInstructions" style={{ marginTop: 18 }}>
      <strong>Acessar e configurar o e-mail</strong>
      <p>Depois que a conta estiver ativa, o usuário pode acessar pelo Webmail ou cadastrar a mesma caixa no Gmail, Outlook, celular e outros aplicativos de e-mail.</p>
      <div className="formActions">
        <a className="button primary" href={WEBMAIL_URL} target="_blank" rel="noreferrer">Abrir Webmail</a>
        <button type="button" className="button secondary" onClick={() => setShowMailSettings((value) => !value)}>
          {showMailSettings ? "Ocultar configurações" : "Ver configurações para Gmail / Outlook"}
        </button>
      </div>

      {showMailSettings ? <div className="adminTableWrap" style={{ marginTop: 14 }}>
        <table className="adminTable">
          <tbody>
            <tr><th>Usuário</th><td>Endereço completo do e-mail, por exemplo: contato@{PLATFORM_MAIL_DOMAIN}</td></tr>
            <tr><th>Senha</th><td>A senha definida para a caixa de e-mail.</td></tr>
            <tr><th>Entrada IMAP</th><td><strong>{MAIL_SERVER}</strong> — porta <strong>993</strong> — SSL/TLS</td></tr>
            <tr><th>Entrada POP3</th><td><strong>{MAIL_SERVER}</strong> — porta <strong>995</strong> — SSL/TLS</td></tr>
            <tr><th>Saída SMTP</th><td><strong>{MAIL_SERVER}</strong> — porta <strong>465</strong> — SSL/TLS — autenticação obrigatória</td></tr>
          </tbody>
        </table>
        <div className="formNotice" style={{ marginTop: 12 }}>
          <strong>Gmail:</strong> no aplicativo Gmail, Outlook e celulares, prefira IMAP. Para serviços que importam mensagens de outra conta por POP3, use a porta 995. Para enviar usando este endereço, configure também o SMTP acima.
        </div>
      </div> : null}
    </div>

    {jobs.length ? <div className="adminTableWrap" style={{ marginTop: 18 }}>
      <table className="adminTable">
        <thead><tr><th>Solicitação</th><th>Status</th><th>Detalhe</th></tr></thead>
        <tbody>{jobs.map((job) => <tr key={job.id}>
          <td><strong>{job.email_address}</strong></td>
          <td><span className={`mailboxStatus ${job.status === "failed" ? "error" : "pending"}`}>{jobLabel[job.status]}</span></td>
          <td>{job.last_error || "Aguardando processamento automático do servidor."}</td>
        </tr>)}</tbody>
      </table>
    </div> : null}

    {mailboxes.length ? <div className="adminTableWrap" style={{ marginTop: 18 }}>
      <table className="adminTable">
        <thead><tr><th>Conta</th><th>Status</th><th>Espaço</th><th>Criada em</th></tr></thead>
        <tbody>{mailboxes.map((mailbox) => <tr key={mailbox.id}>
          <td><strong>{mailbox.email_address}</strong></td>
          <td><span className={`mailboxStatus ${mailbox.status}`}>{statusLabel[mailbox.status]}</span></td>
          <td>{mailbox.quota_mb >= 1024 ? `${(mailbox.quota_mb / 1024).toLocaleString("pt-BR")} GB` : `${mailbox.quota_mb} MB`}</td>
          <td>{new Date(mailbox.created_at).toLocaleDateString("pt-BR")}</td>
        </tr>)}</tbody>
      </table>
    </div> : <div className="emptyMini" style={{ marginTop: 18 }}>Nenhuma conta criada. Isso não consome nada do servidor enquanto o cliente não usar o recurso.</div>}

    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
