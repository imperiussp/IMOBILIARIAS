"use client";

import { FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Option = { id: string; name: string; state_code?: string };
type BrokerOption = { id: string; name: string };

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminPropertyForm() {
  const [cities, setCities] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [brokers, setBrokers] = useState<BrokerOption[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabaseBrowser) return;
    void Promise.all([
      supabaseBrowser.from("cities").select("id,name,state_code").order("name"),
      supabaseBrowser.from("property_types").select("id,name").eq("active", true).order("name"),
      supabaseBrowser.from("brokers").select("id,name").eq("active", true).order("name"),
    ]).then(([cityResult, typeResult, brokerResult]) => {
      if (cityResult.data) setCities(cityResult.data);
      if (typeResult.data) setTypes(typeResult.data);
      if (brokerResult.data) setBrokers(brokerResult.data);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!supabaseBrowser) {
      setMessage("Supabase ainda não configurado. O formulário está pronto, mas precisa das chaves do projeto para gravar.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const cityId = String(form.get("city_id") || "");
    const neighborhoodName = String(form.get("neighborhood") || "").trim();
    const propertyTypeId = String(form.get("property_type_id") || "");
    const brokerId = String(form.get("broker_id") || "") || null;
    const purpose = String(form.get("purpose") || "sale");
    const zone = String(form.get("zone") || "urban");
    const price = Number(String(form.get("price") || "0").replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".")) || 0;

    if (!title || !cityId || !propertyTypeId) {
      setMessage("Preencha título, cidade e tipo do imóvel.");
      return;
    }

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
        code,
        title,
        slug,
        broker_id: brokerId,
        city_id: cityId,
        neighborhood_id: neighborhoodId,
        property_type_id: propertyTypeId,
        description: String(form.get("description") || "").trim() || null,
        purpose,
        zone,
        status: String(form.get("status") || "available"),
        price,
        bedrooms: Number(form.get("bedrooms") || 0),
        suites: Number(form.get("suites") || 0),
        bathrooms: Number(form.get("bathrooms") || 0),
        parking_spaces: Number(form.get("parking_spaces") || 0),
        built_area_m2: Number(form.get("built_area_m2") || 0) || null,
        land_area_m2: Number(form.get("land_area_m2") || 0) || null,
        featured: form.get("featured") === "on",
        published_at: new Date().toISOString(),
      };

      const result = await supabaseBrowser.from("properties").insert(payload).select("id,code").single();
      if (result.error) throw result.error;
      setMessage(`Imóvel ${result.data.code} cadastrado com sucesso.`);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="propertyForm" onSubmit={submit}>
      {!isSupabaseConfigured && <div className="formNotice">Modo demonstração: configure o Supabase para ativar a gravação real.</div>}
      <label>Título do imóvel<input name="title" placeholder="Ex.: Casa com 3 quartos no Centro" required /></label>
      <div className="formGrid">
        <label>Finalidade<select name="purpose" defaultValue="sale"><option value="sale">Venda</option><option value="rent">Locação</option></select></label>
        <label>Zona<select name="zone" defaultValue="urban"><option value="urban">Urbana</option><option value="rural">Rural</option></select></label>
      </div>
      <div className="formGrid">
        <label>Cidade<select name="city_id" required defaultValue=""><option value="">Selecione</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}{city.state_code ? ` - ${city.state_code}` : ""}</option>)}</select></label>
        <label>Bairro<input name="neighborhood" placeholder="Centro" /></label>
      </div>
      <div className="formGrid">
        <label>Tipo<select name="property_type_id" required defaultValue=""><option value="">Selecione</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label>Corretor<select name="broker_id" defaultValue=""><option value="">Sem corretor definido</option>{brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name}</option>)}</select></label>
      </div>
      <div className="formGrid"><label>Valor<input name="price" inputMode="decimal" placeholder="R$ 0,00" /></label><label>Status<select name="status" defaultValue="available"><option value="available">Disponível</option><option value="reserved">Reservado</option><option value="rented">Alugado</option><option value="sold">Vendido</option><option value="inactive">Inativo</option></select></label></div>
      <div className="formGrid three"><label>Quartos<input name="bedrooms" type="number" min="0" defaultValue="0" /></label><label>Suítes<input name="suites" type="number" min="0" defaultValue="0" /></label><label>Banheiros<input name="bathrooms" type="number" min="0" defaultValue="0" /></label></div>
      <div className="formGrid three"><label>Vagas<input name="parking_spaces" type="number" min="0" defaultValue="0" /></label><label>Área construída (m²)<input name="built_area_m2" type="number" min="0" step="0.01" /></label><label>Terreno (m²)<input name="land_area_m2" type="number" min="0" step="0.01" /></label></div>
      <label>Descrição<textarea name="description" rows={5} placeholder="Descreva os principais diferenciais do imóvel." /></label>
      <label className="checkLabel"><input type="checkbox" name="featured" /> Destacar imóvel na vitrine</label>
      {message && <div className="formMessage">{message}</div>}
      <div className="formActions"><button type="reset" className="button secondary">Limpar</button><button type="submit" className="button primary" disabled={saving}>{saving ? "Salvando..." : "Cadastrar imóvel"}</button></div>
    </form>
  );
}
