"use client";

import { useEffect, useMemo, useState } from "react";
import type { Property } from "../lib/properties";
import { getPropertyPhotoUrl } from "../lib/propertyPhotos";
import { currentHostname, resolveCurrentTenant } from "../lib/tenantResolver";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Props = { properties: Property[] };

type DisplayProperty = {
  id?: string;
  code: string;
  slug: string;
  title: string;
  city: string;
  neighborhood: string;
  purpose: "Venda" | "Locação";
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
};

const fallbackImage = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80";

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
    publishedAt: Date.now() - (index * 60_000),
  };
}

export default function PropertyExplorer({ properties }: Props) {
  const [catalog, setCatalog] = useState<DisplayProperty[]>(properties.map(demoToDisplay));
  const [source, setSource] = useState<"demo" | "supabase">("demo");
  const [purpose, setPurpose] = useState<"Venda" | "Locação">("Venda");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [segment, setSegment] = useState("");
  const [zone, setZone] = useState("");
  const [bedrooms, setBedrooms] = useState(0);
  const [bathrooms, setBathrooms] = useState(0);
  const [parking, setParking] = useState(0);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [sort, setSort] = useState<"recent" | "price-asc" | "price-desc" | "area-desc">("recent");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(9);

  useEffect(() => {
    const stored = window.localStorage.getItem("imobiliarias:favorites");
    if (stored) {
      try { setFavorites(JSON.parse(stored)); } catch { setFavorites([]); }
    }
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
      const mapped: DisplayProperty[] = await Promise.all(data.map(async (item: any, index: number) => {
        const preferredPath = item.cover_thumbnail_path || item.cover_path;
        const image = (await getPropertyPhotoUrl(preferredPath)) || (item.cover_path && preferredPath !== item.cover_path ? await getPropertyPhotoUrl(item.cover_path) : "") || fallbackImage;
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
          price: money(numericPrice, item.purpose),
          numericPrice,
          bedrooms: Number(item.bedrooms || 0),
          bathrooms: Number(item.bathrooms || 0),
          parking: Number(item.parking_spaces || 0),
          area: areaValue ? `${areaValue.toLocaleString("pt-BR")} m²` : "Área a consultar",
          numericArea: areaValue,
          image,
          detailHref: `imovel/?id=${encodeURIComponent(item.id)}`,
          publishedAt: Number.isFinite(explicitDate) ? explicitDate : Date.now() - (index * 60_000),
        };
      }));
      if (!active) return;
      setCatalog(mapped);
      setSource("supabase");
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
    setCity(""); setCategory(""); setSegment(""); setZone(""); setBedrooms(0); setBathrooms(0); setParking(0);
    setPriceMin(""); setPriceMax(""); setAreaMin(""); setFavoritesOnly(false); setSort("recent"); setVisibleCount(9);
  }

  const filtered = useMemo(() => {
    const minPrice = numberFromText(priceMin);
    const maxPrice = numberFromText(priceMax);
    const minArea = numberFromText(areaMin);
    const rows = catalog.filter((property) => {
      const samePurpose = property.purpose === purpose;
      const term = city.toLowerCase();
      const sameCity = !city || property.city.toLowerCase().includes(term) || property.neighborhood.toLowerCase().includes(term);
      const sameCategory = !category || property.category === category;
      const sameSegment = !segment || property.segment === segment;
      const sameZone = !zone || property.zone === zone;
      const enoughBedrooms = !bedrooms || property.bedrooms >= bedrooms;
      const enoughBathrooms = !bathrooms || property.bathrooms >= bathrooms;
      const enoughParking = !parking || property.parking >= parking;
      const priceOk = (!minPrice || property.numericPrice >= minPrice) && (!maxPrice || property.numericPrice <= maxPrice);
      const areaOk = !minArea || property.numericArea >= minArea;
      const favoriteOk = !favoritesOnly || favorites.includes(property.code);
      return samePurpose && sameCity && sameCategory && sameSegment && sameZone && enoughBedrooms && enoughBathrooms && enoughParking && priceOk && areaOk && favoriteOk;
    });
    if (sort === "recent") rows.sort((a, b) => b.publishedAt - a.publishedAt);
    if (sort === "price-asc") rows.sort((a, b) => a.numericPrice - b.numericPrice);
    if (sort === "price-desc") rows.sort((a, b) => b.numericPrice - a.numericPrice);
    if (sort === "area-desc") rows.sort((a, b) => b.numericArea - a.numericArea);
    return rows;
  }, [catalog, purpose, city, category, segment, zone, bedrooms, bathrooms, parking, priceMin, priceMax, areaMin, favoritesOnly, favorites, sort]);

  const categories = useMemo(() => Array.from(new Set(catalog.map((item) => item.category))).filter(Boolean).sort(), [catalog]);
  const latest = useMemo(() => [...catalog].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 6), [catalog]);
  const visible = filtered.slice(0, visibleCount);

  function renderCard(property: DisplayProperty, latestCard = false) {
    return <article className={`propertyCard ${latestCard ? "latestPropertyCard" : ""}`} key={`${latestCard ? "latest-" : "result-"}${property.code}`}><div className="propertyImage" style={{ backgroundImage: `url(${property.image})` }}><a className="imageLink" href={property.detailHref} aria-label={`Abrir ${property.title}`} /><span className="badge">{latestCard ? "Novo" : property.purpose}</span><button className={`favorite ${favorites.includes(property.code) ? "isFavorite" : ""}`} aria-label="Favoritar" onClick={() => toggleFavorite(property.code)}>{favorites.includes(property.code) ? "♥" : "♡"}</button></div><div className="propertyBody"><span className="propertyCode">{property.code} · {property.category} · {property.zone}</span><h3><a href={property.detailHref}>{property.title}</a></h3><p className="location">📍 {property.neighborhood}, {property.city}</p><p className="meta">{property.bedrooms} quartos • {property.bathrooms} banheiros • {property.parking} vagas • {property.area}</p><div className="propertyFooter"><strong>{property.price}</strong><a href={property.detailHref}>Ver detalhes →</a></div></div></article>;
  }

  return (
    <>
      <section className="hero" id="inicio"><div className="container heroGrid"><div><span className="eyebrow">SEU PRÓXIMO IMÓVEL COMEÇA AQUI</span><h1>Encontre um lugar para chamar de seu.</h1><p>Venda, locação, imóveis urbanos, rurais, residenciais e comerciais em uma busca simples e direta.</p><div className="heroStats"><span><strong>{catalog.length}</strong> imóveis {source === "supabase" ? "no catálogo" : "demonstrativos"}</span><button className="favoriteSummary" onClick={() => setFavoritesOnly((value) => !value)}><strong>{favorites.length}</strong> favoritos {favoritesOnly ? "· exibindo" : ""}</button></div></div><div className="searchBox"><div className="searchTabs"><button className={purpose === "Venda" ? "active" : ""} onClick={() => setPurpose("Venda")}>Comprar</button><button className={purpose === "Locação" ? "active" : ""} onClick={() => setPurpose("Locação")}>Alugar</button></div><label>Cidade ou bairro<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Digite cidade ou bairro" /></label><div className="searchRow"><label>Tipo<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todos</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Quartos<select value={bedrooms} onChange={(event) => setBedrooms(Number(event.target.value))}><option value="0">Qualquer</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select></label></div><div className="searchRow"><label>Banheiros<select value={bathrooms} onChange={(event) => setBathrooms(Number(event.target.value))}><option value="0">Qualquer</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option></select></label><label>Vagas<select value={parking} onChange={(event) => setParking(Number(event.target.value))}><option value="0">Qualquer</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option></select></label></div><div className="searchRow"><label>Uso<select value={segment} onChange={(event) => setSegment(event.target.value)}><option value="">Residencial ou comercial</option><option>Residencial</option><option>Comercial</option></select></label><label>Zona<select value={zone} onChange={(event) => setZone(event.target.value)}><option value="">Urbana ou rural</option><option>Urbana</option><option>Rural</option></select></label></div><div className="searchRow"><label>Preço mínimo<input inputMode="decimal" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} placeholder="0" /></label><label>Preço máximo<input inputMode="decimal" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} placeholder="Sem limite" /></label></div><label>Área mínima (m²)<input inputMode="decimal" value={areaMin} onChange={(event) => setAreaMin(event.target.value)} placeholder="Ex.: 80" /></label><div className="filterActions"><a className="button primary full" href="#imoveis">Ver resultados</a><button className="clearButton" onClick={clearFilters}>Limpar filtros</button></div></div></div></section>
      <section className="container quickFilters"><button className="quickFilterButton selected" onClick={() => document.getElementById("lancamentos")?.scrollIntoView({ behavior: "smooth" })}>✨ Últimos lançamentos</button>{["Casa", "Apartamento", "Rural", "Comercial"].map((item) => <button key={item} className={`quickFilterButton ${category === item ? "selected" : ""}`} onClick={() => setCategory(category === item ? "" : item)}>{item === "Casa" ? "🏠" : item === "Apartamento" ? "🏢" : item === "Rural" ? "🌿" : "🏪"} {item}</button>)}</section>
      {latest.length ? <section className="container section" id="lancamentos"><div className="sectionHeading resultsHeading"><div><span className="eyebrow">ACABARAM DE CHEGAR</span><h2>Últimos lançamentos</h2><span className="resultCount">Os imóveis publicados mais recentemente aparecem primeiro.</span></div><a className="button secondary" href="#imoveis">Ver todo o catálogo</a></div><div className="propertyGrid">{latest.map((property) => renderCard(property, true))}</div></section> : null}
      <section className="container section" id="imoveis"><div className="sectionHeading resultsHeading"><div><span className="eyebrow">RESULTADOS</span><h2>Imóveis encontrados</h2><span className="resultCount">{filtered.length} {filtered.length === 1 ? "imóvel" : "imóveis"}</span></div><label className="sortControl">Ordenar<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recent">Mais recentes</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="area-desc">Maior área</option></select></label></div>{filtered.length > 0 ? <><div className="propertyGrid">{visible.map((property) => renderCard(property))}</div>{visibleCount < filtered.length ? <div className="loadMore"><button className="button secondary" onClick={() => setVisibleCount((count) => count + 9)}>Carregar mais imóveis</button></div> : null}</> : <div className="emptyState"><strong>Nenhum imóvel encontrado.</strong><p>Tente limpar os filtros ou escolher outros critérios.</p><button className="button primary" onClick={clearFilters}>Limpar filtros</button></div>}</section>
    </>
  );
}