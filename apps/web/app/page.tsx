import PropertyExplorer from "../components/PropertyExplorer";
import { properties } from "../lib/properties";

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <div className="container nav">
          <a className="brand" href="#inicio"><span className="brandMark">I</span><span>IMOBILIARIAS</span></a>
          <nav className="navLinks"><a href="#imoveis">Imóveis</a><a href="#como-funciona">Como funciona</a><a href="#contato">Contato</a><a href="admin/">Painel</a></nav>
          <div className="navActions"><a className="adminLink" href="admin/">Administrar</a><a className="button primary small" href="#contato">Falar com corretor</a></div>
          <details className="mobileMenu"><summary aria-label="Abrir menu">☰</summary><div><a href="#imoveis">Imóveis</a><a href="#como-funciona">Como funciona</a><a href="#contato">Contato</a><a href="admin/">Painel administrativo</a></div></details>
        </div>
      </header>

      <PropertyExplorer properties={properties} />

      <section className="softSection" id="como-funciona">
        <div className="container section">
          <div className="sectionHeading"><div><span className="eyebrow">SIMPLES E RÁPIDO</span><h2>Da busca ao contato em poucos passos</h2></div></div>
          <div className="steps">
            <article><span>01</span><h3>Busque</h3><p>Filtre por cidade, tipo, quartos e finalidade para encontrar opções compatíveis.</p></article>
            <article><span>02</span><h3>Conheça</h3><p>Abra o imóvel para ver fotos, características, área, preço e localização.</p></article>
            <article><span>03</span><h3>Converse</h3><p>Fale pelo WhatsApp com o corretor responsável já informando o código do imóvel.</p></article>
          </div>
        </div>
      </section>

      <section className="container section trustSection">
        <div><span className="eyebrow">GESTÃO INTEGRADA</span><h2>Um sistema para clientes, corretores e imobiliária.</h2></div>
        <div className="trustGrid"><article><strong>Catálogo centralizado</strong><p>Imóveis organizados em um único lugar, com status e responsável.</p></article><article><strong>Atendimento rápido</strong><p>O cliente chega ao corretor já informando o imóvel que deseja conhecer.</p></article><article><strong>Preparado para o app</strong><p>A mesma base será usada pelo aplicativo de cadastro e sincronização dos corretores.</p></article></div>
      </section>

      <section className="container section" id="contato">
        <div className="contactCard"><div><span className="eyebrow">ATENDIMENTO DIRETO</span><h2>Gostou de um imóvel? Abra os detalhes e fale com o corretor.</h2><p>Cada página individual já prepara uma mensagem de WhatsApp com o código do imóvel para facilitar o atendimento.</p></div><a className="button primary" href="#imoveis">Escolher imóvel</a></div>
      </section>

      <footer><div className="container footerInner"><div><strong>IMOBILIARIAS</strong><p>Seu imóvel, sua escolha, seu próximo passo.</p></div><div className="footerLinks"><a href="#imoveis">Imóveis</a><a href="admin/">Painel</a><span>Projeto em desenvolvimento</span></div></div></footer>
    </main>
  );
}
