"use client";

import { useEffect, useMemo, useState } from "react";
import type { Property } from "../lib/properties";
import { getPropertyPhotoUrls } from "../lib/propertyPhotos";
import { currentHostname, resolveCurrentTenant } from "../lib/tenantResolver";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Props = { properties: Property[] };
type Purpose = "Venda" | "Locação";
type Choice = { value: string; label: string };

type DisplayProperty = {
  id?: string;
  code: string;
  slug: string;
  title: string;
  city: string;
  neighborhood: string;
  purpose: Purpose;
  category: string;
  segment: "Residencial" | "Comercial";
  zone: "Urbana" | "Rural";
  price: string;
  numericPrice: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  area: string;
  numericArea: number;
  image: string;
  detailHref: string;
  publishedAt: number;
  marketingLabel: string;
};

const fallbackImage = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80";
const desiredTypes = ["Apartamento", "Casa", "Casa de condomínio", "Terreno", "Chácara", "Sítio", "Ponto comercial", "Prédio comercial", "Galpão", "Salão comercial", "Fazenda"];

function money(value: number, purpose: string) {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
  return purpose === "rent" ? `${formatted}/mês` : formatted;
}

function numberFromText(value: string) {
  const normalized = value.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized) || 0;
}

function demoToDisplay(property: Property, index: number): DisplayProperty {
  return {
    code: property.code,
    slug: property.slug,
    title: property.title,
    city: property.city,
    neighborhood: property.neighborhood,
    purpose: property.purpose,
    category: property.category,
    segment: property.category === "Comercial" ? "Comercial" : "Residencial",
    zone: property.category === "Rural" ? "Rural" : "Urbana",
    price: property.price,
    numericPrice: numberFromText(property.price),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parking,
    area: property.area,
    numericArea: numberFromText(property.area),
    image: property.images[0] || fallbackImage,
    detailHref: `imovel/${property.slug}/`,
    publishedAt: Date.now() - index * 60_000,
    marketingLabel: "",
  };
}

function closeDetails(target: HTMLElement) {
  target.closest("details")?.removeAttribute("open");
}

function ChoiceField({ icon, value, placeholder, options, onChange }: { icon: string; value: string; placeholder: string; options: Choice[]; onChange: (value: string) => void }) {
  const selected = options.find((item) => item.value === value)?.label || placeholder;
  return <details className="catalogChoice"><summary><span aria-hidden="true">{icon}</span><span>{selected}</span><b>⌄</b></summary><div className="catalogChoiceMenu">
    <button type="button" className={!value ? "active" : ""} onClick={(event) => { onChange(""); closeDetails(event.currentTarget); }}>{placeholder}</button>
    {options.map((item) => <button type="button" key={item.value} className={value === item.value ? "active" : ""} onClick={(event) => { onChange(item.value); closeDetails(event.currentTarget); }}>{item.label}</button>)}
  </div></details>;
}

function BedIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19v-8m18 8v-6a2 2 0 0 0-2-2H9a3 3 0 0 0-3 3v1m-3 0h18M7 11V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3" /></svg>; }
function BathIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Zm3 0V6a3 3 0 0 1 6 0v1m-8 13-1 2m15-2 1 2" /></svg>; }
function CarIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16-1-3 2-5h12l2 5-1 3H5Zm1-8 1-3h10l1 3M7 16v2m10-2v2M7.5 13h.01m8.99 0h.01" /></svg>; }
function AreaIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6M4 4v6m16-6h-6m6 0v6M4 20h6m-6 0v-6m16 6h-6m6 0v-6" /></svg>; }

