import { notFound } from "next/navigation";
import { getPropertyBySlug, properties } from "../../../lib/properties";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return properties.map((property) => ({ slug: property.slug }));
}

export default async function PropertyPage({ params }: PageProps) {
  const { slug } = await params;
  const property = getPropertyBySlug(slug);
  if (!property) notFound();

  const message = encodeURIComponent(`Olá, gostaria de informações sobre o imóvel ${property.code} - ${property.title}.`);
  const whatsappUrl = `https://wa.me/${property.broker.whatsapp}?text=${message}`;

  return (
    <main>
      <header className="topbar">
        <div className="container nav">
          <a className="brand" href="../../"><span className="brandMark">I</span><span>IMOBILIARIAS</span></a>
          <nav className="navLinks"><a href="../../#imoveis">Imóveis</a><a href="../../#como-funciona">Como funciona</a><a href="../../#contato">Contato</a></nav>
          <a className="button primary small" href={whatsappUrl} target="_blank" rel="noreferrer">Falar com corretor</a>
        </div>
      </header>

      <section className="container propertyDetail">
        <a className="backLink" href="../../#imoveis">← Voltar aos imóveis</a>
        <div className="detailHeader">
          <div>
            <span className="eyebrow">{property.code} · {property.purpose}</span>
            <h1>{property.title}</h1>
            <p className="location">📍 {property.neighborhood}, {property.city}</p>
          </div>
          <strong className="detailPrice">{property.price}</strong>
        </div>

        <div className="gallery">
          <div className="galleryMain" style={{ backgroundImage: `url(${property.images[0]})` }} />
          <div className="gallerySide">
            {property.images.slice(1).map((image) => <div key={image} className="galleryThumb" style={{ backgroundImage: `url(${image})` }} />)}
          </div>
        </div>

        <div className="detailGrid">
          <section>
            <div className="facts">
              <span><strong>{property.bedrooms}</strong> quartos</span>
              <span><strong>{property.bathrooms}</strong> banheiros</span>
              <span><strong>{property.parking}</strong> vagas</span>
              <span><strong>{property.area}</strong> área</span>
            </div>

            <div className="detailSection">
              <h2>Sobre o imóvel</h2>
              <p>{property.description}</p>
            </div>

            <div className="detailSection">
              <h2>Características</h2>
              <div className="featureList">{property.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div>
            </div>
          </section>

          <aside className="brokerCard">
            <span className="eyebrow">CORRETOR RESPONSÁVEL</span>
            <h3>{property.broker.name}</h3>
            <p>{property.broker.creci}</p>
            <p>Ao chamar pelo WhatsApp, o código do imóvel já vai na mensagem.</p>
            <a className="button whatsapp full" href={whatsappUrl} target="_blank" rel="noreferrer">Conversar no WhatsApp</a>
          </aside>
        </div>
      </section>
    </main>
  );
}
