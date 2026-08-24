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

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

export default function AdminBrokers() {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Broker | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);

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

  function validatePhoto(file: File | null) {
    if (!file || file.size === 0) return "Selecione uma foto do corretor.";
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return "Use uma foto JPG, PNG ou WEBP.";
    if (file.size > MAX_PHOTO_SIZE) return "A foto deve ter no máximo 5 MB.";
    return "";
  }

  async function uploadPhoto(file: File) {
    if (!supabaseBrowser || !agencyId) throw new Error("Imobiliária ativa não encontrada.");
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${agencyId}/brokers/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabaseBrowser.storage.from("broker-photos").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    return supabaseBrowser.storage.from("broker-photos").getPublicUrl(path).data.publicUrl;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado.");
    if (!agencyId) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") || "").trim();
    const photoFile = form.get("photo_file") instanceof File ? form.get("photo_file") as File : null;
    if (!name) return setMessage("Informe o nome do corretor.");
    const photoError = validatePhoto(photoFile);
    if (photoError) return setMessage(photoError);

    setSaving(true);
    try {
      const photoUrl = await uploadPhoto(photoFile as File);
      const result = await supabaseBrowser.from("brokers").insert({
        agency_id: agencyId,
        name,
        phone: String(form.get("phone") || "").replace(/\D/g, "") || null,
        whatsapp: String(form.get("whatsapp") || "").replace(/\D/g, "") || null,
        email: String(form.get("email") || "").trim() || null,
        creci: String(form.get("creci") || "").trim() || null,
        photo_url: photoUrl,
        area_of_operation: String(form.get("area_of_operation") || "").trim() || null,
        active: true,
      });
      if (result.error) throw result.error;
      formElement.reset();
      setMessage("Corretor cadastrado com foto.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar o corretor.");
    } finally {
      setSaving(false);
    }
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
    setMessage("");
    try {
      let photoUrl = editing.photo_url?.trim() || "";
      if (editPhotoFile) {
        const photoError = validatePhoto(editPhotoFile);
        if (photoError) throw new Error(photoError);
        photoUrl = await uploadPhoto(editPhotoFile);
      }
      if (!photoUrl) throw new Error("A foto do corretor é obrigatória.");
      const payload = {
        name: editing.name.trim(),
        phone: editing.phone?.replace(/\D/g, "") || null,
        whatsapp: editing.whatsapp?.replace(/\D/g, "") || null,
        email: editing.email?.trim() || null,
        creci: editing.creci?.trim() || null,
        photo_url: photoUrl,
        area_of_operation: editing.area_of_operation?.trim() || null,
      };
      const { error } = await supabaseBrowser.from("brokers").update(payload).eq("id", editing.id).eq("agency_id", agencyId);
      if (error) throw error;
      setEditing(null);
      setEditPhotoFile(null);
      setMessage("Dados do corretor atualizados.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o corretor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adminPanel" id="corretores">
      <div className="adminPanelHeader"><div><span className="eyebrow">EQUIPE</span><h2>Corretores</h2><p>Cadastre responsáveis, área de atuação e canais de atendimento{agencyName ? ` de ${agencyName}` : ""}. A foto é obrigatória e acompanha o corretor nas telas de equipe e permissões.</p></div><span>{isSupabaseConfigured ? `${brokers.length} cadastrado(s)` : "Modo demonstração"}</span></div>
      {!isSupabaseConfigured && <div className="formNotice">Configure o Supabase exclusivo do IMOBILIARIAS para cadastrar e gerenciar corretores.</div>}
      <form className="brokerForm expandedBrokerForm" onSubmit={submit}>
        <input name="name" placeholder="Nome do corretor" required />
        <input name="phone" placeholder="Telefone" inputMode="tel" />
        <input name="whatsapp" placeholder="WhatsApp com DDD" inputMode="tel" />
        <input name="creci" placeholder="CRECI" />
        <input name="email" placeholder="E-mail" type="email" />
        <input name="area_of_operation" placeholder="Área de atuação" />
        <label className="brokerPhotoField"><span>Foto do corretor</span><input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
        <button className="button primary" type="submit" disabled={saving || (isSupabaseConfigured && !agencyId)}>{saving ? "Salvando..." : "+ Adicionar corretor"}</button>
      </form>
      {message && <div className="formMessage">{message}</div>}
      {brokers.length > 0 && <div className="brokerList">{brokers.map((broker) => <article key={broker.id} className="brokerRow brokerDetailedRow"><div className="brokerIdentity">{broker.photo_url ? <img src={broker.photo_url} alt={broker.name} className="brokerAvatar" /> : <div className="brokerAvatar brokerAvatarFallback">{broker.name.slice(0,1).toUpperCase()}</div>}<div><strong>{broker.name}</strong><span>{broker.creci || "CRECI não informado"}{broker.area_of_operation ? ` · ${broker.area_of_operation}` : ""}</span><span>{broker.whatsapp || broker.phone || "Contato não informado"}{broker.email ? ` · ${broker.email}` : ""}</span></div></div><div className="brokerActions"><button className="miniButton" type="button" onClick={() => { setEditing({ ...broker }); setEditPhotoFile(null); }}>Editar</button><button className={`miniButton ${broker.active ? "" : "muted"}`} type="button" onClick={() => void toggle(broker)}>{broker.active ? "Ativo" : "Inativo"}</button></div></article>)}</div>}

      {editing ? <div className="inlineEditor"><div className="adminPanelHeader"><div><span className="eyebrow">EDITAR CORRETOR</span><h3>{editing.name}</h3></div><button className="miniButton" onClick={() => { setEditing(null); setEditPhotoFile(null); }}>Fechar</button></div><div className="propertyForm">{editing.photo_url ? <div className="brokerEditPhoto"><img src={editing.photo_url} alt={editing.name} className="brokerAvatar" /><span>Foto atual</span></div> : null}<div className="formGrid"><label>Nome<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><label>CRECI<input value={editing.creci || ""} onChange={(e) => setEditing({ ...editing, creci: e.target.value })} /></label></div><div className="formGrid"><label>Telefone<input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></label><label>WhatsApp<input value={editing.whatsapp || ""} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} /></label></div><div className="formGrid"><label>E-mail<input type="email" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label><label>Área de atuação<input value={editing.area_of_operation || ""} onChange={(e) => setEditing({ ...editing, area_of_operation: e.target.value })} /></label></div><label>Trocar foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)} /></label><div className="formActions"><button className="button primary" onClick={() => void saveEdit()} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button></div></div></div> : null}
    </div>
  );
}
