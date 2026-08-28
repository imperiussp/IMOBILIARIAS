"use client";

import { useEffect } from "react";

const commercialPlans = [
  { code: "inicial", name: "Start", monthly: "39,90", annual: "359,10", implementation: "99,00", featured: false, items: ["Até 30 imóveis", "1 usuário", "2 acessos simultâneos", "1 e-mail profissional", "5 fotos por imóvel", "Site exclusivo", "Catálogo de imóveis", "CRM com funil de vendas", "Leads via site e portais", "WhatsApp flutuante no site", "Site otimizado para SEO"] },
  { code: "profissional", name: "Pro", monthly: "59,90", annual: "539,10", implementation: "99,00", featured: true, items: ["Até 400 imóveis", "Até 3 usuários", "6 acessos simultâneos", "3 e-mails profissionais", "50 fotos por imóvel", "Tudo do Start", "Gestão completa", "Aplicativo do corretor", "CRM imobiliário completo", "Controle de chaves", "Controle de propostas", "Vistorias", "Agenda e visitas", "IA para descrições"] },
  { code: "imobiliaria", name: "Business", monthly: "79,90", annual: "719,10", implementation: "100,00", featured: false, items: ["Até 1.000 imóveis", "Até 5 usuários", "10 acessos simultâneos", "5 e-mails profissionais", "50 fotos por imóvel", "Tudo do Pro", "IA de oportunidades", "Central de documentos", "Gestão de vendas", "Gestão de clientes", "Permissões por usuário", "Relatórios estratégicos", "Reserva avançada de leads"] },
  { code: "premium", name: "Prime", monthly: "110,00", annual: "990,00", implementation: "Grátis", featured: false, items: ["Até 3.000 imóveis", "Até 10 usuários", "20 acessos simultâneos", "10 e-mails profissionais", "50 fotos por imóvel", "Tudo do Business", "Domínio próprio", "Gestão multi-equipe", "Maior capacidade de IA", "Prioridade operacional", "Recursos avançados de automação"] },
];

export default function PublicPricingEnhancer() {
  useEffect(() => {
    const section = document.getElementById("planos");
    if (!section || section.dataset.commercialPricingApplied === "1") return;
    const grid = section.querySelector<HTMLElement>(".plansGrid");
    if (!grid) return;

    section.dataset.commercialPricingApplied = "1";
    section.classList.add("publicCommercialPricing");

    const topPrimary = document.querySelector<HTMLAnchorElement>(".platformActions .button.primary");
    if (topPrimary) {
      topPrimary.href = "demonstracao/";
      topPrimary.textContent = "Ver demonstração";
    }
    const heroActions = document.querySelectorAll<HTMLAnchorElement>(".platformHeroActions .button");
    if (heroActions[0]) {
      heroActions[0].href = "demonstracao/";
      heroActions[0].textContent = "Ver demonstração";
    }
    if (heroActions[1]) {
      heroActions[1].href = "/planos/";
      heroActions[1].textContent = "Ver planos e contratar";
    }
    const demoNavLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".platformNav nav a")).filter((link) => {
      const href = link.getAttribute("href") || "";
      return href === "#painel-demo" || href === "#app-demo";
    });
    demoNavLinks.forEach((link, index) => {
      link.href = index === 0 ? "/demonstracao/painel/" : "/demonstracao/aplicativo/";
    });
    const plansNav = Array.from(document.querySelectorAll<HTMLAnchorElement>(".platformNav nav a")).find((link) => (link.textContent || "").trim().toLowerCase() === "planos");
    if (plansNav) plansNav.href = "/planos/";

    const heading = section.querySelector("h2");
    if (heading) heading.textContent = "Planos para começar pequeno e crescer com a sua operação.";
    const intro = section.querySelector<HTMLElement>(".sectionIntro");
    if (intro) intro.textContent = "Veja os valores antes de criar a conta. O cadastro apenas reserva sua imobiliária; o painel, o site e o aplicativo são liberados somente após o pagamento confirmado.";

    grid.innerHTML = commercialPlans.map((plan) => `
      <article class="planCard ${plan.featured ? "featured" : ""}">
        ${plan.featured ? '<span class="commercialPlanBadge">MAIS ESCOLHIDO</span>' : '<span class="planTag">PLANO</span>'}
        <h3>${plan.name}</h3>
        <div class="commercialMonthlyPrice"><strong>R$ ${plan.monthly}</strong><span>/mês</span></div>
        <div class="commercialBillingBox monthly">
          <small>MENSAL</small>
          <b>R$ ${plan.monthly}/mês</b>
          <span>${plan.implementation === "Grátis" ? "<strong>Implantação grátis</strong>" : `Implantação: <strong>R$ ${plan.implementation}</strong> · pagamento único`}</span>
          <em>${plan.implementation === "Grátis" ? "Sem taxa de implantação. A primeira cobrança é a mensalidade." : "O primeiro pagamento é somente a implantação. A primeira mensalidade vence após os primeiros 30 dias."}</em>
        </div>
        <div class="commercialBillingBox annual">
          <small>ANUAL · 25% OFF</small>
          <b>R$ ${plan.annual}/ano</b>
          <span>🎁 <strong>Implantação totalmente grátis</strong></span>
          <em>12 meses pagos de uma só vez com 25% de desconto.</em>
        </div>
        <div class="planFeatureList">${plan.items.map((item) => `<span class="yes">${item}</span>`).join("")}</div>
        <a class="button primary" href="cadastro/?plano=${encodeURIComponent(plan.code)}">Escolher ${plan.name}</a>
      </article>
    `).join("");

    const steps = document.querySelectorAll<HTMLElement>("#como-funciona .steps article");
    if (steps[0]) steps[0].innerHTML = '<span>01</span><h3>Veja a demonstração</h3><p>Faça um tour pelo mesmo modelo de painel, site e aplicativo que será entregue após a contratação.</p>';
    if (steps[1]) steps[1].innerHTML = '<span>02</span><h3>Escolha o plano e crie a conta</h3><p>Você vê o preço primeiro, escolhe o plano e só então informa os dados da imobiliária e reserva o endereço.</p>';
    if (steps[2]) steps[2].innerHTML = '<span>03</span><h3>Pague e libere o acesso</h3><p>A contratação é concluída no pagamento. O site, o painel e o aplicativo só são liberados depois da confirmação segura.</p>';

    const headers = section.querySelectorAll<HTMLTableCellElement>(".planCompare thead th");
    commercialPlans.forEach((plan, index) => { if (headers[index + 1]) headers[index + 1].textContent = plan.name; });
    const rows = Array.from(section.querySelectorAll<HTMLTableRowElement>(".planCompare tbody tr"));
    rows.forEach((row) => {
      const cells = row.querySelectorAll<HTMLTableCellElement>("td");
      const label = cells[0]?.textContent?.trim().toLowerCase();
      if (label === "imóveis") ["30", "400", "1.000", "3.000"].forEach((value, i) => { if (cells[i + 1]) cells[i + 1].textContent = value; });
      if (label === "usuários") ["1", "3", "5", "10"].forEach((value, i) => { if (cells[i + 1]) cells[i + 1].textContent = value; });
    });

    const footerCreate = Array.from(document.querySelectorAll<HTMLAnchorElement>(".platformFooter a")).find((link) => link.getAttribute("href")?.includes("cadastro"));
    if (footerCreate) {
      footerCreate.href = "/planos/";
      footerCreate.textContent = "Planos e preços";
    }
  }, []);

  return null;
}
