"use client";

import { useEffect, useRef, useState } from "react";

const items = [
  { href: "#resumo-comercial", icon: "▦", title: "Resumo", text: "Números principais" },
  { href: "#clientes-comerciais", icon: "👥", title: "Clientes", text: "Cadastros e acesso" },
  { href: "#assinaturas-plataforma", icon: "◫", title: "Assinaturas", text: "Planos e descontos" },
  { href: "#planos-plataforma", icon: "R$", title: "Planos", text: "Preços e recursos" },
  { href: "#cobranca-plataforma", icon: "✓", title: "Pagamentos", text: "Histórico financeiro" },
  { href: "./tecnico/", icon: "⚙", title: "Área técnica", text: "Manutenção e segurança" },
  { href: "../admin/", icon: "⌂", title: "Painel imobiliária", text: "Abrir painel operacional" },
  { href: "../", icon: "↗", title: "Ver plataforma", text: "Abrir página pública" },
];

export default function PlatformCommercialMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return <div className="commercialMenuRoot" ref={rootRef}>
    <button className="commercialMenuButton" type="button" aria-expanded={open} aria-controls="commercial-menu-grid" onClick={() => setOpen((value) => !value)}>
      <span className="commercialHamburger" aria-hidden="true"><i></i><i></i><i></i></span>
      <span>Menu</span>
    </button>
    {open ? <div className="commercialMenuPanel" id="commercial-menu-grid">
      <div className="commercialMenuGrid">
        {items.map((item) => <a key={item.href} className="commercialMenuCard" href={item.href} onClick={() => setOpen(false)}>
          <span className="commercialMenuIcon" aria-hidden="true">{item.icon}</span>
          <strong>{item.title}</strong>
          <small>{item.text}</small>
        </a>)}
      </div>
    </div> : null}
  </div>;
}
