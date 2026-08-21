"use client";

import { FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Option = { id: string; name: string; state_code?: string };
type BrokerOption = { id: string; name: string };
type FeatureOption = { id: string; name: string };

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function safeFilename(value: string) {
  const parts = value.split(".");
  const extension = parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : "";
  return `${slugify(parts.join(".")) || "foto"}${extension}`;
}

export default function AdminPropertyForm() {
  const [cities, setCities] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [brokers, setBrokers] = useState<BrokerOption[]>([]);
  const [features, setFeatures] = useState<FeatureOption[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    if (!supabaseBrowser) return;
    void Promise.all([
      supabaseBrowser.from("cities").select("id,name,state_code").order("name"),
      supabaseBrowser.from("property_types").select("id,name").eq("active", true).order("name"),
      supabaseBrowser.from("brokers").select("id,name").eq("active", true).order("name"),
      supabaseBrowser.from("property_features").select("id,name").order("name"),
    ]).then(([cityResult, typeResult, brokerResult, featureResult]) => {
      if (cityResult.data) setCities(cityResult.data);
      if (typeResult.data) setTypes(typeResult.data);
      if (brokerResult.data) setBrokers(brokerResult.data);
      if (featureResult.data) setFeatures(featureResult.data);
    });
  }, []);

  async function uploadPhotos(propertyId: string) {
    if (!supabaseBrowser || photos.length === 0) return;
    const rows: Array<{ property_id: string; storage_path: string; position: number; is_cover: boolean; alt_text: string }> = [];
    for (const [index, file] of photos.entries()) {
      const storagePath = `${propertyId}/${Date.now()}-${index}-${safeFilename(file.name)}`;
      const upload = await supabaseBrowser.storage.from("property-photos").upload(storagePath, file, { cacheControl: "3600", upsert: false });
      if (upload.error) throw upload.error;
      rows.push({ property_id: propertyId, storage_path: storagePath, position: index, is_cover: index === 0, alt_text: `Foto ${index + 1} do imóvel` });
    }
    const inserted = await supabaseBrowser.from("property_photos").insert(rows);
    if (inserted.error) throw inserted.error;
  }

  async function saveFeatures(propertyId: string) {
    if (!supabaseBrowser || selectedFeatures.length === 0) return;
    const rows = selectedFeatures.map((featureId) => ({ property_id: propertyId, feature_id: featureId }));
    const result = await supabaseBrowser.from("property_feature_links").insert(rows);
    if (result.error) throw result.error;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado. O formulário está pronto, mas precisa das chaves do projeto para gravar.");
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const cityId = String(form.get("city_id") || "");
    const neighborhoodName = String(form.get("neighborhood") || "").trim();
    const propertyTypeId = String(form.get("property_type_id") || "");
    const brokerId = String(form.get("broker_id") || "") || null;
    const purpose = String(form.get("purpose") || "sale");
    const zone = String(form.get("zone") || "urban");
    const segment = String(form.get("segment") || "residential");
    const publicationState = String(form.get("publication_state") || "published");
    const price = Number(String(form.get("price") || "0").replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
    if (!title || !cityId || !propertyTypeId) return setMessage("Preencha título, cidade e tipo do imóvel.");
    if (photos.length > 20) return setMessage("Use no máximo 20 fotos por imóvel.");

    setSaving(true);
    try {
      let neighborhoodId: string | null = null;
      if (neighborhoodName) {
        const existing = await supabaseBrowser.from("neighborhoods").select("id").eq("city_id", cityId).ilike("name", neighborhoodName).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data?.id) neighborhoodId = existing.data.id;
        else {
          const created = await supabaseBrowser.from("neighborhoods").insert({ city_id: cityId, name: neighborhoodName }).select("id").single();
          if (created.error) throw created.error;
          neighborhoodId = created.data.id;
        }
      }

      const code = `IM-${Date.now().toString().slice(-6)}`;
      const slug = `${slugify(title)}-${code.toLowerCase()}`;
      const payload = {
        code, title, slug, broker_id: brokerId, city_id: cityId, neighborhood_id: neighborhoodId, property_type_id: propertyTypeId,
        description: String(form.get("description") || "").trim() || null, purpose, zone, segment,
        publication_state: publicationState, status: String(form.get("status") || "available"), price,
        bedrooms: Number(form.get("bedrooms") || 0), suites: Number(form.get("suites") || 0), bathrooms: Number(form.get("bathrooms") || 0), parking_spaces: Number(form.get("parking_spaces") || 0),
        built_area_m2: Number(form.get("built_area_m2") || 0) || null, land_area_m2: Number(form.get("land_area_m2") || 0) || null,
        address: String(form.get("address") || "").trim() || null, address_public: form.get("address_public") === "on",
        featured: form.get("featured") === "on", published_at: publicationState === "published" ? new Date().toISOString() : null,
      };

      const result = await supabaseBrowser.from("properties").insert(payload).select("id,code").single();
      if (result.error) throw result.error;
      await Promise.all([uploadPhotos(result.data.id), saveFeatures(result.data.id)]);
      setMessage(`Imóvel ${result.data.code} ${publicationState === "draft" ? "salvo como rascunho" : "publicado"}${photos.length ? ` com ${photos.length} foto(s)` : ""}.`);
      event.currentTarget.reset(); setPhotos([]); setSelectedFeatures([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  }

  return (
    <form className="propertyForm" onSubmit={submit}>
      {!isSupabaseConfigured && <div className="formNotice">Modo demonstração: configure o Supabase para ativar a gravação real.</div>}
      <label>Título do imóvel<input name="title" placeholder="Ex.: Casa com 3 quartos no Centro" required /></label>
      <div className="formGrid three"><label>Finalidade<select name="purpose" defaultValue="sale"><option value="sale">Venda</option><option value="rent">Locação</option></select></label><label>Uso<select name="segment" defaultValue="residential"><option value="residential">Residencial</option><option value="commercial">Comercial</option></select></label><label>Zona<select name="zone" defaultValue="urban"><option value="urban">Urbana</option><option value="rural">Rural</option></select></label></div>
      <div className="formGrid"><label>Cidade<select name="city_id" required defaultValue=""><option value="">Selecione</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}{city.state_code ? ` - ${city.state_code}` : ""}</option>)}</select></label><label>Bairro<input name="neighborhood" placeholder="Centro" /></label></div>
      <label>Endereço<input name="address" placeholder="Rua, número e complemento" /></label>
      <label className="checkLabel"><input type="checkbox" name="address_public" /> Exibir endereço completo no site público</label>
      <div className="formGrid"><label>Tipo<select name="property_type_id" required defaultValue=""><option value="">Selecione</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label>Corretor<select name="broker_id" defaultValue=""><option value="">Sem corretor definido</option>{brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name}</option>)}</select></label></div>
      <div className="formGrid three"><label>Valor<input name="price" inputMode="decimal" placeholder="R$ 0,00" /></label><label>Status<select name="status" defaultValue="available"><option value="available">Disponível</option><option value="reserved">Reservado</option><option value="rented">Alugado</option><option value="sold">Vendido</option><option value="inactive">Inativo</option></select></label><label>Publicação<select name="publication_state" defaultValue="published"><option value="published">Publicar agora</option><option value="draft">Salvar como rascunho</option></select></label></div>
      <div className="formGrid three"><label>Quartos<input name="bedrooms" type="number" min="0" defaultValue="0" /></label><label>Suítes<input name="suites" type="number" min="0" defaultValue="0" /></label><label>Banheiros<input name="bathrooms" type="number" min="0" defaultValue="0" /></label></div>
      <div className="formGrid three"><label>Vagas<input name="parking_spaces" type="number" min="0" defaultValue="0" /></label><label>Área construída (m²)<input name="built_area_m2" type="number" min="0" step="0.01" /></label><label>Terreno (m²)<input name="land_area_m2" type="number" min="0" step="0.01" /></label></div>
      <label>Descrição<textarea name="description" rows={5} placeholder="Descreva os principais diferenciais do imóvel." /></label>
      {features.length > 0 ? <fieldset className="featurePicker"><legend>Características</legend><div>{features.map((feature) => <label className="featureOption" key={feature.id}><input type="checkbox" checked={selectedFeatures.includes(feature.id)} onChange={(event) => setSelectedFeatures((current) => event.target.checked ? [...current, feature.id] : current.filter((id) => id !== feature.id))} /> {feature.name}</label>)}</div></fieldset> : null}
      <label className="uploadBox">Fotos do imóvel<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 20))} /><span>{photos.length ? `${photos.length} foto(s) selecionada(s). A primeira será a capa.` : "Selecione até 20 fotos JPG, PNG ou WebP. A primeira será usada como capa."}</span></label>
      <label className="checkLabel"><input type="checkbox" name="featured" /> Destacar imóvel na vitrine</label>
      {message && <div className="formMessage">{message}</div>}
      <div className="formActions"><button type="reset" className="button secondary" onClick={() => { setPhotos([]); setSelectedFeatures([]); }}>Limpar</button><button type="submit" className="button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar imóvel"}</button></div>
    </form>
  );
}
