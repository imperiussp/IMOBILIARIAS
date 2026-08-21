"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type City = { id: string; name: string; state_code: string };
type Neighborhood = { id: string; city_id: string; name: string };

export default function AdminLocations() {
  const [cities, setCities] = useState<City[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const [cityResult, neighborhoodResult] = await Promise.all([
      supabaseBrowser.from("cities").select("id,name,state_code").order("state_code").order("name"),
      supabaseBrowser.from("neighborhoods").select("id,city_id,name").order("name"),
    ]);
    if (cityResult.error || neighborhoodResult.error) {
      setMessage(cityResult.error?.message || neighborhoodResult.error?.message || "Erro ao carregar localidades.");
      return;
    }
    setCities((cityResult.data || []) as City[]);
    setNeighborhoods((neighborhoodResult.data || []) as Neighborhood[]);
    if (!selectedCity && cityResult.data?.[0]?.id) setSelectedCity(cityResult.data[0].id);
  }

  useEffect(() => { void load(); }, []);

  const cityNeighborhoods = useMemo(() => neighborhoods.filter((item) => item.city_id === selectedCity), [neighborhoods, selectedCity]);

  async function addCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado.");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("city_name") || "").trim();
    const stateCode = String(form.get("state_code") || "").trim().toUpperCase().slice(0, 2);
    if (!name || stateCode.length !== 2) return setMessage("Informe cidade e UF com 2 letras.");
    const { data, error } = await supabaseBrowser.from("cities").insert({ name, state_code: stateCode }).select("id,name,state_code").single();
    if (error) return setMessage(error.message);
    event.currentTarget.reset();
    setCities((current) => [...current, data as City].sort((a, b) => `${a.state_code}${a.name}`.localeCompare(`${b.state_code}${b.name}`)));
    setSelectedCity(data.id);
    setMessage("Cidade cadastrada.");
  }

  async function addNeighborhood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado.");
    if (!selectedCity) return setMessage("Selecione uma cidade.");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("neighborhood_name") || "").trim();
    if (!name) return setMessage("Informe o bairro.");
    const { data, error } = await supabaseBrowser.from("neighborhoods").insert({ city_id: selectedCity, name }).select("id,city_id,name").single();
    if (error) return setMessage(error.message);
    event.currentTarget.reset();
    setNeighborhoods((current) => [...current, data as Neighborhood]);
    setMessage("Bairro cadastrado.");
  }

  async function removeNeighborhood(id: string) {
    if (!supabaseBrowser) return;
    const { error } = await supabaseBrowser.from("neighborhoods").delete().eq("id", id);
    if (error) return setMessage(error.message);
    setNeighborhoods((current) => current.filter((item) => item.id !== id));
    setMessage("Bairro removido.");
  }

  return (
    <div className="adminPanel" id="localidades">
      <div className="adminPanelHeader"><div><span className="eyebrow">LOCALIZAÇÃO</span><h2>Cidades e bairros</h2><p>Organize as localidades usadas nos filtros e nos cadastros de imóveis.</p></div><span>{isSupabaseConfigured ? `${cities.length} cidade(s)` : "Modo demonstração"}</span></div>
      {!isSupabaseConfigured && <div className="formNotice">Configure o Supabase exclusivo do IMOBILIARIAS para ativar esta gestão.</div>}
      <div className="adminSplit">
        <section>
          <h3>Adicionar cidade</h3>
          <form className="locationForm" onSubmit={addCity}>
            <input name="city_name" placeholder="Nome da cidade" required />
            <input name="state_code" placeholder="UF" maxLength={2} required />
            <button className="button primary" type="submit">Adicionar</button>
          </form>
          <div className="locationList">{cities.map((city) => <button key={city.id} type="button" className={`locationChip ${selectedCity === city.id ? "active" : ""}`} onClick={() => setSelectedCity(city.id)}>{city.name} - {city.state_code}</button>)}</div>
        </section>
        <section>
          <h3>Bairros {selectedCity ? `· ${cities.find((item) => item.id === selectedCity)?.name || ""}` : ""}</h3>
          <form className="locationForm" onSubmit={addNeighborhood}>
            <input name="neighborhood_name" placeholder="Nome do bairro" required disabled={!selectedCity} />
            <button className="button primary" type="submit" disabled={!selectedCity}>Adicionar</button>
          </form>
          <div className="neighborhoodList">{cityNeighborhoods.length === 0 ? <span className="emptyMini">Nenhum bairro cadastrado.</span> : cityNeighborhoods.map((item) => <div className="neighborhoodRow" key={item.id}><span>{item.name}</span><button type="button" className="miniButton danger" onClick={() => void removeNeighborhood(item.id)}>Remover</button></div>)}</div>
        </section>
      </div>
      {message && <div className="formMessage">{message}</div>}
    </div>
  );
}
