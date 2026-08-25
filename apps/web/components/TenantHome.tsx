import GeneralContactForm from "./GeneralContactForm";
import OwnerPropertyForm from "./OwnerPropertyForm";
import PropertyExplorer from "./PropertyExplorer";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";
import TenantThemeShell from "./TenantThemeShell";
import { properties } from "../lib/properties";

export default function TenantHome() {
  return (
    <TenantThemeShell>
      <main>
        <PublicHeader />
        <PropertyExplorer properties={properties} />

        <section className="tenantProofStrip" aria-label="Diferenciais da imobiliária">
          <div className="container tenantProofGrid">
            <article><strong>Atendimento direto</strong><span>Contato rápido com o corretor responsável.</span></article>
            <article><strong>Catálogo atualizado</strong><span>Imóveis organizados por disponibilidade e finalidade.</span></article>
            <article><strong>Busca inteligente</strong><span>Filtros para chegar mais rápido às melhores opções.</span></article>
            <article><strong>Experiência integrada</strong><span>Site, equipe e gestão conectados na mesma plataforma.</span></article>
          </div>
        </section>

        <section className="softSection" id="como-funciona">
          <div className="container section">
            <div className="sectionHeading"><div><span className="eyebrow">SIMPLES E RÁPIDO</span><h2>Da busca ao contato em poucos passos</h2><p className="sectionIntro">Uma jornada clara para encontrar, comparar e conversar sobre o imóvel certo.</p></div></div>
            <div className="steps premiumSteps">
              <article><span>01</span><h3>Busque</h3><p>Filtre por cidade, tipo, quartos, preço, área e finalidade para encontrar opções compatíveis.</p></article>
              <article><span>02</span><h3>Conheça</h3><p>Abra o imóvel para ver fotos, características, área, preço e localização.</p></article>
              <article><span>03</span><h3>Converse</h3><p>Fale pelo WhatsApp com o corretor responsável já informando o código do imóvel.</p></article>
            </div>
          </div>
        </section>

        <section className="container section trustSection tenantTrustV4">
          <div className="tenantTrustIntro"><span className="eyebrow">ATENDIMENTO E TECNOLOGIA</span><h2>Mais segurança para escolher. Mais agilidade para negociar.</h2><p>O cliente encontra o imóvel com facilidade e a equipe recebe a oportunidade já contextualizada.</p></div>
          <div className="trustGrid tenantTrustGrid"><article><span className="tenantTrustIcon">⌂</span><strong>Catálogo centralizado</strong><p>Imóveis organizados em um único lugar, com status, responsável e informações consistentes.</p></article><article><span className="tenantTrustIcon">◎</span><strong>Atendimento rápido</strong><p>O cliente chega ao corretor já informando o imóvel que deseja conhecer.</p></article><article><span className="tenantTrustIcon">↗</span><strong>Aplicativo integrado</strong><p>A mesma base é usada pelo aplicativo de cadastro, fotos e sincronização dos corretores.</p></article></div>
        </section>

        <section className="tenantCtaBand">
          <div className="container tenantCtaBandInner"><div><span className="eyebrow">ENCONTROU ALGO INTERESSANTE?</span><h2>Converse com a equipe e organize sua próxima visita.</h2><p>Use o catálogo para escolher um imóvel ou fale diretamente com a imobiliária.</p></div><div className="tenantCtaActions"><a className="button primary" href="#imoveis">Ver imóveis</a><a className="button secondary" href="#contato">Falar com a imobiliária</a></div></div>
        </section>

        <section className="softSection" id="anuncie"><div className="container section"><OwnerPropertyForm /></div></section>

        <section className="container section" id="contato">
          <div className="sectionHeading"><div><span className="eyebrow">ATENDIMENTO</span><h2>Fale com a imobiliária</h2><p className="sectionIntro">Envie uma mensagem geral ou escolha um imóvel para falar diretamente com o corretor responsável.</p></div><a className="button secondary" href="#imoveis">Escolher imóvel</a></div>
          <GeneralContactForm />
        </section>

        <PublicFooter />
      </main>
    </TenantThemeShell>
  );
}
