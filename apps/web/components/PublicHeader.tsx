"use client";

import { useSiteSettings } from "../lib/useSiteSettings";

type Props = { nested?: boolean };

const propertyTypes = [
  "Apartamento", "Casa", "Casa de condomínio", "Terreno", "Chácara", "Sítio",
  "Ponto comercial", "Prédio comercial", "Galpão", "Salão comercial", "Fazenda",
];

export default function PublicHeader({ nested = false }: Props) {
  const settings = useSiteSettings();
  const prefix = nested ? "../" : "";
  const whatsapp = settings.whatsapp?.replace(/\D/g, "");
  const searchHref = (type: string) => `${prefix}?tipo=${encodeURIComponent(type)}#imoveis`;

  return <header className="topbar publicTopbar"><div className="container nav">
    <a className="brand" href={`${prefix}#inicio`}>
      {settings.logo_url ? <img className="brandLogo" src={settings.logo_url} alt={settings.agency_name} /> : <span className="brandMark">{settings.agency_name.slice(0,1).toUpperCase()}</span>}
      <span className="publicBrandText"><strong>{settings.agency_name}</strong>{settings.company_creci ? <small>{settings.company_creci}</small> : null}</span>
    </a>
    <nav className="navLinks"><a href={`${prefix}#imoveis`}>Imóveis</a><a href={`${prefix}#anuncie`}>Anuncie seu imóvel</a><a href={`${prefix}#contato`}>Contato</a></nav>
    <div className="navActions">{whatsapp ? <a className="button primary small" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a> : <a className="button primary small" href={`${prefix}#contato`}>Contato</a>}</div>
    <details className="mobileMenu publicMobileMenu"><summary aria-label="Abrir menu">☰</summary><div className="publicMobileMenuPanel">
      <strong>Buscar imóveis</strong>
      <div className="publicMobileTypeGrid">{propertyTypes.map((type) => <a key={type} href={searchHref(type)}>{type}</a>)}</div>
      <div className="publicMobileMenuDivider" />
      <a href={`${prefix}#contato`}>Contato</a>
      {settings.phone ? <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}>Telefone: {settings.phone}</a> : null}
      {whatsapp ? <a className="publicWhatsappLink" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}
      <div className="publicSocialLinks">
        {settings.instagram_url ? <a href={settings.instagram_url} target="_blank" rel="noreferrer">Instagram</a> : null}
        {settings.facebook_url ? <a href={settings.facebook_url} target="_blank" rel="noreferrer">Facebook</a> : null}
        {settings.youtube_url ? <a href={settings.youtube_url} target="_blank" rel="noreferrer">YouTube</a> : null}
      </div>
    </div></details>
  </div></header>;
}
