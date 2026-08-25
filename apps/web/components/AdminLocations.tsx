"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type City = { id: string; name: string; state_code: string };
type Neighborhood = { id: string; city_id: string; name: string };
type IbgeCity = { nome?: string };

const states = [
  ["AC","Acre"],["AL","Alagoas"],["AP","Amapá"],["AM","Amazonas"],["BA","Bahia"],["CE","Ceará"],["DF","Distrito Federal"],
  ["ES","Espírito Santo"],["GO","Goiás"],["MA","Maranhão"],["MT","Mato Grosso"],["MS","Mato Grosso do Sul"],["MG","Minas Gerais"],
  ["PA","Pará"],["PB","Paraíba"],["PR","Paraná"],["PE","Pernambuco"],["PI","Piauí"],["RJ","Rio de Janeiro"],["RN","Rio Grande do Norte"],
  ["RS","Rio Grande do Sul"],["RO","Rondônia"],["RR","Roraima"],["SC","Santa Catarina"],["SP","São Paulo"],["SE","Sergipe"],["TO","Tocantins"],
] as const;

export default function AdminLocations() {
  const [agencyId, setAgencyId] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [officialCities, setOfficialCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [stateCode, setStateCode] = useState("PR");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCityName, setSelectedCityName] = useState("");
  const [message, setMessage] = useState("");
  const [loadingCities, setLoadingCities] = useState(false);

  async function loadDatabase(targetAgencyId?: string) {
    if (!supabaseBrowser) return;
    const resolvedAgencyId = targetAgencyId || agencyId;
    const [cityResult, neighborhoodResult] = await Promise.all([
      supabaseBrowser.from("cities").select("id,name,state_code").order("state_code").order("name"),
      resolvedAgencyId
        ? supabaseBrowser.from("neighborhoods").select("id,city_id,name").or(`agency_id.is.null,agency_id.eq.${resolvedAgencyId}`).order("name")
        : supabaseBrowser.from("neighborhoods").select("id,city_id,name").is("agency_id", null).order("name"),
    ]);
    if (cityResult.error || neighborhoodResult.error) {
      setMessage(cityResult.error?.message || neighborhoodResult.error?.message || "Erro ao carregar localidades.");
      return;
    }
    setCities((cityResult.data || []) as City[]);
    setNeighborhoods((neighborhoodResult.data || []) as Neighborhood[]);
  }

  async function loadOfficial(state: string) {
    setLoadingCities(true);
    setOfficialCities([]);
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios?orderBy=nome`);
      if (!response.ok) throw new Error("Não foi possível consultar a lista oficial de cidades.");
      const data = await response.json() as IbgeCity[];
      setOfficialCities(data.map((item) => String(item.nome || "")).filter(Boolean));
    } catch {
      setOfficialCities([]);
      setMessage("A lista oficial de cidades não pôde ser carregada agora. Você ainda pode cadastrar uma cidade manualmente.");
    } finally { setLoadingCities(false); }
  }

  useEffect(() => {
    void (async () => {
      if (!supabaseBrowser) return;
      const agency = await getCurrentAgency();
      if (!agency) return setMessage("Imobiliária ativa não encontrada.");
      setAgencyId(agency.agencyId);
      await loadDatabase(agency.agencyId);
    })();
    void loadOfficial("PR");
  }, []);

  const availableCities = useMemo(() => {
    const local = cities.filter((item) => item.state_code === stateCode).map((item) => item.name);
    return Array.from(new Set([...officialCities, ...local])).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  }, [cities, officialCities, stateCode]);

  const cityNeighborhoods = useMemo(() => neighborhoods.filter((item) => item.city_id === selectedCity), [neighborhoods, selectedCity]);

  async function resolveCity(name: string) {
    if (!supabaseBrowser || !agencyId || !name) return;
    const existing = cities.find((item) => item.state_code === stateCode && item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
    if (existing) {
      setSelectedCity(existing.id); setSelectedCityName(existing.name); return;
    }
    const { data, error } = await supabaseBrowser.rpc("agency_upsert_city", { p_agency_id: agencyId, p_name: name, p_state_code: stateCode });
    if (error) return setMessage(error.message);
    const city = Array.isArray(data) ? data[0] as City | undefined : undefined;
    if (!city) return setMessage("Não foi possível preparar a cidade para uso.");
    setCities((current) => current.some((item) => item.id === city.id) ? current : [...current, city]);
    setSelectedCity(city.id); setSelectedCityName(city.name);
  }

  async function addCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("city_name") || "").trim();
    if (!name) return setMessage("Informe o nome da cidade.");
    await resolveCity(name);
    event.currentTarget.reset();
    setMessage("Cidade disponível para os cadastros.");
  }

  async function addNeighborhood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId) return;
    if (!selectedCity) return setMessage("Selecione uma cidade.");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("neighborhood_name") || "").trim();
    if (!name) return setMessage("Informe o bairro.");
    const { data, error } = await supabaseBrowser.rpc("agency_upsert_neighborhood", { p_agency_id: agencyId, p_city_id: selectedCity, p_name: name });
    if (error) return setMessage(error.message);
    const neighborhood = Array.isArray(data) ? data[0] as Neighborhood | undefined : undefined;
    if (!neighborhood) return setMessage("Não foi possível cadastrar o bairro.");
    setNeighborhoods((current) => current.some((item) => item.id === neighborhood.id) ? current : [...current, neighborhood]);
    event.currentTarget.reset();
    setMessage("Bairro disponível para os cadastros.");
  }

  async function removeNeighborhood(id: string) {
    if (!supabaseBrowser) return;
    const { error } = await supabaseBrowser.from("neighborhoods").delete().eq("id", id);
    if (error) return setMessage(error.message);
    setNeighborhoods((current) => current.filter((item) => item.id !== id));
    setMessage("Bairro removido.");
  }

  return <div className="adminPanel" id="localidades">
    <div className="adminPanelHeader"><div><span className="eyebrow">LOCALIZAÇÃO</span><h2>Cidades e bairros</h2><p>Escolha o estado, use a lista oficial de municípios e mantenha bairros próprios quando necessário.</p></div><span>{cities.length} cidade(s) utilizadas</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">Configure o Supabase exclusivo do IMOBILIARIAS para ativar esta gestão.</div> : null}

    <div className="locationStateBar">
      <label>Estado<select value={stateCode} onChange={(event) => { const next=event.target.value; setStateCode(next); setSelectedCity(""); setSelectedCityName(""); void loadOfficial(next); }}>{states.map(([uf,name])=><option value={uf} key={uf}>{name} - {uf}</option>)}</select></label>
      <label>Cidade<select value={selectedCityName} disabled={loadingCities} onChange={(event)=>{const name=event.target.value; setSelectedCityName(name); void resolveCity(name);}}><option value="">{loadingCities?"Carregando cidades...":"Selecione uma cidade"}</option>{availableCities.map((name)=><option value={name} key={name}>{name}</option>)}</select></label>
    </div>

    <div className="adminSplit">
      <section>
        <h3>Cidade não encontrada?</h3>
        <p className="locationHelp">Cadastre manualmente e ela ficará disponível para esta imobiliária.</p>
        <form className="locationForm locationFormSimple" onSubmit={addCity}><input name="city_name" placeholder="Nome da nova cidade" required/><button className="button primary" type="submit">Adicionar cidade</button></form>
      </section>
      <section>
        <h3>Bairros{selectedCityName ? ` · ${selectedCityName}` : ""}</h3>
        <p className="locationHelp">Os bairros já conhecidos aparecem abaixo. Você pode adicionar qualquer bairro novo.</p>
        <form className="locationForm locationFormSimple" onSubmit={addNeighborhood}><input name="neighborhood_name" placeholder="Nome do bairro" required disabled={!selectedCity}/><button className="button primary" type="submit" disabled={!selectedCity}>Adicionar bairro</button></form>
        <div className="neighborhoodList">{!selectedCity ? <span className="emptyMini">Selecione uma cidade para visualizar os bairros.</span> : cityNeighborhoods.length===0 ? <span className="emptyMini">Nenhum bairro cadastrado para esta cidade ainda.</span> : cityNeighborhoods.map((item)=><div className="neighborhoodRow" key={item.id}><span>{item.name}</span><button type="button" className="miniButton danger" onClick={()=>void removeNeighborhood(item.id)}>Remover</button></div>)}</div>
      </section>
    </div>
    {message ? <div className="formMessage">{message}</div> : null}
  </div>;
}
