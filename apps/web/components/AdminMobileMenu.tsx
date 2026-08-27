"use client";

import { useEffect, useState } from "react";

const sections = [
  ["Acompanhamentos", "#acompanhamentos"],
  ["Agenda de visitas", "#agenda-visitas"],
  ["Alertas operacionais", "#alertas-operacionais"],
  ["Checklist documental", "#documentacao-imovel"],
  ["Classificação de contatos", "#qualificacao-contatos"],
  ["Contatos", "#contatos-salvos"],
  ["Contatos recebidos", "#contatos"],
  ["Convites de acesso", "#convites"],
  ["Corretores", "#corretores"],
  ["Desempenho dos corretores", "#desempenho-corretores"],
  ["Desempenho dos imóveis", "#desempenho-imoveis"],
  ["Destaques e selos", "#destaques-selos"],
  ["Documentos", "#documentos"],
  ["Documentos enviados", "#arquivos-documentos"],
  ["Domínios", "#dominios"],
  ["E-mails profissionais", "#emails-profissionais"],
  ["Entregas automáticas", "#entregas-oportunidades"],
  ["Exportações e cópia", "#exportacoes"],
  ["Funil comercial", "#funil-comercial"],
  ["Histórico dos contatos", "#historico-contato"],
  ["Imóveis", "#imoveis"],
  ["Metas dos corretores", "#metas-corretores"],
  ["Meu plano", "#meu-plano"],
  ["Novo imóvel", "#novo-imovel"],
  ["Oportunidades automáticas", "#oportunidades-ia"],
  ["Perfil de compra", "#perfil-compra"],
  ["Permissões e consentimentos", "#consentimento-compradores"],
  ["Personalizar", "#configuracoes"],
  ["Qualidade dos anúncios", "#qualidade-imoveis"],
  ["Respostas IA", "#respostas-oportunidades"],
  ["Tempo de resposta", "#tempo-resposta"],
  ["Tipos", "#catalogo-config"],
  ["Uso de documentos", "#uso-documentos"],
  ["Usuários e permissões", "#usuarios"],
  ["Visão geral", "#visao-geral"],
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
    {!open ? <button className="adminHamburger" type="button" aria-label="Abrir menu do painel" aria-expanded={false} onClick={() => setOpen(true)}>
      <span></span><span></span><span></span>
    </button> : null}
    {open ? <div className="adminMobileMenuLayer" role="dialog" aria-modal="true" aria-label="Menu do painel">
      <button className="adminMobileMenuBackdrop" type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} />
      <aside className="adminMobileDrawer">
        <div className="adminMobileDrawerHead"><div><small>PAINEL</small><strong>Gestão da imobiliária</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button></div>
        <nav>{sections.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}</nav>
      </aside>
    </div> : null}
  </>;
}
