"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { properties as demoProperties } from "../lib/properties";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import AdminPropertyPhotos from "./AdminPropertyPhotos";

type LiveProperty = {
  id: string; code: string; title: string; purpose: "sale" | "rent"; segment?: "residential" | "commercial"; zone?: "urban" | "rural"; publication_state?: "draft" | "published";
  status: "available" | "reserved" | "rented" | "sold" | "inactive"; price: number; bedrooms?: number | null; suites?: number | null; bathrooms?: number | null; parking_spaces?: number | null;
  built_area_m2?: number | null; land_area_m2?: number | null; featured?: boolean; description?: string | null; address?: string | null; address_public?: boolean; created_at?: string;
  broker_id?: string | null; city_id: string; neighborhood_id?: string | null; property_type_id?: string | null;
  cities?: { name?: string; state_code?: string } | null; neighborhoods?: { name?: string } | null; property_types?: { name?: string } | null; brokers?: { name?: string } | null;
};

type LeadStatus = "new" | "contacted" | "visit_scheduled" | "won" | "lost";
type Lead = { id: string; name: string | null; phone: string | null; email: string | null; message: string | null; source: string; status: LeadStatus; notes: string | null; created_at: string };
type City = { id: string; name: string; state_code: string };
type PropertyType = { id: string; name: string };
type Broker = { id: string; name: string };

const statusLabels: Record<LiveProperty["status"], string> = { available: "Disponível", reserved: "Reservado", rented: "Alugado", sold: "Vendido", inactive: "Inativo" };
const leadLabels: Record<LeadStatus, string> = { new: "Novo", contacted: "Contatado", visit_scheduled: "Visita agendada", won: "Fechado", lost: "Perdido" };
function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0); }

