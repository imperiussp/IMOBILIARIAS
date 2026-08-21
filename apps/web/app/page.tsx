import GeneralContactForm from "../components/GeneralContactForm";
import PropertyExplorer from "../components/PropertyExplorer";
import PublicFooter from "../components/PublicFooter";
import PublicHeader from "../components/PublicHeader";
import { properties } from "../lib/properties";

export default function HomePage() {
  return (
    <main>
      <PublicHeader />

      <PropertyExplorer properties={properties} />

      <section className="softSection" id="como-funciona">
        <div className="container section">
          <div className="sectionHeading"><div><span className="eyebrow">SIMPLES E RÁPIDO</span><h2>Da busca ao contato em poucos passos</h2></div></div>
          <div className="steps">
            <article><span>01</span><h3>Busque</h3><p>Filtre por cidade, tipo, quartos, preço, área e finalidade para encontrar opções compatíveis.</p></article>
            <article><span>02</span><h3>Conheça</h3><p>Abra o imóvel para ver fotos, características, área, preço e localização.</p></article>
            <article><span>03</span><h3>Converse</h3><p>Fale pelo WhatsApp com o corretor responsável já informando o código do imóvel.</p></article>
          </div>
        </div>
      </section>

      <section className="container section trustSection">
        <div><span className="eyebrow">GESTÃO INTEGRADA</span><h2>Um sistema para clientes, corretores e imobiliária.</h2></div>
        <div className="trustGrid"><article><strong>Catálogo centralizado</strong><p>Imóveis organizados em um único lugar, com status e responsável.</p></article><article><strong>Atendimento rápido</strong><p>O cliente chega ao corretor já informando o imóvel que deseja conhecer.</p></article><article><strong>Aplicativo integrado</strong><p>A mesma base é usada pelo aplicativo de cadastro, fotos e sincronização dos corretores.</p></article></div>
      </section>

      <section className="container section" id="contato">
        <div className="sectionHeading"><div><span className="eyebrow">ATENDIMENTO</span><h2>Fale com a imobiliária</h2><p className="sectionIntro">Envie uma mensagem geral ou escolha um imóvel para falar diretamente com o corretor responsável.</p></div><a className="button secondary" href="#imoveis">Escolher imóvel</a></div>
        <GeneralContactForm />
      </section>

      <PublicFooter />
    </main>
  );
}
