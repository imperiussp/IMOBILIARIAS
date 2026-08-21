"use client";

import { useEffect, useMemo, useState } from "react";
import { properties as demoProperties } from "../lib/properties";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type LiveProperty = {
  id: string;
  code: string;
  title: string;
  purpose: "sale" | "rent";
  status: "available" | "reserved" | "rented" | "sold" | "inactive";
  price: number;
  created_at?: string;
  cities?: { name?: string; state_code?: string } | null;
};

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  source: string;
  created_at: string;
};

const statusLabels: Record<LiveProperty["status"], string> = {
  available: "Disponível",
  reserved: "Reservado",
  rented: "Alugado",
  sold: "Vendido",
  inactive: "Inativo",
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export default function AdminLiveData() {
  const [liveProperties, setLiveProperties] = useState<LiveProperty[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    setLoading(true);
    const [propertyResult, leadResult] = await Promise.all([
      supabaseBrowser
        .from("properties")
        .select("id,code,title,purpose,status,price,created_at,cities(name,state_code)")
        .order("created_at", { ascending: false }),
      supabaseBrowser
        .from("leads")
        .select("id,name,phone,email,message,source,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (propertyResult.data) setLiveProperties(propertyResult.data as unknown as LiveProperty[]);
    if (leadResult.data) setLeads(leadResult.data as Lead[]);
    if (propertyResult.error || leadResult.error) setMessage(propertyResult.error?.message || leadResult.error?.message || "Erro ao carregar dados.");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    if (!isSupabaseConfigured) {
      return {
        total: demoProperties.length,
        sale: demoProperties.filter((item) => item.purpose === "Venda").length,
        rent: demoProperties.filter((item) => item.purpose === "Locação").length,
        leads: 0,
      };
    }
    return {
      total: liveProperties.length,
      sale: liveProperties.filter((item) => item.purpose === "sale").length,
      rent: liveProperties.filter((item) => item.purpose === "rent").length,
      leads: leads.length,
    };
  }, [liveProperties, leads]);

  async function changeStatus(id: string, status: LiveProperty["status"]) {
    if (!supabaseBrowser) return;
    setMessage("");
    const result = await supabaseBrowser.from("properties").update({ status }).eq("id", id);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setLiveProperties((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    setMessage("Status atualizado.");
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
        <div className="adminPanelHeader">
          <div><span className="eyebrow">CATÁLOGO</span><h2>Imóveis cadastrados</h2></div>
          <div className="adminPanelTools"><span>{loading ? "Carregando..." : `${stats.total} registros`}</span>{isSupabaseConfigured && <button className="miniButton" type="button" onClick={() => void load()}>Atualizar</button>}</div>
        </div>
        {message && <div className="formMessage">{message}</div>}
        <div className="adminTableWrap">
          <table className="adminTable">
            <thead><tr><th>Código</th><th>Imóvel</th><th>Local</th><th>Finalidade</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>
              {!isSupabaseConfigured && demoProperties.map((property) => (
                <tr key={property.code}><td><strong>{property.code}</strong></td><td>{property.title}</td><td>{property.city}</td><td>{property.purpose}</td><td>{property.price}</td><td><span className="statusPill">Disponível</span></td></tr>
              ))}
              {isSupabaseConfigured && liveProperties.map((property) => (
                <tr key={property.id}>
                  <td><strong>{property.code}</strong></td>
                  <td>{property.title}</td>
                  <td>{property.cities?.name ? `${property.cities.name}${property.cities.state_code ? ` - ${property.cities.state_code}` : ""}` : "—"}</td>
                  <td>{property.purpose === "sale" ? "Venda" : "Locação"}</td>
                  <td>{money(property.price)}</td>
                  <td>
                    <select className={`statusSelect status-${property.status}`} value={property.status} onChange={(event) => void changeStatus(property.id, event.target.value as LiveProperty["status"])}>
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {isSupabaseConfigured && !loading && liveProperties.length === 0 && <tr><td colSpan={6}>Nenhum imóvel cadastrado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adminPanel" id="contatos">
        <div className="adminPanelHeader"><div><span className="eyebrow">LEADS</span><h2>Contatos recebidos</h2></div><span>{isSupabaseConfigured ? `${leads.length} recentes` : "Modo demonstração"}</span></div>
        {!isSupabaseConfigured ? <div className="emptyMini">Os contatos aparecerão aqui quando o Supabase estiver configurado.</div> : leads.length === 0 ? <div className="emptyMini">Nenhum contato recebido ainda.</div> : (
          <div className="leadGrid">{leads.map((lead) => <article className="leadCard" key={lead.id}><div className="leadHead"><strong>{lead.name || "Contato sem nome"}</strong><span>{new Date(lead.created_at).toLocaleDateString("pt-BR")}</span></div><p>{lead.message || "Sem mensagem."}</p><div className="leadContacts">{lead.phone && <a href={`tel:${lead.phone}`}>{lead.phone}</a>}{lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}</div></article>)}</div>
        )}
      </div>
    </>
  );
}
