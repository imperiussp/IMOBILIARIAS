"use client";

import { FormEvent, useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type TypeRow = { id: string; name: string; slug: string; active: boolean; agency_id: string | null };
type FeatureRow = { id: string; name: string; slug: string; agency_id: string | null };

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminCatalogSettings() {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const currentAgency = await getCurrentAgency();
    if (!currentAgency) {
      setMessage("Não foi possível identificar a imobiliária desta conta.");
      return;
    }
    setAgencyId(currentAgency.agencyId);
    setAgencyName(currentAgency.agencyName);
    const scope = `agency_id.is.null,agency_id.eq.${currentAgency.agencyId}`;
    const [typesResult, featuresResult] = await Promise.all([
      supabaseBrowser.from("property_types").select("id,name,slug,active,agency_id").or(scope).order("name"),
      supabaseBrowser.from("property_features").select("id,name,slug,agency_id").or(scope).order("name"),
    ]);
    if (typesResult.error || featuresResult.error) return setMessage(typesResult.error?.message || featuresResult.error?.message || "Erro ao carregar opções.");
    setTypes((typesResult.data || []) as TypeRow[]);
    setFeatures((featuresResult.data || []) as FeatureRow[]);
  }

  useEffect(() => { void load(); }, []);

  async function addType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("type_name") || "").trim();
    if (!name) return;
    const { error } = await supabaseBrowser.from("property_types").insert({ agency_id: agencyId, name, slug: slugify(name), active: true });
    if (error) return setMessage(error.code === "23505" ? "Este tipo já existe nesta imobiliária." : error.message);
    event.currentTarget.reset();
    setMessage("Tipo de imóvel cadastrado somente para esta imobiliária.");
    await load();
  }

  async function toggleType(row: TypeRow) {
    if (!supabaseBrowser || !agencyId) return;
    if (!row.agency_id) return setMessage("Os tipos padrão da plataforma não podem ser desativados pela imobiliária.");
    const { error } = await supabaseBrowser.from("property_types").update({ active: !row.active }).eq("id", row.id).eq("agency_id", agencyId);
    if (error) return setMessage(error.message);
    setTypes((current) => current.map((item) => item.id === row.id ? { ...item, active: !item.active } : item));
  }

  async function addFeature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("feature_name") || "").trim();
    if (!name) return;
    const { error } = await supabaseBrowser.from("property_features").insert({ agency_id: agencyId, name, slug: slugify(name) });
    if (error) return setMessage(error.code === "23505" ? "Esta característica já existe nesta imobiliária." : error.message);
    event.currentTarget.reset();
    setMessage("Característica cadastrada somente para esta imobiliária.");
    await load();
  }

  async function removeFeature(row: FeatureRow) {
    if (!supabaseBrowser || !agencyId || !row.agency_id) return;
    if (!window.confirm(`Remover a característica ${row.name} desta imobiliária?`)) return;
    const { error } = await supabaseBrowser.from("property_features").delete().eq("id", row.id).eq("agency_id", agencyId);
    if (error) return setMessage(error.message);
    setMessage("Característica removida da imobiliária.");
    await load();
  }

  return (
    <div className="adminPanel" id="catalogo-config">
      <div className="adminPanelHeader"><div><span className="eyebrow">CONFIGURAÇÕES</span><h2>Tipos e características</h2><p>Use os itens padrão da plataforma e crie opções exclusivas para {agencyName || "sua imobiliária"}.</p></div><span>{isSupabaseConfigured ? `${types.length} tipos · ${features.length} características` : "Modo demonstração"}</span></div>
      {!isSupabaseConfigured && <div className="formNotice">Esta área será ativada no Supabase exclusivo do IMOBILIARIAS.</div>}
      <div className="adminSplit">
        <section><h3>Tipos de imóvel</h3><form className="simpleInlineForm" onSubmit={addType}><input name="type_name" placeholder="Ex.: Sobrado" required /><button className="button primary" type="submit" disabled={!agencyId}>Adicionar</button></form><div className="settingsList">{types.map((row) => <div className="settingsRow" key={row.id}><div><strong>{row.name}</strong><span>{row.agency_id ? "Exclusivo desta imobiliária" : "Padrão da plataforma"} · {row.slug}</span></div><button className={`miniButton ${row.active ? "" : "muted"}`} disabled={!row.agency_id} title={!row.agency_id ? "Item padrão da plataforma" : undefined} onClick={() => void toggleType(row)}>{row.agency_id ? (row.active ? "Ativo" : "Inativo") : "Padrão"}</button></div>)}</div></section>
        <section><h3>Características</h3><form className="simpleInlineForm" onSubmit={addFeature}><input name="feature_name" placeholder="Ex.: Energia solar" required /><button className="button primary" type="submit" disabled={!agencyId}>Adicionar</button></form><div className="settingsList">{features.map((row) => <div className="settingsRow" key={row.id}><div><strong>{row.name}</strong><span>{row.agency_id ? "Exclusiva desta imobiliária" : "Padrão da plataforma"}</span></div>{row.agency_id ? <button className="miniButton danger" type="button" onClick={() => void removeFeature(row)}>Remover</button> : <span className="statusPill">Padrão</span>}</div>)}</div></section>
      </div>
      {message && <div className="formMessage">{message}</div>}
    </div>
  );
}