export default function PropertyExplorer({ properties }: Props) {
  const [catalog, setCatalog] = useState<DisplayProperty[]>(properties.map(demoToDisplay));
  const [source, setSource] = useState<"demo" | "supabase">("demo");
  const [purpose, setPurpose] = useState<Purpose>("Venda");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [segment, setSegment] = useState("");
  const [zone, setZone] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [parking, setParking] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [sort, setSort] = useState("recent");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem("imobiliarias:favorites");
    if (stored) { try { setFavorites(JSON.parse(stored)); } catch { setFavorites([]); } }
    const requestedType = new URLSearchParams(window.location.search).get("tipo");
    if (requestedType) setCategory(requestedType);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseBrowser) return;
    let active = true;
    void (async () => {
      const tenant = await resolveCurrentTenant();
      if (!active || !tenant) return;
      const host = currentHostname();
      if (!host) return;
      const { data, error } = await supabaseBrowser.rpc("public_catalog_for_host", { p_hostname: host });
      if (!active || error || !Array.isArray(data)) return;
      const paths = data.map((item: any) => item.cover_thumbnail_path || item.cover_path || null);
      const signedUrls = await getPropertyPhotoUrls(paths);
      const mapped: DisplayProperty[] = data.map((item: any, index: number) => {
        const areaValue = Number(item.built_area_m2 || item.land_area_m2 || 0);
        const numericPrice = Number(item.price || 0);
        const explicitDate = Date.parse(item.published_at || item.created_at || "");
        return {
          id: item.id,
          code: item.code,
          slug: item.slug,
          title: item.title,
          city: `${item.city}${item.state_code ? ` - ${item.state_code}` : ""}`,
          neighborhood: item.neighborhood || "Localização não informada",
          purpose: item.purpose === "rent" ? "Locação" : "Venda",
          category: item.property_type || "Imóvel",
          segment: item.segment === "commercial" ? "Comercial" : "Residencial",
          zone: item.zone === "rural" ? "Rural" : "Urbana",
          price: money(numericPrice, item.purpose), numericPrice,
          bedrooms: Number(item.bedrooms || 0), bathrooms: Number(item.bathrooms || 0), parking: Number(item.parking_spaces || 0),
          area: areaValue ? `${areaValue.toLocaleString("pt-BR")} m²` : "Consultar área", numericArea: areaValue,
          image: signedUrls[index] || fallbackImage,
          detailHref: `imovel/?id=${encodeURIComponent(item.id)}`,
          publishedAt: Number.isFinite(explicitDate) ? explicitDate : Date.now() - index * 60_000,
          marketingLabel: String(item.marketing_label || ""),
        };
      });
      if (!active) return;
      setCatalog(mapped); setSource("supabase");
    })();
    return () => { active = false; };
  }, []);

  function toggleFavorite(code: string) {
    setFavorites((current) => {
      const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
      window.localStorage.setItem("imobiliarias:favorites", JSON.stringify(next));
      return next;
    });
  }

  function clearFilters() {
    setCity(""); setCategory(""); setSegment(""); setZone(""); setBedrooms(""); setBathrooms(""); setParking("");
    setPriceMin(""); setPriceMax(""); setAreaMin(""); setFavoritesOnly(false); setSort("recent"); setCategoryLimits({});
  }

  const filtered = useMemo(() => {
    const minPrice = numberFromText(priceMin), maxPrice = numberFromText(priceMax), minArea = numberFromText(areaMin);
    const rows = catalog.filter((property) => {
      const term = city.toLowerCase();
      return property.purpose === purpose
        && (!city || property.city.toLowerCase().includes(term) || property.neighborhood.toLowerCase().includes(term))
        && (!category || property.category.toLowerCase() === category.toLowerCase())
        && (!segment || property.segment === segment)
        && (!zone || property.zone === zone)
        && (!bedrooms || property.bedrooms >= Number(bedrooms))
        && (!bathrooms || property.bathrooms >= Number(bathrooms))
        && (!parking || property.parking >= Number(parking))
        && (!minPrice || property.numericPrice >= minPrice) && (!maxPrice || property.numericPrice <= maxPrice)
        && (!minArea || property.numericArea >= minArea)
        && (!favoritesOnly || favorites.includes(property.code));
    });
    if (sort === "recent") rows.sort((a,b) => b.publishedAt-a.publishedAt);
    if (sort === "price-asc") rows.sort((a,b) => a.numericPrice-b.numericPrice);
    if (sort === "price-desc") rows.sort((a,b) => b.numericPrice-a.numericPrice);
    if (sort === "area-desc") rows.sort((a,b) => b.numericArea-a.numericArea);
    return rows;
  }, [catalog,purpose,city,category,segment,zone,bedrooms,bathrooms,parking,priceMin,priceMax,areaMin,favoritesOnly,favorites,sort]);

  const categories = useMemo(() => Array.from(new Set([...desiredTypes, ...catalog.map((item) => item.category)])).filter(Boolean), [catalog]);
  const latest = useMemo(() => [...catalog].sort((a,b) => b.publishedAt-a.publishedAt).slice(0,4), [catalog]);
  const grouped = useMemo(() => {
    const map = new Map<string, DisplayProperty[]>();
    filtered.forEach((item) => map.set(item.category, [...(map.get(item.category) || []), item]));
    return Array.from(map.entries());
  }, [filtered]);

  const categoryOptions = categories.map((item) => ({ value: item, label: item }));
  const quantityOptions = [1,2,3,4,5].map((n) => ({ value: String(n), label: `${n}+` }));

  function quickFilter(kind: string) {
    setCategory(""); setSegment(""); setZone("");
    if (kind === "Casa" || kind === "Apartamento") setCategory(kind);
    if (kind === "Rural") setZone("Rural");
    if (kind === "Comercial") setSegment("Comercial");
    document.getElementById("imoveis")?.scrollIntoView({ behavior: "smooth" });
  }

  function renderCard(property: DisplayProperty, latestCard = false) {
    const isNew = latestCard || Date.now() - property.publishedAt < 1000 * 60 * 60 * 24 * 30;
    return <article className="propertyCard modernPropertyCard" key={`${latestCard ? "latest-" : "result-"}${property.code}`}>
      <div className="propertyImage" style={{ backgroundImage: `url(${property.image})` }}>
        <a className="imageLink" href={property.detailHref} aria-label={`Abrir ${property.title}`} />
        <div className="propertyBadges">{isNew ? <span className="badge">Novo</span> : null}{property.marketingLabel ? <span className="badge marketingBadge">{property.marketingLabel}</span> : null}</div>
        <button className={`favorite ${favorites.includes(property.code) ? "isFavorite" : ""}`} aria-label="Favoritar" onClick={() => toggleFavorite(property.code)}>{favorites.includes(property.code) ? "♥" : "♡"}</button>
      </div>
      <div className="propertyBody"><span className="propertyCode">Ref. {property.code} · {property.category}</span><h3><a href={property.detailHref}>{property.title}</a></h3><p className="location">📍 {property.neighborhood}, {property.city}</p>
        <div className="propertyFactsCompact"><span title="Quartos"><BedIcon />{property.bedrooms}</span><span title="Banheiros"><BathIcon />{property.bathrooms}</span><span title="Vagas"><CarIcon />{property.parking}</span><span title="Área"><AreaIcon />{property.area}</span></div>
        <div className="propertyFooter"><strong>{property.price}</strong><a href={property.detailHref}>Ver detalhes →</a></div>
      </div>
    </article>;
  }

  return <>
    <section className="hero catalogHero" id="inicio"><div className="container heroGrid"><div><span className="eyebrow">SEU PRÓXIMO IMÓVEL COMEÇA AQUI</span><h1>Encontre um lugar para chamar de seu.</h1><p>Venda, locação, imóveis urbanos, rurais, residenciais e comerciais em uma busca simples e direta.</p><div className="heroStats"><span><strong>{catalog.length}</strong> imóveis {source === "supabase" ? "no catálogo" : "demonstrativos"}</span><button className="favoriteSummary" onClick={() => setFavoritesOnly((value) => !value)}><strong>{favorites.length}</strong> favoritos</button></div></div>
      <div className="searchBox compactSearchBox"><div className="searchTabs"><button className={purpose === "Venda" ? "active" : ""} onClick={() => setPurpose("Venda")}>Comprar</button><button className={purpose === "Locação" ? "active" : ""} onClick={() => setPurpose("Locação")}>Alugar</button></div>
        <div className="compactSearchInput"><span>⌕</span><input aria-label="Cidade ou bairro" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade ou bairro" /></div>
        <ChoiceField icon="⌂" value={category} placeholder="Tipo do imóvel" options={categoryOptions} onChange={setCategory} />
        <div className="compactChoiceGrid"><ChoiceField icon="▱" value={bedrooms} placeholder="Quartos" options={quantityOptions} onChange={setBedrooms} /><ChoiceField icon="♨" value={bathrooms} placeholder="Banheiros" options={quantityOptions} onChange={setBathrooms} /></div>
        <div className="compactChoiceGrid"><ChoiceField icon="▣" value={parking} placeholder="Vagas" options={quantityOptions} onChange={setParking} /><ChoiceField icon="⌂" value={segment} placeholder="Uso" options={[{value:"Residencial",label:"Residencial"},{value:"Comercial",label:"Comercial"}]} onChange={setSegment} /></div>
        <ChoiceField icon="◎" value={zone} placeholder="Zona urbana ou rural" options={[{value:"Urbana",label:"Urbana"},{value:"Rural",label:"Rural"}]} onChange={setZone} />
        <details className="advancedSearch"><summary>+ Mais filtros</summary><div className="advancedSearchGrid"><input inputMode="decimal" value={priceMin} onChange={(e)=>setPriceMin(e.target.value)} placeholder="Preço mínimo" /><input inputMode="decimal" value={priceMax} onChange={(e)=>setPriceMax(e.target.value)} placeholder="Preço máximo" /><input inputMode="decimal" value={areaMin} onChange={(e)=>setAreaMin(e.target.value)} placeholder="Área mínima (m²)" /></div></details>
        <div className="filterActions"><a className="button primary full" href="#imoveis">Ver resultados</a><button className="clearButton" onClick={clearFilters}>Limpar filtros</button></div>
      </div></div></section>

    <section className="container quickFilters quickFiltersGrid"><button className="quickFilterButton quickLatest" onClick={() => document.getElementById("lancamentos")?.scrollIntoView({behavior:"smooth"})}>✨ Últimos lançamentos</button><button className="quickFilterButton" onClick={()=>quickFilter("Casa")}>🏠 Casa</button><button className="quickFilterButton" onClick={()=>quickFilter("Apartamento")}>🏢 Apartamento</button><button className="quickFilterButton" onClick={()=>quickFilter("Rural")}>🌿 Rural</button><button className="quickFilterButton" onClick={()=>quickFilter("Comercial")}>🏪 Comercial</button></section>

    {latest.length ? <section className="container section" id="lancamentos"><div className="sectionHeading resultsHeading"><div><span className="eyebrow">ACABARAM DE CHEGAR</span><h2>Últimos lançamentos</h2></div><a className="button secondary" href="#imoveis">Ver catálogo</a></div><div className="propertyGrid">{latest.map((p)=>renderCard(p,true))}</div></section> : null}

    <section className="container section" id="imoveis"><div className="sectionHeading resultsHeading"><div><span className="eyebrow">RESULTADOS</span><h2>Imóveis encontrados</h2><span className="resultCount">{filtered.length} {filtered.length === 1 ? "imóvel" : "imóveis"}</span></div><ChoiceField icon="↕" value={sort} placeholder="Mais recentes" options={[{value:"recent",label:"Mais recentes"},{value:"price-asc",label:"Menor preço"},{value:"price-desc",label:"Maior preço"},{value:"area-desc",label:"Maior área"}]} onChange={setSort} /></div>
      {!filtered.length ? <div className="emptyState"><strong>Nenhum imóvel encontrado.</strong><span>Altere os filtros para ampliar a busca.</span><button className="button secondary" onClick={clearFilters}>Limpar filtros</button></div> : null}
      <div className="categoryResultSections">{grouped.map(([groupName, rows]) => {
        const limit = categoryLimits[groupName] || 4;
        const shown = rows.slice(0, limit);
        const remaining = Math.max(0, rows.length - shown.length);
        return <section className="categoryResultGroup" key={groupName}><div className="categoryResultHeading"><div><span className="eyebrow">{groupName}</span><h3>{rows.length} {rows.length === 1 ? "imóvel" : "imóveis"}</h3></div>{rows.length > 4 ? <div className="categoryLimitChoices"><button onClick={()=>setCategoryLimits((c)=>({...c,[groupName]:4}))}>4</button><button onClick={()=>setCategoryLimits((c)=>({...c,[groupName]:10}))}>10</button><button onClick={()=>setCategoryLimits((c)=>({...c,[groupName]:20}))}>20</button><button onClick={()=>setCategoryLimits((c)=>({...c,[groupName]:rows.length}))}>Todos</button></div> : null}</div><div className="propertyGrid">{shown.map((p)=>renderCard(p))}</div>{remaining > 0 ? <button className="showMoreCategory" onClick={()=>setCategoryLimits((c)=>({...c,[groupName]:Math.min(rows.length, Math.max(10, limit+6))}))}>+ {remaining} {remaining === 1 ? "imóvel" : "imóveis"}</button> : null}</section>;
      })}</div>
    </section>
  </>;
}
