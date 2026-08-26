"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PropertyMarketingLabels from "./PropertyMarketingLabels";

export default function AdminHighlightsPanelMount() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!window.location.pathname.includes("/admin")) return;
    let observer: MutationObserver | null = null;

    const attach = () => {
      const content = document.querySelector<HTMLElement>(".adminPage .adminContent");
      if (!content) return false;
      let node = document.getElementById("admin-highlights-portal");
      if (!node) {
        node = document.createElement("div");
        node.id = "admin-highlights-portal";
        content.appendChild(node);
      }
      setHost(node);
      return true;
    };

    if (!attach()) {
      observer = new MutationObserver(() => { if (attach()) observer?.disconnect(); });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => observer?.disconnect();
  }, []);

  if (!host) return null;
  return createPortal(
    <section className="adminPanel adminHighlightsPanel" id="destaques-selos">
      <div className="adminPanelHeader">
        <div><span className="eyebrow">VITRINE DO SITE</span><h2>Destaques e selos</h2><p>Escolha os imóveis que ganham uma área própria de destaque no site e defina selos como Lançamento, Promoção, Oferta e Oportunidade.</p></div>
      </div>
      <PropertyMarketingLabels />
    </section>,
    host,
  );
}
