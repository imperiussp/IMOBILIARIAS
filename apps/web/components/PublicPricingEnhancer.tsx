"use client";

import { useEffect } from "react";

const commercialPlans = [
  { name: "Inicial", monthly: "39,90", annual: "359,10", implementation: "99,00", featured: false, items: ["Até 100 imóveis", "1 usuário", "Site + CRM + aplicativo"] },
  { name: "Profissional", monthly: "59,90", annual: "539,10", implementation: "149,00", featured: true, items: ["Até 500 imóveis", "Até 3 usuários", "Gestão comercial ampliada"] },
  { name: "Imobiliária", monthly: "79,90", annual: "719,10", implementation: "199,00", featured: false, items: ["Até 1.500 imóveis", "Até 7 usuários", "IA de oportunidades + documentos"] },
  { name: "Premium", monthly: "110,00", annual: "990,00", implementation: "249,00", featured: false, items: ["Até 5.000 imóveis", "Até 15 usuários", "Domínio próprio + automações"] },
];

export default function PublicPricingEnhancer() {
  useEffect(() => {
    const section = document.getElementById("planos");
    if (!section || section.dataset.commercialPricingApplied === "1") return;
    const grid = section.querySelector<HTMLElement>(".plansGrid");
    if (!grid) return;

    section.dataset.commercialPricingApplied = "1";
    section.classList.add("publicCommercialPricing");
    const heading = section.querySelector("h2");
    if (heading) heading.textContent = "Planos para começar pequeno e crescer com a sua operação.";

    grid.innerHTML = commercialPlans.map((plan) => `
      <article class="planCard ${plan.featured ? "featured" : ""}">
        ${plan.featured ? '<span class="commercialPlanBadge">MAIS ESCOLHIDO</span>' : '<span class="planTag">PLANO</span>'}
        <h3>${plan.name}</h3>
        <div class="commercialMonthlyPrice"><strong>R$ ${plan.monthly}</strong><span>/mês</span></div>
        <div class="commercialBillingBox monthly">
          <small>MENSAL</small>
          <b>R$ ${plan.monthly}/mês</b>
          <span>Implantação: <strong>R$ ${plan.implementation}</strong> · pagamento único</span>
          <em>O primeiro pagamento é somente a implantação. A primeira mensalidade vence após os primeiros 30 dias.</em>
        </div>
        <div class="commercialBillingBox annual">
          <small>ANUAL · 25% OFF</small>
          <b>R$ ${plan.annual}/ano</b>
          <span>🎁 <strong>Implantação totalmente grátis</strong></span>
          <em>12 meses pagos de uma só vez com 25% de desconto.</em>
        </div>
        <div class="planFeatureList">${plan.items.map((item) => `<span class="yes">${item}</span>`).join("")}</div>
        <a class="button primary" href="cadastro/">Criar minha imobiliária</a>
      </article>
    `).join("");

    const headers = section.querySelectorAll<HTMLTableCellElement>(".planCompare thead th");
    commercialPlans.forEach((plan, index) => { if (headers[index + 1]) headers[index + 1].textContent = plan.name; });
    const rows = Array.from(section.querySelectorAll<HTMLTableRowElement>(".planCompare tbody tr"));
    rows.forEach((row) => {
      const cells = row.querySelectorAll<HTMLTableCellElement>("td");
      const label = cells[0]?.textContent?.trim().toLowerCase();
      if (label === "imóveis") ["100", "500", "1.500", "5.000"].forEach((value, i) => { if (cells[i + 1]) cells[i + 1].textContent = value; });
      if (label === "usuários") ["1", "3", "7", "15"].forEach((value, i) => { if (cells[i + 1]) cells[i + 1].textContent = value; });
    });
  }, []);

  return null;
}
