const properties = [
  { code: "IM-101", title: "Casa com jardim e suíte", city: "Sengés - PR", type: "Venda", price: "R$ 485.000", meta: "3 quartos • 2 banheiros • 2 vagas", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80" },
  { code: "IM-102", title: "Apartamento central com varanda", city: "Itararé - SP", type: "Locação", price: "R$ 1.850/mês", meta: "2 quartos • 1 suíte • 1 vaga", image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80" },
  { code: "IM-103", title: "Chácara com ampla área verde", city: "Sengés - PR", type: "Venda", price: "R$ 690.000", meta: "4 quartos • rural • 5.000 m²", image: "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=1200&q=80" },
];

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
        <div className="sectionHeading"><div><span className="eyebrow">DESTAQUES</span><h2>Imóveis selecionados</h2></div><a className="textLink" href="#imoveis">Ver todos →</a></div>
        <div className="propertyGrid">
          {properties.map((property) => (
            <article className="propertyCard" key={property.code}>
              <div className="propertyImage" style={{ backgroundImage: `url(${property.image})` }}><span className="badge">{property.type}</span><button className="favorite" aria-label="Favoritar">♡</button></div>
              <div className="propertyBody"><span className="propertyCode">{property.code}</span><h3>{property.title}</h3><p className="location">📍 {property.city}</p><p className="meta">{property.meta}</p><div className="propertyFooter"><strong>{property.price}</strong><a href="#contato">Detalhes →</a></div></div>
            </article>
          ))}
        </div>
      </section>

      <section className="softSection" id="como-funciona"><div className="container section"><div className="sectionHeading"><div><span className="eyebrow">SIMPLES E RÁPIDO</span><h2>Da busca ao contato em poucos passos</h2></div></div><div className="steps"><article><span>01</span><h3>Busque</h3><p>Filtre por cidade, tipo, finalidade, preço e características.</p></article><article><span>02</span><h3>Conheça</h3><p>Veja fotos, informações completas e os detalhes do imóvel.</p></article><article><span>03</span><h3>Converse</h3><p>Fale diretamente pelo WhatsApp com o corretor responsável.</p></article></div></div></section>

      <section className="container section" id="contato"><div className="contactCard"><div><span className="eyebrow">ATENDIMENTO DIRETO</span><h2>Gostou de um imóvel? Fale com o corretor.</h2><p>O sistema identificará o profissional responsável por cada imóvel e abrirá uma conversa já com o código da propriedade.</p></div><a className="button whatsapp" href="#">WhatsApp do corretor</a></div></section>

      <footer><div className="container footerInner"><div><strong>IMOBILIARIAS</strong><p>Seu imóvel, sua escolha, seu próximo passo.</p></div><span>Projeto em desenvolvimento</span></div></footer>
    </main>
  );
}
