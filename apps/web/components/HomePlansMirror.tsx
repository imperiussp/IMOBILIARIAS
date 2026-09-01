"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PublicPlansCatalog from "./PublicPlansCatalog";

export default function HomePlansMirror() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById("planos"));
  }, []);

  if (!target) return null;

  return createPortal(
    <div className="homePlansMirror">
      <div className="homePlansMirrorHeading">
        <span>PLANOS</span>
        <h2>Escolha a estrutura certa para sua imobiliária.</h2>
        <p>Os recursos do plano e do comparativo usam a mesma estrutura. Valores permanecem a definir antes do lançamento.</p>
      </div>
      <PublicPlansCatalog />
    </div>,
    target,
  );
}
