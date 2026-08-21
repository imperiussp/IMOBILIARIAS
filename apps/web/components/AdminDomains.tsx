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
};

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0].split(":")[0];
}

export default function AdminDomains() {
  const [agencyId, setAgencyId] = useState("");
  const [agencySlug, setAgencySlug] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabaseBrowser) return;
    const currentAgency = await getCurrentAgency();
    if (!currentAgency) {
      setMessage("Não foi possível identificar a imobiliária desta conta.");
      return;
    }
    setAgencyId(currentAgency.agencyId);
    setAgencySlug(currentAgency.agencySlug);
    const { data, error } = await supabaseBrowser
      .from("agency_domains")
      .select("id,hostname,kind,is_primary,verified,verified_at")
      .eq("agency_id", currentAgency.agencyId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) setMessage(error.message);
    else setDomains((data || []) as DomainRow[]);
  }

  useEffect(() => { void load(); }, []);

  const platformDomain = useMemo(() => domains.find((item) => item.kind === "platform")?.hostname || (agencySlug ? `${agencySlug}.imoveis.lenoy.com.br` : ""), [domains, agencySlug]);

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    const form = new FormData(event.currentTarget);
    const hostname = normalizeHost(String(form.get("hostname") || ""));
    if (!hostname || !hostname.includes(".")) return setMessage("Informe um domínio válido, por exemplo www.minhaimobiliaria.com.br.");
    if (hostname.endsWith(".imoveis.lenoy.com.br") || hostname === "imoveis.lenoy.com.br") return setMessage("Os endereços da plataforma são criados automaticamente.");
    setSaving(true); setMessage("");
    const { error } = await supabaseBrowser.from("agency_domains").insert({
      agency_id: agencyId,
      hostname,
      kind: "custom",
      is_primary: false,
      verified: false,
    });
    setSaving(false);
    if (error) return setMessage(error.code === "23505" ? "Este domínio já está cadastrado na plataforma." : error.message);
    event.currentTarget.reset();
    setMessage("Domínio adicionado. Agora faça o apontamento DNS e aguarde a verificação.");
    await load();
  }

  async function removeDomain(domain: DomainRow) {
    if (!supabaseBrowser || domain.kind !== "custom") return;
    if (!window.confirm(`Remover ${domain.hostname} desta imobiliária?`)) return;
    const { error } = await supabaseBrowser.from("agency_domains").delete().eq("id", domain.id).eq("agency_id", agencyId);
    if (error) return setMessage(error.message);
    setMessage("Domínio removido.");
    await load();
  }

  return <div className="adminPanel" id="dominios">
    <div className="adminPanelHeader"><div><span className="eyebrow">ENDEREÇOS</span><h2>Domínios da imobiliária</h2><p>Use o endereço LENOY ou conecte um domínio próprio ao mesmo site.</p></div><span>{isSupabaseConfigured ? `${domains.length || (platformDomain ? 1 : 0)} endereço(s)` : "Modo demonstração"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">O gerenciamento real de domínios será ativado com o Supabase de produção.</div> : null}

    {platformDomain ? <div className="domainPrimaryCard"><div><span className="eyebrow">ENDEREÇO PADRÃO</span><strong>{platformDomain}</strong><small>Gerado automaticamente pela plataforma</small></div><span className="statusPill">Ativo</span></div> : null}

    <div className="domainInstructions"><strong>Para usar seu domínio próprio</strong><p>Cadastre abaixo preferencialmente um endereço como <b>www.suaimobiliaria.com.br</b>. Depois, no provedor do domínio, crie um apontamento CNAME desse endereço para <b>imoveis.lenoy.com.br</b>. O domínio só será liberado ao público depois da verificação.</p></div>

    <form className="brokerForm" onSubmit={addDomain}>
      <input name="hostname" placeholder="www.suaimobiliaria.com.br" autoCapitalize="none" autoCorrect="off" />
      <button className="button primary" type="submit" disabled={saving}>{saving ? "Adicionando..." : "+ Adicionar domínio"}</button>
    </form>
    {message ? <div className="formMessage">{message}</div> : null}

    {domains.filter((domain) => domain.kind === "custom").length > 0 ? <div className="accessList">{domains.filter((domain) => domain.kind === "custom").map((domain) => <article className="accessRow" key={domain.id}><div className="accessIdentity"><strong>{domain.hostname}</strong><span>{domain.verified ? "DNS verificado e domínio autorizado" : "Aguardando apontamento/verificação DNS"}</span><small>{domain.is_primary ? "Domínio principal" : "Domínio adicional"}</small></div><div className="accessActions"><span className={`statusPill ${domain.verified ? "" : "muted"}`}>{domain.verified ? "Verificado" : "Pendente"}</span><button className="miniButton danger" type="button" onClick={() => void removeDomain(domain)}>Remover</button></div></article>)}</div> : <div className="emptyMini">Nenhum domínio próprio cadastrado ainda.</div>}
  </div>;
}
