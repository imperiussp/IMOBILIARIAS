import { properties } from "../lib/properties";

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <div className="container nav">
          <a className="brand" href="#inicio"><span className="brandMark">I</span><span>IMOBILIARIAS</span></a>
          <nav className="navLinks"><a href="#imoveis">Imóveis</a><a href="#como-funciona">Como funciona</a><a href="#contato">Contato</a></nav>
          <a className="button primary small" href="#contato">Falar com corretor</a>
        </div>
      </header>

      <section className="hero" id="inicio">
        <div className="container heroGrid">
          <div>
            <span className="eyebrow">SEU PRÓXIMO IMÓVEL COMEÇA AQUI</span>
            <h1>Encontre um lugar para chamar de seu.</h1>
            <p>Venda, locação, imóveis urbanos, rurais, residenciais e comerciais em uma busca simples e direta.</p>
          </div>
          <div className="searchBox">
            <div className="searchTabs"><button className="active">Comprar</button><button>Alugar</button></div>
            <label>Cidade<input placeholder="Ex.: Sengés" /></label>
            <div className="searchRow"><label>Tipo<select defaultValue=""><option value="">Todos</option><option>Casa</option><option>Apartamento</option><option>Comercial</option><option>Rural</option></select></label><label>Faixa de preço<select defaultValue=""><option value="">Qualquer valor</option><option>Até R$ 300 mil</option><option>R$ 300 a 600 mil</option><option>Acima de R$ 600 mil</option></select></label></div>
            <a className="button primary full" href="#imoveis">Buscar imóveis</a>
          </div>
        </div>
      </section>

      <section className="container quickFilters">
        <a href="#imoveis">🏠 Casas</a><a href="#imoveis">🏢 Apartamentos</a><a href="#imoveis">🌿 Imóveis rurais</a><a href="#imoveis">🏪 Comerciais</a>
      </section>

      <section className="container section" id="imoveis">
        <div className="sectionHeading"><div><span className="eyebrow">DESTAQUES</span><h2>Imóveis selecionados</h2></div><span className="resultCount">{properties.length} imóveis demonstrativos</span></div>
        <div className="propertyGrid">
          {properties.map((property) => (
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
      </section>

      <section className="softSection" id="como-funciona"><div className="container section"><div className="sectionHeading"><div><span className="eyebrow">SIMPLES E RÁPIDO</span><h2>Da busca ao contato em poucos passos</h2></div></div><div className="steps"><article><span>01</span><h3>Busque</h3><p>Filtre por cidade, tipo, finalidade, preço e características.</p></article><article><span>02</span><h3>Conheça</h3><p>Veja fotos, informações completas e os detalhes do imóvel.</p></article><article><span>03</span><h3>Converse</h3><p>Fale diretamente pelo WhatsApp com o corretor responsável.</p></article></div></div></section>

      <section className="container section" id="contato"><div className="contactCard"><div><span className="eyebrow">ATENDIMENTO DIRETO</span><h2>Gostou de um imóvel? Abra os detalhes e fale com o corretor.</h2><p>Cada página individual já prepara uma mensagem de WhatsApp com o código do imóvel para facilitar o atendimento.</p></div><a className="button primary" href="#imoveis">Escolher imóvel</a></div></section>

      <footer><div className="container footerInner"><div><strong>IMOBILIARIAS</strong><p>Seu imóvel, sua escolha, seu próximo passo.</p></div><span>Projeto em desenvolvimento</span></div></footer>
    </main>
  );
}
