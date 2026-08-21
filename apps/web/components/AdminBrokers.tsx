"use client";

import { FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Broker = {
  id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  creci: string | null;
  active: boolean;
};

export default function AdminBrokers() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabaseBrowser) return;
    const result = await supabaseBrowser.from("brokers").select("id,name,whatsapp,email,creci,active").order("name");
    if (result.error) setMessage(result.error.message);
    else setBrokers((result.data || []) as Broker[]);
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!supabaseBrowser) {
      setMessage("Supabase ainda não configurado.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return setMessage("Informe o nome do corretor.");
    setSaving(true);
    const result = await supabaseBrowser.from("brokers").insert({
      name,
      whatsapp: String(form.get("whatsapp") || "").replace(/\D/g, "") || null,
      email: String(form.get("email") || "").trim() || null,
      creci: String(form.get("creci") || "").trim() || null,
      active: true,
    });
    setSaving(false);
    if (result.error) return setMessage(result.error.message);
    event.currentTarget.reset();
    setMessage("Corretor cadastrado.");
    await load();
  }

  async function toggle(broker: Broker) {
    if (!supabaseBrowser) return;
    const result = await supabaseBrowser.from("brokers").update({ active: !broker.active }).eq("id", broker.id);
    if (result.error) return setMessage(result.error.message);
    setBrokers((current) => current.map((item) => item.id === broker.id ? { ...item, active: !item.active } : item));
  }

  return (
    <div className="adminPanel" id="corretores">
      <div className="adminPanelHeader"><div><span className="eyebrow">EQUIPE</span><h2>Corretores</h2><p>Cadastre quem será responsável pelo atendimento e pelos imóveis.</p></div><span>{isSupabaseConfigured ? `${brokers.length} cadastrado(s)` : "Modo demonstração"}</span></div>
      {!isSupabaseConfigured && <div className="formNotice">Configure o Supabase para cadastrar e gerenciar corretores.</div>}
      <form className="brokerForm" onSubmit={submit}>
        <input name="name" placeholder="Nome do corretor" required />
        <input name="whatsapp" placeholder="WhatsApp com DDD" inputMode="tel" />
        <input name="creci" placeholder="CRECI" />
        <input name="email" placeholder="E-mail" type="email" />
        <button className="button primary" type="submit" disabled={saving}>{saving ? "Salvando..." : "+ Adicionar corretor"}</button>
      </form>
      {message && <div className="formMessage">{message}</div>}
      {brokers.length > 0 && <div className="brokerList">{brokers.map((broker) => <article key={broker.id} className="brokerRow"><div><strong>{broker.name}</strong><span>{broker.creci || "CRECI não informado"}{broker.whatsapp ? ` · ${broker.whatsapp}` : ""}</span></div><button className={`miniButton ${broker.active ? "" : "muted"}`} type="button" onClick={() => void toggle(broker)}>{broker.active ? "Ativo" : "Inativo"}</button></article>)}</div>}
    </div>
  );
}
