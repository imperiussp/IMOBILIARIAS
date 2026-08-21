"use client";

import { FormEvent, useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Broker = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  creci: string | null;
  photo_url: string | null;
  area_of_operation: string | null;
  active: boolean;
};

export default function AdminBrokers() {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Broker | null>(null);

  async function load(targetAgencyId?: string) {
    if (!supabaseBrowser) return;
    const resolvedAgencyId = targetAgencyId || agencyId;
    if (!resolvedAgencyId) return;
    const result = await supabaseBrowser.from("brokers").select("id,name,phone,whatsapp,email,creci,photo_url,area_of_operation,active").eq("agency_id", resolvedAgencyId).order("name");
    if (result.error) setMessage(result.error.message);
    else setBrokers((result.data || []) as Broker[]);
  }

  useEffect(() => {
    if (!supabaseBrowser) return;
    let active = true;
    void (async () => {
      const currentAgency = await getCurrentAgency();
      if (!active) return;
      if (!currentAgency) {
        setMessage("Vincule esta conta a uma imobiliária para gerenciar corretores.");
        return;
      }
      setAgencyId(currentAgency.agencyId);
      setAgencyName(currentAgency.agencyName);
      await load(currentAgency.agencyId);
    })();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado.");
    if (!agencyId) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return setMessage("Informe o nome do corretor.");
    setSaving(true);
    const result = await supabaseBrowser.from("brokers").insert({
      agency_id: agencyId,
      name,
      phone: String(form.get("phone") || "").replace(/\D/g, "") || null,
      whatsapp: String(form.get("whatsapp") || "").replace(/\D/g, "") || null,
      email: String(form.get("email") || "").trim() || null,
      creci: String(form.get("creci") || "").trim() || null,
      photo_url: String(form.get("photo_url") || "").trim() || null,
      area_of_operation: String(form.get("area_of_operation") || "").trim() || null,
      active: true,
    });
    setSaving(false);
    if (result.error) return setMessage(result.error.message);
    event.currentTarget.reset();
    setMessage("Corretor cadastrado.");
    await load();
  }

  async function toggle(broker: Broker) {
    if (!supabaseBrowser || !agencyId) return;
    const result = await supabaseBrowser.from("brokers").update({ active: !broker.active }).eq("id", broker.id).eq("agency_id", agencyId);
    if (result.error) return setMessage(result.error.message);
    setBrokers((current) => current.map((item) => item.id === broker.id ? { ...item, active: !item.active } : item));
  }

  async function saveEdit() {
    if (!supabaseBrowser || !editing || !agencyId) return;
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      phone: editing.phone?.replace(/\D/g, "") || null,
      whatsapp: editing.whatsapp?.replace(/\D/g, "") || null,
      email: editing.email?.trim() || null,
      creci: editing.creci?.trim() || null,
      photo_url: editing.photo_url?.trim() || null,
      area_of_operation: editing.area_of_operation?.trim() || null,
    };
    const { error } = await supabaseBrowser.from("brokers").update(payload).eq("id", editing.id).eq("agency_id", agencyId);
    setSaving(false);
    if (error) return setMessage(error.message);
    setEditing(null);
    setMessage("Dados do corretor atualizados.");
    await load();
  }

  return (
    <div className="adminPanel" id="corretores">
      <div className="adminPanelHeader"><div><span className="eyebrow">EQUIPE</span><h2>Corretores</h2><p>Cadastre responsáveis, área de atuação e canais de atendimento{agencyName ? ` de ${agencyName}` : ""}.</p></div><span>{isSupabaseConfigured ? `${brokers.length} cadastrado(s)` : "Modo demonstração"}</span></div>
      {!isSupabaseConfigured && <div className="formNotice">Configure o Supabase exclusivo do IMOBILIARIAS para cadastrar e gerenciar corretores.</div>}
      <form className="brokerForm expandedBrokerForm" onSubmit={submit}>
        <input name="name" placeholder="Nome do corretor" required />
        <input name="phone" placeholder="Telefone" inputMode="tel" />
        <input name="whatsapp" placeholder="WhatsApp com DDD" inputMode="tel" />
        <input name="creci" placeholder="CRECI" />
        <input name="email" placeholder="E-mail" type="email" />
        <input name="area_of_operation" placeholder="Área de atuação" />
        <input name="photo_url" placeholder="URL da foto do perfil" />
        <button className="button primary" type="submit" disabled={saving || (isSupabaseConfigured && !agencyId)}>{saving ? "Salvando..." : "+ Adicionar corretor"}</button>
      </form>
      {message && <div className="formMessage">{message}</div>}
      {brokers.length > 0 && <div className="brokerList">{brokers.map((broker) => <article key={broker.id} className="brokerRow brokerDetailedRow"><div className="brokerIdentity">{broker.photo_url ? <img src={broker.photo_url} alt="" className="brokerAvatar" /> : <div className="brokerAvatar brokerAvatarFallback">{broker.name.slice(0,1).toUpperCase()}</div>}<div><strong>{broker.name}</strong><span>{broker.creci || "CRECI não informado"}{broker.area_of_operation ? ` · ${broker.area_of_operation}` : ""}</span><span>{broker.whatsapp || broker.phone || "Contato não informado"}{broker.email ? ` · ${broker.email}` : ""}</span></div></div><div className="brokerActions"><button className="miniButton" type="button" onClick={() => setEditing({ ...broker })}>Editar</button><button className={`miniButton ${broker.active ? "" : "muted"}`} type="button" onClick={() => void toggle(broker)}>{broker.active ? "Ativo" : "Inativo"}</button></div></article>)}</div>}

      {editing ? <div className="inlineEditor"><div className="adminPanelHeader"><div><span className="eyebrow">EDITAR CORRETOR</span><h3>{editing.name}</h3></div><button className="miniButton" onClick={() => setEditing(null)}>Fechar</button></div><div className="propertyForm"><div className="formGrid"><label>Nome<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><label>CRECI<input value={editing.creci || ""} onChange={(e) => setEditing({ ...editing, creci: e.target.value })} /></label></div><div className="formGrid"><label>Telefone<input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></label><label>WhatsApp<input value={editing.whatsapp || ""} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} /></label></div><div className="formGrid"><label>E-mail<input type="email" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label><label>Área de atuação<input value={editing.area_of_operation || ""} onChange={(e) => setEditing({ ...editing, area_of_operation: e.target.value })} /></label></div><label>URL da foto<input value={editing.photo_url || ""} onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })} /></label><div className="formActions"><button className="button primary" onClick={() => void saveEdit()} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button></div></div></div> : null}
    </div>
  );
}
