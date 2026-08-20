"use client";

import { useMemo, useState } from "react";
import type { Property } from "../lib/properties";

type Props = { properties: Property[] };

export default function PropertyExplorer({ properties }: Props) {
  const [purpose, setPurpose] = useState<"Venda" | "Locação">("Venda");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => properties.filter((property) => {
    const samePurpose = property.purpose === purpose;
    const sameCity = !city || property.city.toLowerCase().includes(city.toLowerCase()) || property.neighborhood.toLowerCase().includes(city.toLowerCase());
    const sameCategory = !category || property.category === category;
    return samePurpose && sameCity && sameCategory;
  }), [properties, purpose, city, category]);

  return (
    <>
      <section className="hero" id="inicio">
        <div className="container heroGrid">
          <div>
            <span className="eyebrow">SEU PRÓXIMO IMÓVEL COMEÇA AQUI</span>
            <h1>Encontre um lugar para chamar de seu.</h1>
            <p>Venda, locação, imóveis urbanos, rurais, residenciais e comerciais em uma busca simples e direta.</p>
          </div>
          <div className="searchBox">
            <div className="searchTabs">
              <button className={purpose === "Venda" ? "active" : ""} onClick={() => setPurpose("Venda")}>Comprar</button>
              <button className={purpose === "Locação" ? "active" : ""} onClick={() => setPurpose("Locação")}>Alugar</button>
            </div>
            <label>Cidade ou bairro<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex.: Sengés" /></label>
            <div className="searchRow">
              <label>Tipo<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todos</option><option>Casa</option><option>Apartamento</option><option>Comercial</option><option>Rural</option></select></label>
              <label>Finalidade<input value={purpose} readOnly /></label>
            </div>
            <a className="button primary full" href="#imoveis">Ver resultados</a>
          </div>
        </div>
      </section>

      <section className="container quickFilters">
        {["Casa", "Apartamento", "Rural", "Comercial"].map((item) => (
          <button key={item} className="quickFilterButton" onClick={() => setCategory(category === item ? "" : item)}>{item === "Casa" ? "🏠" : item === "Apartamento" ? "🏢" : item === "Rural" ? "🌿" : "🏪"} {item}</button>
        ))}
      </section>

      <section className="container section" id="imoveis">
        <div className="sectionHeading"><div><span className="eyebrow">RESULTADOS</span><h2>Imóveis encontrados</h2></div><span className="resultCount">{filtered.length} {filtered.length === 1 ? "imóvel" : "imóveis"}</span></div>
        {filtered.length > 0 ? (
          <div className="propertyGrid">
            {filtered.map((property) => (
              <article className="propertyCard" key={property.code}>
                <a className="propertyImage" href={`imovel/${property.slug}/`} style={{ backgroundImage: `url(${property.images[0]})` }}><span className="badge">{property.purpose}</span><span className="favorite" aria-label="Favoritar">♡</span></a>
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
        ) : <div className="emptyState"><strong>Nenhum imóvel encontrado.</strong><p>Tente limpar a cidade/bairro ou escolher outro tipo de imóvel.</p></div>}
      </section>
    </>
  );
}
