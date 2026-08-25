"use client";

import { useEffect, useState } from "react";

const sections = [
  ["Visão geral", "#visao-geral"], ["Alertas operacionais", "#alertas-operacionais"], ["Funil comercial", "#funil-comercial"],
  ["Tempo de resposta", "#tempo-resposta"], ["Agenda de visitas", "#agenda-visitas"], ["Perfil de compra", "#perfil-compra"],
  ["Consentimentos", "#consentimento-compradores"], ["Oportunidades IA", "#oportunidades-ia"], ["Entregas IA", "#entregas-oportunidades"],
  ["Respostas IA", "#respostas-oportunidades"], ["Imóveis", "#imoveis"], ["Desempenho dos imóveis", "#desempenho-imoveis"],
  ["Ciclo dos imóveis", "#ciclo-imoveis"], ["Histórico de preços", "#historico-precos"], ["Documentação dos imóveis", "#documentacao-imovel"],
  ["Qualidade dos anúncios", "#qualidade-imoveis"], ["Novo imóvel", "#novo-imovel"], ["Descrição com IA", "#descricao-ia"],
  ["Localidades", "#localidades"], ["Tipos e recursos", "#catalogo-config"], ["Corretores", "#corretores"],
  ["Desempenho dos corretores", "#desempenho-corretores"], ["Metas dos corretores", "#metas-corretores"], ["Usuários", "#usuarios"],
  ["Convites", "#convites"], ["Contatos", "#contatos"], ["Classificação", "#qualificacao-contatos"],
  ["Acompanhamentos", "#acompanhamentos"], ["Histórico do contato", "#historico-contato"], ["Documentos", "#documentos"],
  ["Anexos", "#arquivos-documentos"], ["Arquivos", "#arquivos"], ["Meu plano", "#meu-plano"],
  ["Pagamento", "#pagamento-infinitepay"], ["Imobiliária", "#configuracoes"], ["Domínios", "#dominios"],
  ["Histórico", "#historico"], ["Exportações", "#exportacoes"],
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
