"use client";

import { useEffect, useMemo, useState } from "react";
import type { Property } from "../lib/properties";

type Props = { properties: Property[] };

export default function PropertyExplorer({ properties }: Props) {
  const [purpose, setPurpose] = useState<"Venda" | "Locação">("Venda");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [bedrooms, setBedrooms] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem("imobiliarias:favorites");
    if (stored) setFavorites(JSON.parse(stored));
  }, []);

  function toggleFavorite(code: string) {
    setFavorites((current) => {
      const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
      window.localStorage.setItem("imobiliarias:favorites", JSON.stringify(next));
      return next;
    });
  }

  function clearFilters() {
    setCity("");
    setCategory("");
    setBedrooms(0);
  }

  const filtered = useMemo(() => properties.filter((property) => {
    const samePurpose = property.purpose === purpose;
    const sameCity = !city || property.city.toLowerCase().includes(city.toLowerCase()) || property.neighborhood.toLowerCase().includes(city.toLowerCase());
    const sameCategory = !category || property.category === category;
    const enoughBedrooms = !bedrooms || property.bedrooms >= bedrooms;
    return samePurpose && sameCity && sameCategory && enoughBedrooms;
  }), [properties, purpose, city, category, bedrooms]);

  return (
    <>
      <section className="hero" id="inicio">
        <div className="container heroGrid">
          <div>
            <span className="eyebrow">SEU PRÓXIMO IMÓVEL COMEÇA AQUI</span>
            <h1>Encontre um lugar para chamar de seu.</h1>
            <p>Venda, locação, imóveis urbanos, rurais, residenciais e comerciais em uma busca simples e direta.</p>
            <div className="heroStats"><span><strong>{properties.length}</strong> imóveis demonstrativos</span><span><strong>{favorites.length}</strong> favoritos</span></div>
          </div>
          <div className="searchBox">
            <div className="searchTabs">
              <button className={purpose === "Venda" ? "active" : ""} onClick={() => setPurpose("Venda")}>Comprar</button>
              <button className={purpose === "Locação" ? "active" : ""} onClick={() => setPurpose("Locação")}>Alugar</button>
            </div>
            <label>Cidade ou bairro<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex.: Sengés" /></label>
            <div className="searchRow">
              <label>Tipo<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todos</option><option>Casa</option><option>Apartamento</option><option>Comercial</option><option>Rural</option></select></label>
              <label>Quartos<select value={bedrooms} onChange={(event) => setBedrooms(Number(event.target.value))}><option value="0">Qualquer</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select></label>
            </div>
            <div className="filterActions"><a className="button primary full" href="#imoveis">Ver resultados</a><button className="clearButton" onClick={clearFilters}>Limpar filtros</button></div>
          </div>
        </div>
      </section>

      <section className="container quickFilters">
        {["Casa", "Apartamento", "Rural", "Comercial"].map((item) => (
          <button key={item} className={`quickFilterButton ${category === item ? "selected" : ""}`} onClick={() => setCategory(category === item ? "" : item)}>{item === "Casa" ? "🏠" : item === "Apartamento" ? "🏢" : item === "Rural" ? "🌿" : "🏪"} {item}</button>
        ))}
      </section>

      <section className="container section" id="imoveis">
        <div className="sectionHeading"><div><span className="eyebrow">RESULTADOS</span><h2>Imóveis encontrados</h2></div><span className="resultCount">{filtered.length} {filtered.length === 1 ? "imóvel" : "imóveis"}</span></div>
        {filtered.length > 0 ? (
          <div className="propertyGrid">
            {filtered.map((property) => (
              <article className="propertyCard" key={property.code}>
                <div className="propertyImage" style={{ backgroundImage: `url(${property.images[0]})` }}>
                  <a className="imageLink" href={`imovel/${property.slug}/`} aria-label={`Abrir ${property.title}`} />
                  <span className="badge">{property.purpose}</span>
                  <button className={`favorite ${favorites.includes(property.code) ? "isFavorite" : ""}`} aria-label="Favoritar" onClick={() => toggleFavorite(property.code)}>{favorites.includes(property.code) ? "♥" : "♡"}</button>
                </div>
                <div className="propertyBody">
                  <span className="propertyCode">{property.code} · {property.category}</span>
                  <h3><a href={`imovel/${property.slug}/`}>{property.title}</a></h3>
                  <p className="location">📍 {property.neighborhood}, {property.city}</p>
                  <p className="meta">{property.bedrooms} quartos • {property.bathrooms} banheiros • {property.parking} vagas • {property.area}</p>
                  <div className="propertyFooter"><strong>{property.price}</strong><a href={`imovel/${property.slug}/`}>Ver detalhes →</a></div>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="emptyState"><strong>Nenhum imóvel encontrado.</strong><p>Tente limpar os filtros ou escolher outra finalidade.</p><button className="button primary" onClick={clearFilters}>Limpar filtros</button></div>}
      </section>
    </>
  );
}
