"use client";

import { useEffect, useState } from "react";

const sections = [
  ["Visão geral", "#visao-geral"],
  ["Imóveis", "#imoveis"],
  ["Acompanhamentos", "#acompanhamentos"],
  ["Novo imóvel", "#novo-imovel"],
  ["Tipos", "#catalogo-config"],
  ["Meu plano", "#meu-plano"],
  ["Documentos", "#documentos"],
  ["E-mails profissionais", "#emails-profissionais"],
  ["Alertas operacionais", "#alertas-operacionais"],
  ["Funil comercial", "#funil-comercial"],
  ["Tempo de resposta", "#tempo-resposta"],
  ["Agenda de visitas", "#agenda-visitas"],
  ["Perfil de compra", "#perfil-compra"],
  ["Permissões e consentimentos", "#consentimento-compradores"],
  ["Oportunidades automáticas", "#oportunidades-ia"],
  ["Entregas automáticas", "#entregas-oportunidades"],
  ["Respostas IA", "#respostas-oportunidades"],
  ["Classificação de contatos", "#qualificacao-contatos"],
  ["Histórico dos contatos", "#historico-contato"],
  ["Checklist documental", "#documentacao-imovel"],
  ["Desempenho dos imóveis", "#desempenho-imoveis"],
  ["Qualidade dos anúncios", "#qualidade-imoveis"],
  ["Uso de documentos", "#uso-documentos"],
  ["Desempenho dos corretores", "#desempenho-corretores"],
  ["Metas dos corretores", "#metas-corretores"],
  ["Corretores", "#corretores"],
  ["Usuários e permissões", "#usuarios"],
  ["Convites de acesso", "#convites"],
  ["Documentos enviados", "#arquivos-documentos"],
  ["Personalizar", "#configuracoes"],
  ["Domínios", "#dominios"],
  ["Exportações e cópia", "#exportacoes"],
] as const;

export default function AdminMobileMenu() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(window.location.pathname.includes("/admin"));
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!isAdmin) return null;
  return <>
    <button className="adminHamburger" type="button" aria-label="Abrir menu do painel" aria-expanded={open} onClick={() => setOpen(true)}>
      <span></span><span></span><span></span>
    </button>
    {open ? <div className="adminMobileMenuLayer" role="dialog" aria-modal="true" aria-label="Menu do painel">
      <button className="adminMobileMenuBackdrop" type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} />
      <aside className="adminMobileDrawer">
        <div className="adminMobileDrawerHead"><div><small>PAINEL</small><strong>Gestão da imobiliária</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button></div>
        <nav>{sections.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}</nav>
      </aside>
    </div> : null}
  </>;
}
