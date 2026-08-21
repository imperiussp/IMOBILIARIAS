"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Template = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  body_template: string;
  active: boolean;
  display_order: number;
};

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export default function PlatformDocumentTemplateManager() {
  const [items, setItems] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabaseBrowser) return;
    const result = await supabaseBrowser.from("document_templates")
      .select("id,code,name,category,description,body_template,active,display_order")
      .order("display_order").order("name");
    if (result.error) return setMessage(result.error.message);
    setItems((result.data || []) as Template[]);
  }

  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const code = slug(String(form.get("code") || name));
    const payload = {
      code,
      name,
      category: String(form.get("category") || "geral").trim(),
      description: String(form.get("description") || "").trim() || null,
      body_template: String(form.get("body_template") || "").trim(),
      display_order: Number(form.get("display_order") || 0),
      active: form.get("active") === "on",
      updated_at: new Date().toISOString(),
    };
    if (!payload.name || !payload.code || !payload.body_template) return setMessage("Nome, código e conteúdo são obrigatórios.");
    setSaving(true); setMessage("");
    const result = editing
      ? await supabaseBrowser.from("document_templates").update(payload).eq("id", editing.id)
      : await supabaseBrowser.from("document_templates").insert(payload);
    setSaving(false);
    if (result.error) return setMessage(result.error.message);
    setEditing(null); event.currentTarget.reset(); setMessage("Modelo salvo."); await load();
  }

  return <div className="adminPanel" id="modelos-documentos">
    <div className="adminPanelHeader"><div><span className="eyebrow">DOCUMENTOS</span><h2>Modelos globais</h2><p>Crie e mantenha os modelos liberados para as imobiliárias que possuírem a Central de documentos no plano.</p></div><span>{items.length} modelo(s)</span></div>
    <form className="propertyForm" onSubmit={save} key={editing?.id || "novo"}>
      <div className="formGrid three"><label>Nome<input name="name" defaultValue={editing?.name || ""} required /></label><label>Código<input name="code" defaultValue={editing?.code || ""} placeholder="proposta-compra" required /></label><label>Ordem<input name="display_order" type="number" defaultValue={editing?.display_order || 0} /></label></div>
      <div className="formGrid"><label>Categoria<input name="category" defaultValue={editing?.category || "geral"} required /></label><label>Descrição<input name="description" defaultValue={editing?.description || ""} /></label></div>
      <label>Conteúdo do modelo<textarea name="body_template" rows={12} defaultValue={editing?.body_template || ""} placeholder="Use marcadores como {{CLIENTE}}, {{IMOVEL}}, {{VALOR}}, {{DATA}}" required /></label>
      <div className="formGrid"><label className="checkLabel"><input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} /> Modelo ativo</label><div className="formActions">{editing ? <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancelar</button> : null}<button className="button primary" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar modelo"}</button></div></div>
    </form>
    {message ? <div className="formMessage">{message}</div> : null}
    <div className="accessList">{items.map((item) => <article className="accessRow" key={item.id}><div className="accessIdentity"><strong>{item.name}</strong><span>{item.category} · {item.code}</span><small>{item.description || "Sem descrição"}</small></div><div className="accessActions"><span className={`statusPill ${item.active ? "" : "muted"}`}>{item.active ? "Ativo" : "Inativo"}</span><button className="miniButton" type="button" onClick={() => setEditing(item)}>Editar</button></div></article>)}</div>
  </div>;
}
