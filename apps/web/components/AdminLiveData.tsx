"use client";

import { useEffect, useMemo, useState } from "react";
import { properties as demoProperties } from "../lib/properties";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import AdminPropertyPhotos from "./AdminPropertyPhotos";

type LiveProperty = {
  id: string;
  code: string;
  title: string;
  purpose: "sale" | "rent";
  segment?: "residential" | "commercial";
  zone?: "urban" | "rural";
  publication_state?: "draft" | "published";
  status: "available" | "reserved" | "rented" | "sold" | "inactive";
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking_spaces?: number | null;
  featured?: boolean;
  description?: string | null;
  address?: string | null;
  address_public?: boolean;
  created_at?: string;
  cities?: { name?: string; state_code?: string } | null;
};

type Lead = { id: string; name: string | null; phone: string | null; email: string | null; message: string | null; source: string; created_at: string };

const statusLabels: Record<LiveProperty["status"], string> = { available: "Disponível", reserved: "Reservado", rented: "Alugado", sold: "Vendido", inactive: "Inativo" };

function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0); }

export default function AdminLiveData() {
  const [liveProperties, setLiveProperties] = useState<LiveProperty[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<LiveProperty | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    if (!supabaseBrowser) return;
    setLoading(true);
    const [propertyResult, leadResult] = await Promise.all([
      supabaseBrowser.from("properties").select("id,code,title,purpose,segment,zone,publication_state,status,price,bedrooms,bathrooms,parking_spaces,featured,description,address,address_public,created_at,cities(name,state_code)").order("created_at", { ascending: false }),
      supabaseBrowser.from("leads").select("id,name,phone,email,message,source,created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    if (propertyResult.data) setLiveProperties(propertyResult.data as unknown as LiveProperty[]);
    if (leadResult.data) setLeads(leadResult.data as Lead[]);
    if (propertyResult.error || leadResult.error) setMessage(propertyResult.error?.message || leadResult.error?.message || "Erro ao carregar dados.");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => !isSupabaseConfigured ? {
    total: demoProperties.length,
    sale: demoProperties.filter((item) => item.purpose === "Venda").length,
    rent: demoProperties.filter((item) => item.purpose === "Locação").length,
    leads: 0,
  } : {
    total: liveProperties.length,
    sale: liveProperties.filter((item) => item.purpose === "sale").length,
    rent: liveProperties.filter((item) => item.purpose === "rent").length,
    leads: leads.length,
  }, [liveProperties, leads]);

  async function changeStatus(id: string, status: LiveProperty["status"]) {
    if (!supabaseBrowser) return;
    setMessage("");
    const result = await supabaseBrowser.from("properties").update({ status }).eq("id", id);
    if (result.error) return setMessage(result.error.message);
    setLiveProperties((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    setMessage("Status atualizado.");
  }

  async function saveEditing() {
    if (!supabaseBrowser || !editing) return;
    setSavingEdit(true); setMessage("");
    const payload = {
      title: editing.title,
      purpose: editing.purpose,
      segment: editing.segment || "residential",
      zone: editing.zone || "urban",
      publication_state: editing.publication_state || "published",
      status: editing.status,
      price: Number(editing.price || 0),
      bedrooms: Number(editing.bedrooms || 0),
      bathrooms: Number(editing.bathrooms || 0),
      parking_spaces: Number(editing.parking_spaces || 0),
      featured: Boolean(editing.featured),
      description: editing.description || null,
      address: editing.address || null,
      address_public: Boolean(editing.address_public),
      published_at: editing.publication_state === "draft" ? null : new Date().toISOString(),
    };
    const { error } = await supabaseBrowser.from("properties").update(payload).eq("id", editing.id);
    if (error) setMessage(error.message);
    else { setMessage(`Imóvel ${editing.code} atualizado.`); await load(); }
    setSavingEdit(false);
  }

  return (
    <>
      <div className="adminMetrics">
        <article><span>Total de imóveis</span><strong>{stats.total}</strong><small>{isSupabaseConfigured ? "Base real" : "Base demonstrativa"}</small></article>
        <article><span>Para venda</span><strong>{stats.sale}</strong><small>Imóveis cadastrados</small></article>
        <article><span>Para locação</span><strong>{stats.rent}</strong><small>Imóveis cadastrados</small></article>
        <article><span>Contatos recebidos</span><strong>{stats.leads}</strong><small>{isSupabaseConfigured ? "Últimos contatos" : "Aguardando Supabase"}</small></article>
      </div>

      <div className="adminPanel" id="imoveis">
        <div className="adminPanelHeader"><div><span className="eyebrow">CATÁLOGO</span><h2>Imóveis cadastrados</h2></div><div className="adminPanelTools"><span>{loading ? "Carregando..." : `${stats.total} registros`}</span>{isSupabaseConfigured && <button className="miniButton" type="button" onClick={() => void load()}>Atualizar</button>}</div></div>
        {message && <div className="formMessage">{message}</div>}
        <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Código</th><th>Imóvel</th><th>Local</th><th>Finalidade</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {!isSupabaseConfigured && demoProperties.map((property) => <tr key={property.code}><td><strong>{property.code}</strong></td><td>{property.title}</td><td>{property.city}</td><td>{property.purpose}</td><td>{property.price}</td><td><span className="statusPill">Disponível</span></td><td>Demo</td></tr>)}
          {isSupabaseConfigured && liveProperties.map((property) => <tr key={property.id}><td><strong>{property.code}</strong></td><td>{property.title}{property.publication_state === "draft" ? <span className="draftTag">Rascunho</span> : null}</td><td>{property.cities?.name ? `${property.cities.name}${property.cities.state_code ? ` - ${property.cities.state_code}` : ""}` : "—"}</td><td>{property.purpose === "sale" ? "Venda" : "Locação"}</td><td>{money(property.price)}</td><td><select className={`statusSelect status-${property.status}`} value={property.status} onChange={(event) => void changeStatus(property.id, event.target.value as LiveProperty["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><button className="miniButton" onClick={() => setEditing({ ...property })}>Editar</button></td></tr>)}
          {isSupabaseConfigured && !loading && liveProperties.length === 0 && <tr><td colSpan={7}>Nenhum imóvel cadastrado ainda.</td></tr>}
        </tbody></table></div>
      </div>

      {editing ? <div className="adminPanel editPanel"><div className="adminPanelHeader"><div><span className="eyebrow">EDIÇÃO</span><h2>{editing.code} · {editing.title}</h2></div><button className="miniButton" onClick={() => setEditing(null)}>Fechar</button></div>
        <div className="propertyForm">
          <label>Título<input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
          <div className="formGrid three"><label>Finalidade<select value={editing.purpose} onChange={(e) => setEditing({ ...editing, purpose: e.target.value as LiveProperty["purpose"] })}><option value="sale">Venda</option><option value="rent">Locação</option></select></label><label>Uso<select value={editing.segment || "residential"} onChange={(e) => setEditing({ ...editing, segment: e.target.value as LiveProperty["segment"] })}><option value="residential">Residencial</option><option value="commercial">Comercial</option></select></label><label>Zona<select value={editing.zone || "urban"} onChange={(e) => setEditing({ ...editing, zone: e.target.value as LiveProperty["zone"] })}><option value="urban">Urbana</option><option value="rural">Rural</option></select></label></div>
          <div className="formGrid three"><label>Valor<input type="number" min="0" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></label><label>Publicação<select value={editing.publication_state || "published"} onChange={(e) => setEditing({ ...editing, publication_state: e.target.value as LiveProperty["publication_state"] })}><option value="published">Publicado</option><option value="draft">Rascunho</option></select></label><label>Status<select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as LiveProperty["status"] })}>{Object.entries(statusLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
          <div className="formGrid three"><label>Quartos<input type="number" min="0" value={editing.bedrooms || 0} onChange={(e) => setEditing({ ...editing, bedrooms: Number(e.target.value) })} /></label><label>Banheiros<input type="number" min="0" value={editing.bathrooms || 0} onChange={(e) => setEditing({ ...editing, bathrooms: Number(e.target.value) })} /></label><label>Vagas<input type="number" min="0" value={editing.parking_spaces || 0} onChange={(e) => setEditing({ ...editing, parking_spaces: Number(e.target.value) })} /></label></div>
          <label>Endereço<input value={editing.address || ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></label>
          <label>Descrição<textarea rows={5} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
          <div className="formGrid"><label className="checkLabel"><input type="checkbox" checked={Boolean(editing.featured)} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} /> Destacar no catálogo</label><label className="checkLabel"><input type="checkbox" checked={Boolean(editing.address_public)} onChange={(e) => setEditing({ ...editing, address_public: e.target.checked })} /> Mostrar endereço completo</label></div>
          <div className="formActions"><button className="button primary" disabled={savingEdit} onClick={() => void saveEditing()}>{savingEdit ? "Salvando..." : "Salvar alterações"}</button></div>
        </div>
        <AdminPropertyPhotos propertyId={editing.id} propertyTitle={editing.title} />
      </div> : null}

      <div className="adminPanel" id="contatos"><div className="adminPanelHeader"><div><span className="eyebrow">LEADS</span><h2>Contatos recebidos</h2></div><span>{isSupabaseConfigured ? `${leads.length} recentes` : "Modo demonstração"}</span></div>
        {!isSupabaseConfigured ? <div className="emptyMini">Os contatos aparecerão aqui quando o Supabase estiver configurado.</div> : leads.length === 0 ? <div className="emptyMini">Nenhum contato recebido ainda.</div> : <div className="leadGrid">{leads.map((lead) => <article className="leadCard" key={lead.id}><div className="leadHead"><strong>{lead.name || "Contato sem nome"}</strong><span>{new Date(lead.created_at).toLocaleDateString("pt-BR")}</span></div><p>{lead.message || "Sem mensagem."}</p><div className="leadContacts">{lead.phone && <a href={`tel:${lead.phone}`}>{lead.phone}</a>}{lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}</div></article>)}</div>}
      </div>
    </>
  );
}
