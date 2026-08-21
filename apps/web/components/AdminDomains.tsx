"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type DomainRow = {
  id: string;
  hostname: string;
  kind: "platform" | "custom";
  is_primary: boolean;
  verified: boolean;
  verified_at: string | null;
  verification_token?: string | null;
  verification_status?: "pending" | "checking" | "verified" | "failed";
  verification_error?: string | null;
};

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0].split(":")[0];
}

const verificationLabels: Record<string, string> = {
  pending: "Aguardando DNS",
  checking: "Verificando",
  verified: "Verificado",
  failed: "DNS não localizado",
};

export default function AdminDomains() {
  const [agencyId, setAgencyId] = useState("");
  const [agencySlug, setAgencySlug] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [canUseCustomDomain, setCanUseCustomDomain] = useState(false);
  const [checkingEntitlement, setCheckingEntitlement] = useState(Boolean(isSupabaseConfigured));

  async function load() {
    if (!supabaseBrowser) return;
    const currentAgency = await getCurrentAgency();
    if (!currentAgency) {
      setMessage("Não foi possível identificar a imobiliária desta conta.");
      setCheckingEntitlement(false);
      return;
    }
    setAgencyId(currentAgency.agencyId);
    setAgencySlug(currentAgency.agencySlug);
    const [domainResult, entitlementResult] = await Promise.all([
      supabaseBrowser
        .from("agency_domains")
        .select("id,hostname,kind,is_primary,verified,verified_at,verification_token,verification_status,verification_error")
        .eq("agency_id", currentAgency.agencyId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
      supabaseBrowser.rpc("agency_can_use_custom_domain", { p_agency_id: currentAgency.agencyId }),
    ]);
    setCheckingEntitlement(false);
    if (domainResult.error) setMessage(domainResult.error.message);
    else setDomains((domainResult.data || []) as DomainRow[]);
    if (!entitlementResult.error) setCanUseCustomDomain(entitlementResult.data === true);
  }

  useEffect(() => { void load(); }, []);

  const platformDomain = useMemo(() => domains.find((item) => item.kind === "platform")?.hostname || (agencySlug ? `${agencySlug}.imoveis.lenoy.com.br` : ""), [domains, agencySlug]);

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    if (!canUseCustomDomain) return setMessage("Seu plano atual não inclui domínio próprio. O endereço LENOY continua disponível normalmente.");
    const form = new FormData(event.currentTarget);
    const hostname = normalizeHost(String(form.get("hostname") || ""));
    if (!hostname || !hostname.includes(".")) return setMessage("Informe um domínio válido, por exemplo www.minhaimobiliaria.com.br.");
    if (hostname.endsWith(".imoveis.lenoy.com.br") || hostname === "imoveis.lenoy.com.br") return setMessage("Os endereços da plataforma são criados automaticamente.");
    setSaving(true); setMessage("");
    const { data, error } = await supabaseBrowser.rpc("request_custom_agency_domain", {
      p_agency_id: agencyId,
      p_hostname: hostname,
    });
    setSaving(false);
    if (error) return setMessage(error.message.includes("plano atual") ? "Seu plano atual não inclui domínio próprio." : error.message);
    const row = Array.isArray(data) ? data[0] : null;
    event.currentTarget.reset();
    setMessage(row?.verification_token
      ? `Domínio adicionado. Crie o CNAME para imoveis.lenoy.com.br. Token de verificação: ${row.verification_token}`
      : "Domínio adicionado. Faça o apontamento DNS e aguarde a verificação da plataforma.");
    await load();
  }

  async function removeDomain(domain: DomainRow) {
    if (!supabaseBrowser || domain.kind !== "custom") return;
    if (!window.confirm(`Remover ${domain.hostname} desta imobiliária?`)) return;
    const { error } = await supabaseBrowser.from("agency_domains").delete().eq("id", domain.id).eq("agency_id", agencyId).eq("kind", "custom");
    if (error) return setMessage(error.message);
    setMessage("Domínio removido.");
    await load();
  }

  return <div className="adminPanel" id="dominios">
    <div className="adminPanelHeader"><div><span className="eyebrow">ENDEREÇOS</span><h2>Domínios da imobiliária</h2><p>Use o endereço LENOY ou conecte um domínio próprio quando o seu plano permitir.</p></div><span>{isSupabaseConfigured ? `${domains.length || (platformDomain ? 1 : 0)} endereço(s)` : "Modo demonstração"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">O gerenciamento real de domínios será ativado com o Supabase de produção.</div> : null}

    {platformDomain ? <div className="domainPrimaryCard"><div><span className="eyebrow">ENDEREÇO PADRÃO</span><strong>{platformDomain}</strong><small>Gerado automaticamente pela plataforma e disponível independentemente de domínio próprio.</small></div><span className="statusPill">Ativo</span></div> : null}

    <div className="domainInstructions"><strong>Domínio próprio</strong><p>Cadastre preferencialmente <b>www.suaimobiliaria.com.br</b>. No provedor do domínio, crie um CNAME apontando para <b>imoveis.lenoy.com.br</b>. O endereço só entra no ar depois que a plataforma confirmar o DNS e liberar o certificado HTTPS.</p></div>

    {checkingEntitlement ? <div className="formNotice">Verificando recursos do plano...</div> : !canUseCustomDomain && isSupabaseConfigured ? <div className="formNotice">O plano atual não inclui domínio próprio. O site no endereço <strong>{platformDomain || "da plataforma"}</strong> continua funcionando normalmente.</div> : null}

    <form className="brokerForm" onSubmit={addDomain}>
      <input name="hostname" placeholder="www.suaimobiliaria.com.br" autoCapitalize="none" autoCorrect="off" disabled={!canUseCustomDomain || saving} />
      <button className="button primary" type="submit" disabled={saving || !canUseCustomDomain}>{saving ? "Adicionando..." : "+ Adicionar domínio"}</button>
    </form>
    {message ? <div className="formMessage">{message}</div> : null}

    {domains.filter((domain) => domain.kind === "custom").length > 0 ? <div className="accessList">{domains.filter((domain) => domain.kind === "custom").map((domain) => {
      const status = domain.verified ? "verified" : domain.verification_status || "pending";
      return <article className="accessRow" key={domain.id}><div className="accessIdentity"><strong>{domain.hostname}</strong><span>{domain.verified ? "DNS verificado e domínio autorizado" : verificationLabels[status] || "Aguardando verificação"}</span><small>{domain.is_primary ? "Domínio principal" : "Domínio adicional"}{domain.verification_token ? ` · token ${domain.verification_token}` : ""}</small>{domain.verification_error ? <small>{domain.verification_error}</small> : null}</div><div className="accessActions"><span className={`statusPill ${domain.verified ? "" : "muted"}`}>{verificationLabels[status] || status}</span><button className="miniButton danger" type="button" onClick={() => void removeDomain(domain)}>Remover</button></div></article>;
    })}</div> : <div className="emptyMini">Nenhum domínio próprio cadastrado ainda.</div>}
  </div>;
}