export default function AdminLiveData() {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [liveProperties, setLiveProperties] = useState<LiveProperty[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [types, setTypes] = useState<PropertyType[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<LiveProperty | null>(null);
  const [editingNeighborhood, setEditingNeighborhood] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [purposeFilter, setPurposeFilter] = useState("");
  const [publicationFilter, setPublicationFilter] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    setLoading(true); setMessage("");
    const currentAgency = await getCurrentAgency();
    if (!currentAgency) {
      setAgencyId(""); setAgencyName(""); setLiveProperties([]); setLeads([]); setBrokers([]);
      setMessage("Não foi possível identificar a imobiliária desta conta.");
      setLoading(false);
      return;
    }
    setAgencyId(currentAgency.agencyId);
    setAgencyName(currentAgency.agencyName);

    const [propertyResult, leadResult, cityResult, typeResult, brokerResult] = await Promise.all([
      supabaseBrowser.from("properties").select("id,code,title,purpose,segment,zone,publication_state,status,price,bedrooms,suites,bathrooms,parking_spaces,built_area_m2,land_area_m2,featured,description,address,address_public,created_at,broker_id,city_id,neighborhood_id,property_type_id,cities(name,state_code),neighborhoods(name),property_types(name),brokers(name)").eq("agency_id", currentAgency.agencyId).order("created_at", { ascending: false }),
      supabaseBrowser.from("leads").select("id,name,phone,email,message,source,status,notes,created_at").eq("agency_id", currentAgency.agencyId).order("created_at", { ascending: false }).limit(60),
      supabaseBrowser.from("cities").select("id,name,state_code").order("name"),
      supabaseBrowser.from("property_types").select("id,name").eq("active", true).order("name"),
      supabaseBrowser.from("brokers").select("id,name").eq("agency_id", currentAgency.agencyId).eq("active", true).order("name"),
    ]);
    if (propertyResult.data) setLiveProperties(propertyResult.data as unknown as LiveProperty[]);
    if (leadResult.data) setLeads(leadResult.data as Lead[]);
    if (cityResult.data) setCities(cityResult.data as City[]);
    if (typeResult.data) setTypes(typeResult.data as PropertyType[]);
    if (brokerResult.data) setBrokers(brokerResult.data as Broker[]);
    if (propertyResult.error || leadResult.error || cityResult.error || typeResult.error || brokerResult.error) setMessage(propertyResult.error?.message || leadResult.error?.message || cityResult.error?.message || typeResult.error?.message || brokerResult.error?.message || "Erro ao carregar dados.");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => !isSupabaseConfigured ? {
    total: demoProperties.length,
    active: demoProperties.length,
    closed: 0,
    leads: 0,
  } : {
    total: liveProperties.length,
    active: liveProperties.filter((item) => item.status === "available" || item.status === "reserved").length,
    closed: liveProperties.filter((item) => item.status === "sold" || item.status === "rented").length,
    leads: leads.filter((lead) => lead.status === "new" || lead.status === "contacted" || lead.status === "visit_scheduled").length,
  }, [liveProperties, leads]);

  const filteredProperties = useMemo(() => {
    const term = search.trim().toLowerCase();
    return liveProperties.filter((property) => {
      const matchesSearch = !term || property.code.toLowerCase().includes(term) || property.title.toLowerCase().includes(term) || property.cities?.name?.toLowerCase().includes(term) || property.neighborhoods?.name?.toLowerCase().includes(term);
      const matchesStatus = !statusFilter || property.status === statusFilter;
      const matchesPurpose = !purposeFilter || property.purpose === purposeFilter;
      const matchesPublication = !publicationFilter || property.publication_state === publicationFilter;
      return matchesSearch && matchesStatus && matchesPurpose && matchesPublication;
    });
  }, [liveProperties, search, statusFilter, purposeFilter, publicationFilter]);

  async function changeStatus(id: string, status: LiveProperty["status"]) {
    if (!supabaseBrowser || !agencyId) return;
    const result = await supabaseBrowser.from("properties").update({ status }).eq("id", id).eq("agency_id", agencyId);
    if (result.error) return setMessage(result.error.message);
    setLiveProperties((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    setMessage("Status atualizado.");
  }

  function openEditing(property: LiveProperty) {
    setEditing({ ...property });
    setEditingNeighborhood(property.neighborhoods?.name || "");
    window.setTimeout(() => document.querySelector(".editPanel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function resolveNeighborhood(cityId: string, name: string) {
    if (!supabaseBrowser || !name.trim()) return null;
    const existing = await supabaseBrowser.from("neighborhoods").select("id").eq("city_id", cityId).ilike("name", name.trim()).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.id) return existing.data.id as string;
    const created = await supabaseBrowser.from("neighborhoods").insert({ city_id: cityId, name: name.trim() }).select("id").single();
    if (created.error) throw created.error;
    return created.data.id as string;
  }

  async function saveEditing() {
    if (!supabaseBrowser || !editing || !agencyId) return;
    setSavingEdit(true); setMessage("");
    try {
      const neighborhoodId = await resolveNeighborhood(editing.city_id, editingNeighborhood);
      const payload = {
        title: editing.title.trim(), purpose: editing.purpose, segment: editing.segment || "residential", zone: editing.zone || "urban",
        publication_state: editing.publication_state || "published", status: editing.status, price: Number(editing.price || 0),
        bedrooms: Number(editing.bedrooms || 0), suites: Number(editing.suites || 0), bathrooms: Number(editing.bathrooms || 0), parking_spaces: Number(editing.parking_spaces || 0),
        built_area_m2: Number(editing.built_area_m2 || 0) || null, land_area_m2: Number(editing.land_area_m2 || 0) || null,
        featured: Boolean(editing.featured), description: editing.description?.trim() || null, address: editing.address?.trim() || null, address_public: Boolean(editing.address_public),
        broker_id: editing.broker_id || null, city_id: editing.city_id, neighborhood_id: neighborhoodId, property_type_id: editing.property_type_id || null,
        published_at: editing.publication_state === "draft" ? null : new Date().toISOString(),
      };
      const { error } = await supabaseBrowser.from("properties").update(payload).eq("id", editing.id).eq("agency_id", agencyId);
      if (error) throw error;
      setMessage(`Imóvel ${editing.code} atualizado.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingEdit(false);
    }
  }

  async function archiveProperty(property: LiveProperty) {
    if (!supabaseBrowser || !agencyId) return;
    if (!window.confirm(`Arquivar ${property.code}? O imóvel será preservado no histórico e sairá do catálogo público.`)) return;
    const { error } = await supabaseBrowser.from("properties").update({ status: "inactive", publication_state: "draft", published_at: null }).eq("id", property.id).eq("agency_id", agencyId);
    if (error) return setMessage(error.message);
    setMessage(`${property.code} arquivado sem exclusão.`);
    await load();
  }

  async function updateLead(id: string, patch: Partial<Pick<Lead, "status" | "notes">>) {
    if (!supabaseBrowser || !agencyId) return;
    const { error } = await supabaseBrowser.from("leads").update(patch).eq("id", id).eq("agency_id", agencyId);
    if (error) return setMessage(error.message);
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, ...patch } : lead));
  }

  return (
    <>
      {agencyName ? <div className="formNotice">Dados exibidos somente de <strong>{agencyName}</strong>.</div> : null}
      <div className="adminMetrics">
        <article><span>Total de imóveis</span><strong>{stats.total}</strong><small>{isSupabaseConfigured ? "Base desta imobiliária" : "Base demonstrativa"}</small></article>
        <article><span>Em negociação</span><strong>{stats.active}</strong><small>Disponíveis ou reservados</small></article>
        <article><span>Negócios concluídos</span><strong>{stats.closed}</strong><small>Vendidos ou alugados</small></article>
        <article><span>Contatos em andamento</span><strong>{stats.leads}</strong><small>Pipeline comercial ativo</small></article>
      </div>

      <div className="adminPanel" id="imoveis">
        <div className="adminPanelHeader"><div><span className="eyebrow">CATÁLOGO</span><h2>Imóveis cadastrados</h2></div><div className="adminPanelTools"><span>{loading ? "Carregando..." : `${filteredProperties.length} exibido(s)`}</span>{isSupabaseConfigured && <button className="miniButton" type="button" onClick={() => void load()}>Atualizar</button>}</div></div>
        {message && <div className="formMessage">{message}</div>}
        {isSupabaseConfigured ? <div className="adminFilters"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar código, título, cidade ou bairro" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><select value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)}><option value="">Venda e locação</option><option value="sale">Venda</option><option value="rent">Locação</option></select><select value={publicationFilter} onChange={(e) => setPublicationFilter(e.target.value)}><option value="">Publicados e rascunhos</option><option value="published">Publicado</option><option value="draft">Rascunho</option></select><button className="miniButton" onClick={() => { setSearch(""); setStatusFilter(""); setPurposeFilter(""); setPublicationFilter(""); }}>Limpar</button></div> : null}
        <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Código</th><th>Imóvel</th><th>Local</th><th>Finalidade</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {!isSupabaseConfigured && demoProperties.map((property) => <tr key={property.code}><td><strong>{property.code}</strong></td><td>{property.title}</td><td>{property.city}</td><td>{property.purpose}</td><td>{property.price}</td><td><span className="statusPill">Disponível</span></td><td>Demo</td></tr>)}
          {isSupabaseConfigured && filteredProperties.map((property) => <tr key={property.id}><td><strong>{property.code}</strong></td><td>{property.title}{property.publication_state === "draft" ? <span className="draftTag">Rascunho</span> : null}</td><td>{property.cities?.name ? `${property.cities.name}${property.cities.state_code ? ` - ${property.cities.state_code}` : ""}` : "—"}</td><td>{property.purpose === "sale" ? "Venda" : "Locação"}</td><td>{money(property.price)}</td><td><select className={`statusSelect status-${property.status}`} value={property.status} onChange={(event) => void changeStatus(property.id, event.target.value as LiveProperty["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><div className="tableActions"><button className="miniButton" onClick={() => openEditing(property)}>Editar</button><button className="miniButton muted" onClick={() => void archiveProperty(property)} disabled={property.status === "inactive"}>Arquivar</button></div></td></tr>)}
          {isSupabaseConfigured && !loading && filteredProperties.length === 0 && <tr><td colSpan={7}>Nenhum imóvel corresponde aos filtros.</td></tr>}
        </tbody></table></div>
      </div>

      {editing ? <div className="adminPanel editPanel"><div className="adminPanelHeader"><div><span className="eyebrow">EDIÇÃO COMPLETA</span><h2>{editing.code} · {editing.title}</h2></div><button className="miniButton" onClick={() => setEditing(null)}>Fechar</button></div>
        <div className="propertyForm">
          <label>Título<input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
          <div className="formGrid three"><label>Finalidade<select value={editing.purpose} onChange={(e) => setEditing({ ...editing, purpose: e.target.value as LiveProperty["purpose"] })}><option value="sale">Venda</option><option value="rent">Locação</option></select></label><label>Uso<select value={editing.segment || "residential"} onChange={(e) => setEditing({ ...editing, segment: e.target.value as LiveProperty["segment"] })}><option value="residential">Residencial</option><option value="commercial">Comercial</option></select></label><label>Zona<select value={editing.zone || "urban"} onChange={(e) => setEditing({ ...editing, zone: e.target.value as LiveProperty["zone"] })}><option value="urban">Urbana</option><option value="rural">Rural</option></select></label></div>
          <div className="formGrid three"><label>Cidade<select value={editing.city_id} onChange={(e) => setEditing({ ...editing, city_id: e.target.value })}>{cities.map((city) => <option value={city.id} key={city.id}>{city.name} - {city.state_code}</option>)}</select></label><label>Bairro<input value={editingNeighborhood} onChange={(e) => setEditingNeighborhood(e.target.value)} /></label><label>Tipo<select value={editing.property_type_id || ""} onChange={(e) => setEditing({ ...editing, property_type_id: e.target.value || null })}><option value="">Sem tipo</option>{types.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}</select></label></div>
          <div className="formGrid three"><label>Corretor<select value={editing.broker_id || ""} onChange={(e) => setEditing({ ...editing, broker_id: e.target.value || null })}><option value="">Sem corretor</option>{brokers.map((broker) => <option value={broker.id} key={broker.id}>{broker.name}</option>)}</select></label><label>Publicação<select value={editing.publication_state || "published"} onChange={(e) => setEditing({ ...editing, publication_state: e.target.value as LiveProperty["publication_state"] })}><option value="published">Publicado</option><option value="draft">Rascunho</option></select></label><label>Status<select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as LiveProperty["status"] })}>{Object.entries(statusLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
          <div className="formGrid three"><label>Valor<input type="number" min="0" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></label><label>Área construída (m²)<input type="number" min="0" step="0.01" value={editing.built_area_m2 || ""} onChange={(e) => setEditing({ ...editing, built_area_m2: Number(e.target.value) || null })} /></label><label>Terreno (m²)<input type="number" min="0" step="0.01" value={editing.land_area_m2 || ""} onChange={(e) => setEditing({ ...editing, land_area_m2: Number(e.target.value) || null })} /></label></div>
          <div className="formGrid four"><label>Quartos<input type="number" min="0" value={editing.bedrooms || 0} onChange={(e) => setEditing({ ...editing, bedrooms: Number(e.target.value) })} /></label><label>Suítes<input type="number" min="0" value={editing.suites || 0} onChange={(e) => setEditing({ ...editing, suites: Number(e.target.value) })} /></label><label>Banheiros<input type="number" min="0" value={editing.bathrooms || 0} onChange={(e) => setEditing({ ...editing, bathrooms: Number(e.target.value) })} /></label><label>Vagas<input type="number" min="0" value={editing.parking_spaces || 0} onChange={(e) => setEditing({ ...editing, parking_spaces: Number(e.target.value) })} /></label></div>
          <label>Endereço<input value={editing.address || ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></label>
          <label>Descrição<textarea rows={5} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
          <div className="formGrid"><label className="checkLabel"><input type="checkbox" checked={Boolean(editing.featured)} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} /> Destacar no catálogo</label><label className="checkLabel"><input type="checkbox" checked={Boolean(editing.address_public)} onChange={(e) => setEditing({ ...editing, address_public: e.target.checked })} /> Mostrar endereço completo</label></div>
          <div className="formActions"><button className="button secondary" onClick={() => void archiveProperty(editing)}>Arquivar sem excluir</button><button className="button primary" disabled={savingEdit} onClick={() => void saveEditing()}>{savingEdit ? "Salvando..." : "Salvar alterações"}</button></div>
        </div>
        <AdminPropertyPhotos propertyId={editing.id} propertyTitle={editing.title} />
      </div> : null}

      <div className="adminPanel" id="contatos"><div className="adminPanelHeader"><div><span className="eyebrow">LEADS</span><h2>Contatos recebidos</h2></div><span>{isSupabaseConfigured ? `${leads.length} recentes` : "Modo demonstração"}</span></div>
        {!isSupabaseConfigured ? <div className="emptyMini">Os contatos aparecerão aqui quando o Supabase estiver configurado.</div> : leads.length === 0 ? <div className="emptyMini">Nenhum contato recebido ainda.</div> : <div className="leadGrid">{leads.map((lead) => <article className="leadCard" key={lead.id}><div className="leadHead"><strong>{lead.name || "Contato sem nome"}</strong><span>{new Date(lead.created_at).toLocaleDateString("pt-BR")}</span></div><div className="leadPipeline"><select value={lead.status} onChange={(event) => void updateLead(lead.id, { status: event.target.value as LeadStatus })}>{Object.entries(leadLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></div><p>{lead.message || "Sem mensagem."}</p><div className="leadContacts">{lead.phone && <a href={`tel:${lead.phone}`}>{lead.phone}</a>}{lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}</div><label className="leadNotes">Anotações<textarea rows={3} value={lead.notes || ""} onChange={(event) => setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, notes: event.target.value } : item))} onBlur={(event) => void updateLead(lead.id, { notes: event.target.value })} placeholder="Observações do atendimento" /></label></article>)}</div>}
      </div>
    </>
  );
}
