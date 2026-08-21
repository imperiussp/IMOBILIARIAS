"use client";

import { useSiteSettings } from "../lib/useSiteSettings";

export default function PublicFooter() {
  const settings = useSiteSettings();
  return <footer><div className="container footerInner"><div><strong>{settings.agency_name}</strong><p>{settings.tagline}</p>{settings.company_creci ? <p>{settings.company_creci}</p> : null}</div><div className="footerLinks"><a href="#imoveis">Imóveis</a><a href="admin/">Painel</a>{settings.phone ? <a href={`tel:${settings.phone}`}>{settings.phone}</a> : null}{settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : null}{settings.address ? <span>{settings.address}</span> : null}</div></div></footer>;
}
