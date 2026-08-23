"use client";

import { useSiteSettings } from "../lib/useSiteSettings";

export default function PublicFooter() {
  const settings = useSiteSettings();
  const whatsapp = settings.whatsapp?.replace(/\D/g, "");
  return <footer className="tenantFooter"><div className="container tenantFooterGrid"><div className="tenantFooterBrand"><span className="eyebrow">IMOBILIÁRIA</span><strong>{settings.agency_name}</strong><p>{settings.tagline}</p>{settings.company_creci ? <small>{settings.company_creci}</small> : null}</div><div><span className="tenantFooterTitle">Navegação</span><div className="tenantFooterLinks"><a href="#imoveis">Imóveis</a><a href="#como-funciona">Como funciona</a><a href="#anuncie">Anuncie seu imóvel</a><a href="#contato">Contato</a></div></div><div><span className="tenantFooterTitle">Atendimento</span><div className="tenantFooterLinks">{whatsapp ? <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}{settings.phone ? <a href={`tel:${settings.phone}`}>{settings.phone}</a> : null}{settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : null}{settings.address ? <span>{settings.address}</span> : null}</div></div><div className="tenantFooterPlatform"><span className="tenantFooterTitle">Tecnologia</span><strong>LENOY IMOBILIÁRIAS</strong><p>Site, catálogo, CRM e gestão integrados para uma experiência imobiliária moderna.</p><a href="admin/">Acessar painel →</a></div></div><div className="container tenantFooterBottom"><span>© {new Date().getFullYear()} {settings.agency_name}</span><span>Operado com tecnologia LENOY IMOBILIÁRIAS</span></div></footer>;
}
