"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type ContactStatus = "new" | "active" | "negotiating" | "customer" | "inactive";
type ContactType = "buyer" | "owner" | "mixed" | "other";
type Contact = {
  id:string; name:string; phone:string|null; email:string|null; contact_type:ContactType; status:ContactStatus;
  first_source:string|null; last_source:string|null; assigned_broker_id:string|null; last_property_id:string|null;
  first_seen_at:string; last_interaction_at:string;
};
type Interaction = {id:string; contact_id:string; lead_id:string|null; property_id:string|null; broker_id:string|null; interaction_type:string; source:string|null; title:string; message:string|null; occurred_at:string};
type PropertyRef = {id:string; code:string; title:string};
type BrokerRef = {id:string; name:string};

const statusLabels:Record<ContactStatus,string>={new:"Novo",active:"Em atendimento",negotiating:"Em negociação",customer:"Cliente",inactive:"Inativo"};
const typeLabels:Record<ContactType,string>={buyer:"Comprador / interessado",owner:"Proprietário / vendedor",mixed:"Comprador e proprietário",other:"Outro"};
const sourceLabels:Record<string,string>={"web-general-contact":"Site · contato geral","web-property-detail":"Site · interesse em imóvel","web-owner-property":"Site · anuncie seu imóvel",visit:"Visita",email:"E-mail",portal:"Portal",web:"Site",admin:"Painel"};
function dateTime(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function digits(value:string|null){return String(value||"").replace(/\D/g,"");}

export default function AdminContacts({embedded=false}:{embedded?:boolean}){
  const[agencyId,setAgencyId]=useState("");
  const[contacts,setContacts]=useState<Contact[]>([]);
  const[properties,setProperties]=useState<PropertyRef[]>([]);
  const[brokers,setBrokers]=useState<BrokerRef[]>([]);
  const[interactions,setInteractions]=useState<Interaction[]>([]);
  const[selectedId,setSelectedId]=useState("");
  const[search,setSearch]=useState("");
  const[typeFilter,setTypeFilter]=useState("");
  const[statusFilter,setStatusFilter]=useState("");
  const[note,setNote]=useState("");
  const[message,setMessage]=useState("");
  const[loading,setLoading]=useState(true);

  async function load(){
    if(!supabaseBrowser)return;
    setLoading(true);setMessage("");
    const agency=await getCurrentAgency();
    if(!agency){setLoading(false);setMessage("Não foi possível identificar a imobiliária.");return;}
    setAgencyId(agency.agencyId);
    const[c,p,b]=await Promise.all([
      supabaseBrowser.from("agency_contacts").select("id,name,phone,email,contact_type,status,first_source,last_source,assigned_broker_id,last_property_id,first_seen_at,last_interaction_at").eq("agency_id",agency.agencyId).order("last_interaction_at",{ascending:false}).limit(500),
      supabaseBrowser.from("properties").select("id,code,title").eq("agency_id",agency.agencyId).order("created_at",{ascending:false}),
      supabaseBrowser.from("brokers").select("id,name").eq("agency_id",agency.agencyId).eq("active",true).order("name"),
    ]);
    if(c.error||p.error||b.error)setMessage(c.error?.message||p.error?.message||b.error?.message||"Erro ao carregar contatos.");
    setContacts((c.data||[]) as Contact[]);setProperties((p.data||[]) as PropertyRef[]);setBrokers((b.data||[]) as BrokerRef[]);setLoading(false);
  }

  async function loadHistory(contactId:string){
    if(!supabaseBrowser||!agencyId)return;
    setSelectedId(contactId);
    const{data,error}=await supabaseBrowser.from("contact_interactions").select("id,contact_id,lead_id,property_id,broker_id,interaction_type,source,title,message,occurred_at").eq("agency_id",agencyId).eq("contact_id",contactId).order("occurred_at",{ascending:false}).limit(100);
    if(error)setMessage(error.message);else setInteractions((data||[]) as Interaction[]);
  }

  useEffect(()=>{void load();},[]);

  const propertyMap=useMemo(()=>new Map(properties.map(p=>[p.id,p])),[properties]);
  const brokerMap=useMemo(()=>new Map(brokers.map(b=>[b.id,b])),[brokers]);
  const filtered=useMemo(()=>{const term=search.trim().toLocaleLowerCase("pt-BR");return contacts.filter(c=>(!term||c.name.toLocaleLowerCase("pt-BR").includes(term)||String(c.phone||"").toLowerCase().includes(term)||String(c.email||"").toLowerCase().includes(term))&&(!typeFilter||c.contact_type===typeFilter)&&(!statusFilter||c.status===statusFilter));},[contacts,search,typeFilter,statusFilter]);
  const selected=contacts.find(c=>c.id===selectedId)||null;

  async function updateContact(id:string,patch:Partial<Pick<Contact,"status"|"assigned_broker_id">>){
    if(!supabaseBrowser||!agencyId)return;
    const{error}=await supabaseBrowser.from("agency_contacts").update({...patch,updated_at:new Date().toISOString()}).eq("agency_id",agencyId).eq("id",id);
    if(error)return setMessage(error.message);
    setContacts(current=>current.map(c=>c.id===id?{...c,...patch}:c));
  }

  async function addNote(event:FormEvent){
    event.preventDefault();
    if(!supabaseBrowser||!agencyId||!selected||!note.trim())return;
    const now=new Date().toISOString();
    const{error}=await supabaseBrowser.from("contact_interactions").insert({agency_id:agencyId,contact_id:selected.id,interaction_type:"note",source:"admin",title:"Observação",message:note.trim(),occurred_at:now});
    if(error)return setMessage(error.message);
    await supabaseBrowser.from("agency_contacts").update({last_interaction_at:now,last_source:"admin",updated_at:now}).eq("agency_id",agencyId).eq("id",selected.id);
    setNote("");setContacts(current=>current.map(c=>c.id===selected.id?{...c,last_interaction_at:now,last_source:"admin"}:c));await loadHistory(selected.id);
  }

  return <section className={`adminPanel crmContactsPanel${embedded?" crmContactsEmbedded":""}`} id={embedded?undefined:"contatos-salvos"}>
    <div className="adminPanelHeader"><div><span className="eyebrow">CRM</span><h2>Contatos</h2><p>Uma pessoa, um cadastro. Cada formulário, imóvel e visita entra no histórico do mesmo contato.</p></div><span>{loading?"Carregando...":`${contacts.length} contato(s)`}</span></div>
    {message?<div className="formMessage">{message}</div>:null}
    <div className="crmContactFilters"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, telefone ou e-mail"/><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">Todos os perfis</option>{Object.entries(typeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Todos os status</option>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button type="button" className="miniButton" onClick={()=>{setSearch("");setTypeFilter("");setStatusFilter("");}}>Limpar</button></div>
    {!loading&&!filtered.length?<div className="emptyMini">Nenhum contato encontrado. O primeiro envio pelo site será salvo aqui automaticamente.</div>:null}
    <div className="crmContactGrid">{filtered.map(contact=>{const prop=contact.last_property_id?propertyMap.get(contact.last_property_id):null;const broker=contact.assigned_broker_id?brokerMap.get(contact.assigned_broker_id):null;const whatsapp=digits(contact.phone);return <article className={`crmContactCard${selectedId===contact.id?" active":""}`} key={contact.id}>
      <button className="crmContactOpen" type="button" onClick={()=>void loadHistory(contact.id)}><div className="crmContactAvatar">{contact.name.slice(0,1).toUpperCase()}</div><div className="crmContactMain"><strong>{contact.name}</strong><span>{typeLabels[contact.contact_type]}</span><small>{contact.phone||contact.email||"Sem telefone/e-mail"}</small></div><span className={`crmContactStatus status-${contact.status}`}>{statusLabels[contact.status]}</span></button>
      <div className="crmContactMeta"><span><b>Origem</b>{sourceLabels[contact.last_source||""]||contact.last_source||"—"}</span><span><b>Interesse</b>{prop?`${prop.code} · ${prop.title}`:"—"}</span><span><b>Corretor</b>{broker?.name||"Não atribuído"}</span><span><b>Último contato</b>{dateTime(contact.last_interaction_at)}</span></div>
      <div className="crmContactActions">{whatsapp?<a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>:null}{contact.email?<a href={`mailto:${contact.email}`}>E-mail</a>:null}<button type="button" onClick={()=>void loadHistory(contact.id)}>Histórico</button></div>
    </article>;})}</div>
    {selected?<div className="crmContactDetail"><div className="crmContactDetailHead"><div><span className="eyebrow">CONTATO</span><h3>{selected.name}</h3><p>{selected.phone||"Sem telefone"}{selected.email?` · ${selected.email}`:""}</p></div><button type="button" className="miniButton" onClick={()=>{setSelectedId("");setInteractions([]);}}>Fechar</button></div>
      <div className="crmContactEdit"><label>Status<select value={selected.status} onChange={e=>void updateContact(selected.id,{status:e.target.value as ContactStatus})}>{Object.entries(statusLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Corretor responsável<select value={selected.assigned_broker_id||""} onChange={e=>void updateContact(selected.id,{assigned_broker_id:e.target.value||null})}><option value="">Não atribuído</option>{brokers.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label></div>
      <form className="crmContactNote" onSubmit={addNote}><textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} maxLength={2000} placeholder="Registrar observação no histórico..."/><button className="button primary" disabled={!note.trim()}>Adicionar ao histórico</button></form>
      <div className="crmTimeline">{interactions.map(item=>{const p=item.property_id?propertyMap.get(item.property_id):null;return <article key={item.id}><span></span><div><small>{dateTime(item.occurred_at)} · {sourceLabels[item.source||""]||item.source||"Sistema"}</small><strong>{item.title}</strong>{p?<em>Imóvel {p.code} · {p.title}</em>:null}{item.message?<p>{item.message}</p>:null}</div></article>;})}{!interactions.length?<div className="emptyMini">Sem histórico registrado.</div>:null}</div>
    </div>:null}
  </section>;
}
