"use client";

import { FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type TypeRow = { id: string; name: string; slug: string; active: boolean };
type FeatureRow = { id: string; name: string; slug: string };

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminCatalogSettings() {
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const [typesResult, featuresResult] = await Promise.all([
      supabaseBrowser.from("property_types").select("id,name,slug,active").order("name"),
      supabaseBrowser.from("property_features").select("id,name,slug").order("name"),
    ]);
    if (typesResult.error || featuresResult.error) return setMessage(typesResult.error?.message || featuresResult.error?.message || "Erro ao carregar opções.");
    setTypes((typesResult.data || []) as TypeRow[]);
    setFeatures((featuresResult.data || []) as FeatureRow[]);
  }

  useEffect(() => { void load(); }, []);

  async function addType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado.");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("type_name") || "").trim();
    if (!name) return;
    const { error } = await supabaseBrowser.from("property_types").insert({ name, slug: slugify(name), active: true });
    if (error) return setMessage(error.message);
    event.currentTarget.reset();
    setMessage("Tipo de imóvel cadastrado.");
    await load();
  }

  async function toggleType(row: TypeRow) {
    if (!supabaseBrowser) return;
    const { error } = await supabaseBrowser.from("property_types").update({ active: !row.active }).eq("id", row.id);
    if (error) return setMessage(error.message);
    setTypes((current) => current.map((item) => item.id === row.id ? { ...item, active: !item.active } : item));
  }

  async function addFeature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado.");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("feature_name") || "").trim();
    if (!name) return;
    const { error } = await supabaseBrowser.from("property_features").insert({ name, slug: slugify(name) });
    if (error) return setMessage(error.message);
    event.currentTarget.reset();
    setMessage("Característica cadastrada.");
    await load();
  }

  return (
    <div className="adminPanel" id="catalogo-config">
      <div className="adminPanelHeader"><div><span className="eyebrow">CONFIGURAÇÕES</span><h2>Tipos e características</h2><p>Amplie o catálogo sem precisar alterar o código do sistema.</p></div><span>{isSupabaseConfigured ? `${types.length} tipos · ${features.length} características` : "Modo demonstração"}</span></div>
      {!isSupabaseConfigured && <div className="formNotice">Esta área será ativada no Supabase exclusivo do IMOBILIARIAS.</div>}
      <div className="adminSplit">
        <section><h3>Tipos de imóvel</h3><form className="simpleInlineForm" onSubmit={addType}><input name="type_name" placeholder="Ex.: Sobrado" required /><button className="button primary" type="submit">Adicionar</button></form><div className="settingsList">{types.map((row) => <div className="settingsRow" key={row.id}><div><strong>{row.name}</strong><span>{row.slug}</span></div><button className={`miniButton ${row.active ? "" : "muted"}`} onClick={() => void toggleType(row)}>{row.active ? "Ativo" : "Inativo"}</button></div>)}</div></section>
        <section><h3>Características</h3><form className="simpleInlineForm" onSubmit={addFeature}><input name="feature_name" placeholder="Ex.: Energia solar" required /><button className="button primary" type="submit">Adicionar</button></form><div className="settingsList featureCloud">{features.map((row) => <span className="featureChip" key={row.id}>{row.name}</span>)}</div></section>
      </div>
      {message && <div className="formMessage">{message}</div>}
    </div>
  );
}
