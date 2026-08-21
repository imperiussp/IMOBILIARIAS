"use client";

import { useSiteSettings } from "../lib/useSiteSettings";

type Props = { nested?: boolean };

export default function PublicHeader({ nested = false }: Props) {
  const settings = useSiteSettings();
  const prefix = nested ? "../" : "";
  const whatsapp = settings.whatsapp?.replace(/\D/g, "");
  return <header className="topbar"><div className="container nav">
    <a className="brand" href={`${prefix}#inicio`}>{settings.logo_url ? <img className="brandLogo" src={settings.logo_url} alt={settings.agency_name} /> : <span className="brandMark">{settings.agency_name.slice(0,1).toUpperCase()}</span>}<span>{settings.agency_name}</span></a>
    <nav className="navLinks"><a href={`${prefix}#imoveis`}>Imóveis</a><a href={`${prefix}#anuncie`}>Anuncie seu imóvel</a><a href={`${prefix}#como-funciona`}>Como funciona</a><a href={`${prefix}#contato`}>Contato</a><a href={`${prefix}admin/`}>Painel</a></nav>
    <div className="navActions"><a className="adminLink" href={`${prefix}admin/`}>Administrar</a>{whatsapp ? <a className="button primary small" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Falar com a imobiliária</a> : <a className="button primary small" href={`${prefix}#contato`}>Falar com corretor</a>}</div>
    <details className="mobileMenu"><summary aria-label="Abrir menu">☰</summary><div><a href={`${prefix}#imoveis`}>Imóveis</a><a href={`${prefix}#anuncie`}>Anuncie seu imóvel</a><a href={`${prefix}#como-funciona`}>Como funciona</a><a href={`${prefix}#contato`}>Contato</a><a href={`${prefix}admin/`}>Painel administrativo</a></div></details>
  </div></header>;
}
