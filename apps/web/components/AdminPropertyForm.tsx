"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { prepareBrowserPropertyPhoto } from "../lib/browserImageProcessing";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type City = { id: string; name: string; state_code: string };
type Neighborhood = { id: string; city_id: string; name: string };
type Option = { id: string; name: string };
type BrokerOption = { id: string; name: string };
type FeatureOption = { id: string; name: string };
type IbgeCity = { nome?: string };

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function propertyCode() {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(6, "0").slice(-6);
  return `IM-${timestamp}${random}`;
}

export default function AdminPropertyForm() {
  const [agencyId, setAgencyId] = useState("");
  const [agencySlug, setAgencySlug] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [brokers, setBrokers] = useState<BrokerOption[]>([]);
  const [features, setFeatures] = useState<FeatureOption[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [stateCode, setStateCode] = useState("");
  const [cityName, setCityName] = useState("");
  const [officialCities, setOfficialCities] = useState<string[]>([]);
  const [neighborhoodChoice, setNeighborhoodChoice] = useState("");
  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [propertyTypeChoice, setPropertyTypeChoice] = useState("");
  const [newPropertyType, setNewPropertyType] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [createdPropertyId, setCreatedPropertyId] = useState("");

  const publicSiteUrl = agencySlug ? `https://${agencySlug}.imoveis.lenoy.com.br` : "";
  const createdPropertyUrl = createdPropertyId && publicSiteUrl ? `${publicSiteUrl}/imovel/?id=${encodeURIComponent(createdPropertyId)}` : "";
  const localCity = useMemo(() => cities.find((c) => c.state_code === stateCode && normalize(c.name) === normalize(cityName)) || null, [cities, cityName, stateCode]);
  const availableNeighborhoods = useMemo(() => localCity ? neighborhoods.filter((n) => n.city_id === localCity.id) : [], [localCity, neighborhoods]);

  useEffect(() => {
    if (!supabaseBrowser) return;
    let active = true;
    void (async () => {
      const current = await getCurrentAgency();
      if (!active || !current) return;
      setAgencyId(current.agencyId);
      setAgencySlug(current.agencySlug);
      const [cityResult, neighborhoodResult, typeResult, brokerResult, featureResult] = await Promise.all([
        supabaseBrowser.from("cities").select("id,name,state_code").order("name"),
        supabaseBrowser.from("neighborhoods").select("id,city_id,name").or(`agency_id.is.null,agency_id.eq.${current.agencyId}`).order("name"),
        supabaseBrowser.from("property_types").select("id,name").eq("active", true).order("name"),
        supabaseBrowser.from("brokers").select("id,name").eq("agency_id", current.agencyId).eq("active", true).order("name"),
        supabaseBrowser.from("property_features").select("id,name").order("name"),
      ]);
      if (!active) return;
      setCities((cityResult.data || []) as City[]);
      setNeighborhoods((neighborhoodResult.data || []) as Neighborhood[]);
      setTypes((typeResult.data || []) as Option[]);
      setBrokers((brokerResult.data || []) as BrokerOption[]);
      setFeatures((featureResult.data || []) as FeatureOption[]);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setCityName(""); setNeighborhoodChoice(""); setNewNeighborhood("");
    const local = cities.filter((c) => c.state_code === stateCode).map((c) => c.name);
    setOfficialCities(local);
    if (!stateCode) return;
    let cancelled = false;
    void fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios?orderBy=nome`)
      .then((r) => r.ok ? r.json() : [])
      .then((rows: IbgeCity[]) => {
        if (cancelled) return;
        setOfficialCities(Array.from(new Set([...local, ...rows.map((r) => String(r.nome || "")).filter(Boolean)])).sort((a,b) => a.localeCompare(b,"pt-BR")));
      }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [stateCode]);

  useEffect(() => { setNeighborhoodChoice(""); setNewNeighborhood(""); }, [cityName]);

  async function resolveCity() {
    if (!supabaseBrowser || !agencyId || !stateCode || !cityName.trim()) throw new Error("Selecione o estado e a cidade.");
    const result = await supabaseBrowser.rpc("mobile_broker_resolve_city", { p_agency_id: agencyId, p_name: cityName.trim(), p_state_code: stateCode });
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row?.id) throw new Error("Não foi possível preparar a cidade.");
    return String(row.id);
  }

  async function resolveNeighborhood(cityId: string) {
    if (!supabaseBrowser || !agencyId) return null;
    const name = neighborhoodChoice === "__new__" ? newNeighborhood.trim() : neighborhoodChoice.trim();
    if (!name) return null;
    const result = await supabaseBrowser.rpc("mobile_broker_resolve_neighborhood", { p_agency_id: agencyId, p_city_id: cityId, p_name: name });
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    return row?.id ? String(row.id) : null;
  }

  async function resolvePropertyType() {
    if (!supabaseBrowser || !agencyId) throw new Error("Imobiliária não identificada.");
    if (propertyTypeChoice && propertyTypeChoice !== "__new__") return propertyTypeChoice;
    const name = newPropertyType.trim();
    if (!name) throw new Error("Selecione ou informe o tipo do imóvel.");
    const result = await supabaseBrowser.rpc("mobile_broker_resolve_property_type", { p_agency_id: agencyId, p_name: name });
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row?.id) throw new Error("Não foi possível criar o tipo de imóvel.");
    return String(row.id);
  }

  async function uploadPhotos(propertyId: string, title: string) {
    if (!supabaseBrowser || !photos.length) return [] as string[];
    const created: string[] = [];
    for (const [index, file] of photos.entries()) {
      const prepared = await prepareBrowserPropertyPhoto(file);
      const token = `${Date.now()}-${index}`;
      const storagePath = `${agencyId}/${propertyId}/admin/${token}.jpg`;
      const thumbnailPath = `${agencyId}/${propertyId}/admin/thumbs/${token}.jpg`;
      const full = await supabaseBrowser.storage.from("property-photos").upload(storagePath, prepared.full, { cacheControl:"31536000", contentType:"image/jpeg" });
      if (full.error) throw full.error; created.push(storagePath);
      const thumb = await supabaseBrowser.storage.from("property-photos").upload(thumbnailPath, prepared.thumbnail, { cacheControl:"31536000", contentType:"image/jpeg" });
      if (thumb.error) throw thumb.error; created.push(thumbnailPath);
      const db = await supabaseBrowser.from("property_photos").insert({ property_id:propertyId, storage_path:storagePath, thumbnail_path:thumbnailPath, position:index, is_cover:index===0, alt_text:`${title} - foto ${index+1}` });
      if (db.error) throw db.error;
    }
    return created;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") || "").trim();
    if (!title || !stateCode || !cityName.trim()) return setMessage("Preencha título, estado e cidade.");
    if (photos.length > 20) return setMessage("Use no máximo 20 fotos por imóvel.");
    setSaving(true); setMessage(""); setCreatedPropertyId("");
    let propertyId = ""; let uploaded: string[] = [];
    try {
      const limit = await supabaseBrowser.rpc("agency_can_create_property", { p_agency_id: agencyId });
      if (limit.error) throw limit.error;
      if (limit.data === false) throw new Error("Seu plano atingiu o limite de imóveis ativos.");
      const cityId = await resolveCity();
      const neighborhoodId = await resolveNeighborhood(cityId);
      const propertyTypeId = await resolvePropertyType();
      const publicationState = String(form.get("publication_state") || "published");
      const code = propertyCode();
      const payload = {
        agency_id:agencyId, code, title, slug:`${slugify(title)}-${code.toLowerCase()}`,
        broker_id:String(form.get("broker_id") || "") || null, city_id:cityId, neighborhood_id:neighborhoodId, property_type_id:propertyTypeId,
        description:String(form.get("description") || "").trim() || null,
        purpose:String(form.get("purpose") || "sale"), zone:String(form.get("zone") || "urban"), segment:String(form.get("segment") || "residential"),
        publication_state:publicationState, status:String(form.get("status") || "available"),
        price:Number(String(form.get("price") || "0").replace(/[^0-9.,]/g,"").replace(/\./g,"").replace(",",".")) || 0,
        bedrooms:Number(form.get("bedrooms") || 0), suites:Number(form.get("suites") || 0), bathrooms:Number(form.get("bathrooms") || 0), parking_spaces:Number(form.get("parking_spaces") || 0),
        built_area_m2:Number(form.get("built_area_m2") || 0) || null, land_area_m2:Number(form.get("land_area_m2") || 0) || null,
        address:String(form.get("address") || "").trim() || null, address_public:form.get("address_public") === "on", featured:form.get("featured") === "on",
        published_at:publicationState === "published" ? new Date().toISOString() : null,
      };
      const inserted = await supabaseBrowser.from("properties").insert(payload).select("id").single();
      if (inserted.error) throw inserted.error;
      propertyId = inserted.data.id;
      uploaded = await uploadPhotos(propertyId, title);
      if (selectedFeatures.length) {
        const links = await supabaseBrowser.from("property_feature_links").insert(selectedFeatures.map((feature_id) => ({ property_id:propertyId, feature_id })));
        if (links.error) throw links.error;
      }
      setCreatedPropertyId(propertyId);
      setMessage(publicationState === "draft" ? "Imóvel salvo como rascunho." : "Imóvel publicado com sucesso.");
      formElement.reset(); setStateCode(""); setCityName(""); setNeighborhoodChoice(""); setNewNeighborhood(""); setPropertyTypeChoice(""); setNewPropertyType(""); setPhotos([]); setSelectedFeatures([]);
    } catch (error) {
      if (uploaded.length) await supabaseBrowser.storage.from("property-photos").remove(uploaded);
      if (propertyId) { await supabaseBrowser.from("property_feature_links").delete().eq("property_id",propertyId); await supabaseBrowser.from("property_photos").delete().eq("property_id",propertyId); await supabaseBrowser.from("properties").delete().eq("id",propertyId).eq("agency_id",agencyId); }
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o imóvel. Revise os dados e tente novamente.");
    } finally { setSaving(false); }
  }

  return <form className="propertyForm mobilePropertyForm" onSubmit={submit}>
    <label>Título do imóvel<input name="title" placeholder="Ex.: Casa com 3 quartos no Centro" required /></label>
    <div className="formGrid three"><label>Finalidade<select name="purpose" defaultValue="sale"><option value="sale">Venda</option><option value="rent">Locação</option></select></label><label>Uso<select name="segment" defaultValue="residential"><option value="residential">Residencial</option><option value="commercial">Comercial</option></select></label><label>Zona<select name="zone" defaultValue="urban"><option value="urban">Urbana</option><option value="rural">Rural</option></select></label></div>
    <div className="formGrid"><label>Estado<select value={stateCode} onChange={(e)=>setStateCode(e.target.value)} required><option value="">Selecione a UF</option>{UFS.map((uf)=><option key={uf}>{uf}</option>)}</select></label><label>Cidade<input value={cityName} onChange={(e)=>setCityName(e.target.value)} list="property-city-options" disabled={!stateCode} placeholder={stateCode ? "Digite ou selecione a cidade" : "Selecione a UF primeiro"} required /><datalist id="property-city-options">{officialCities.map((name)=><option key={name} value={name}/>)}</datalist></label></div>
    <div className="formGrid"><label>Bairro<select value={neighborhoodChoice} onChange={(e)=>setNeighborhoodChoice(e.target.value)} disabled={!cityName}><option value="">Nenhum / selecione</option>{availableNeighborhoods.map((n)=><option key={n.id} value={n.name}>{n.name}</option>)}<option value="__new__">Outro / novo bairro</option></select></label>{neighborhoodChoice === "__new__" ? <label>Novo bairro<input value={newNeighborhood} onChange={(e)=>setNewNeighborhood(e.target.value)} placeholder="Nome do bairro" /></label> : <span/>}</div>
    <label>Endereço<input name="address" placeholder="Rua, número e complemento" /></label><label className="checkLabel"><input type="checkbox" name="address_public" /> Exibir localização no anúncio (mapa e endereço completo)</label><small className="formHint">Desmarcado: o cliente verá somente bairro, cidade e UF; o mapa e o endereço exato não serão publicados.</small>
    <div className="formGrid"><label>Tipo<select value={propertyTypeChoice} onChange={(e)=>setPropertyTypeChoice(e.target.value)} required><option value="">Selecione</option>{types.map((type)=><option key={type.id} value={type.id}>{type.name}</option>)}<option value="__new__">Criar novo tipo</option></select></label>{propertyTypeChoice === "__new__" ? <label>Novo tipo<input value={newPropertyType} onChange={(e)=>setNewPropertyType(e.target.value)} placeholder="Ex.: Sobrado" required /></label> : <label>Corretor<select name="broker_id" defaultValue=""><option value="">Sem corretor definido</option>{brokers.map((broker)=><option key={broker.id} value={broker.id}>{broker.name}</option>)}</select></label>}</div>
    {propertyTypeChoice === "__new__" ? <label>Corretor<select name="broker_id" defaultValue=""><option value="">Sem corretor definido</option>{brokers.map((broker)=><option key={broker.id} value={broker.id}>{broker.name}</option>)}</select></label> : null}
    <div className="formGrid three"><label>Valor<input name="price" inputMode="decimal" placeholder="R$ 0,00" /></label><label>Status<select name="status" defaultValue="available"><option value="available">Disponível</option><option value="reserved">Reservado</option><option value="rented">Alugado</option><option value="sold">Vendido</option><option value="inactive">Inativo</option></select></label><label>Publicação<select name="publication_state" defaultValue="published"><option value="published">Publicar agora</option><option value="draft">Salvar como rascunho</option></select></label></div>
    <div className="formGrid three"><label>Quartos<input name="bedrooms" type="number" min="0" placeholder="0" /></label><label>Suítes<input name="suites" type="number" min="0" placeholder="0" /></label><label>Banheiros<input name="bathrooms" type="number" min="0" placeholder="0" /></label></div>
    <div className="formGrid three"><label>Vagas<input name="parking_spaces" type="number" min="0" placeholder="0" /></label><label>Área construída (m²)<input name="built_area_m2" type="number" min="0" step="0.01" /></label><label>Terreno (m²)<input name="land_area_m2" type="number" min="0" step="0.01" /></label></div>
    <label>Descrição<textarea name="description" rows={5} placeholder="Descreva os principais diferenciais do imóvel." /></label>
    {features.length ? <details className="mobileInlineDetails"><summary>Características do imóvel</summary><fieldset className="featurePicker"><div>{features.map((feature)=><label className="featureOption" key={feature.id}><input type="checkbox" checked={selectedFeatures.includes(feature.id)} onChange={(e)=>setSelectedFeatures((current)=>e.target.checked?[...current,feature.id]:current.filter((id)=>id!==feature.id))}/> {feature.name}</label>)}</div></fieldset></details> : null}
    <label className="uploadBox">Fotos do imóvel<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e)=>setPhotos(Array.from(e.target.files || []).slice(0,20))}/><span>{photos.length ? `${photos.length} foto(s) selecionada(s). A primeira será a capa.` : "Selecione até 20 fotos."}</span></label>
    <label className="checkLabel"><input type="checkbox" name="featured" /> Destacar imóvel na vitrine</label>
    {message ? <div className="formMessage">{message}{createdPropertyUrl ? <div className="formActions"><a className="button primary" href={createdPropertyUrl} target="_blank" rel="noreferrer">Abrir imóvel</a></div> : null}</div> : null}
    <button className="button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar imóvel"}</button>
  </form>;
}
