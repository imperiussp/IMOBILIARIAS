"use client";

import { useSiteSettings } from "../lib/useSiteSettings";

type Props = { nested?: boolean; propertyDetail?: boolean };

const propertyTypes = [
  "Apartamento", "Casa", "Casa de condomínio", "Terreno", "Chácara", "Sítio",
  "Ponto comercial", "Prédio comercial", "Galpão", "Salão comercial", "Fazenda",
];

function isDemoMarker(value: string | null | undefined) {
  return /lenoy\s*store|corretor\s*teste|\bteste\b/i.test(String(value || ""));
}
function formatCreci(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw || isDemoMarker(raw)) return "";
  const withoutPrefix = raw.replace(/^creci\s*:?[\s-]*/i, "").trim();
  return withoutPrefix ? `CRECI ${withoutPrefix}` : "";
}

export default function PublicHeader({ nested = false, propertyDetail = false }: Props) {
  const settings = useSiteSettings();
  const prefix = nested ? "../" : "";
  const whatsapp = settings.whatsapp?.replace(/\D/g, "");
  const searchHref = (type: string) => `${prefix}?tipo=${encodeURIComponent(type)}#imoveis`;
  const creci = formatCreci(settings.company_creci);
  const agencyName = String(settings.agency_name || "Imobiliária").trim() || "Imobiliária";
  const headerClass = `topbar publicTopbar${propertyDetail ? " propertyPublicTopbar" : ""}`;
  const logoUrl = isDemoMarker(settings.company_creci) ? null : settings.logo_url;

  return <header className={headerClass}><div className="container nav">
    <a className="brand" href={`${prefix}#inicio`}>
      {logoUrl ? <img className="brandLogo" src={logoUrl} alt={agencyName} /> : <span className="brandMark">{agencyName.slice(0,1).toUpperCase()}</span>}
      <span className="publicBrandText"><strong>{agencyName}</strong>{creci ? <small>{creci}</small> : null}</span>
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
