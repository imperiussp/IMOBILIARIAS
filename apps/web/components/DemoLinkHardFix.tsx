"use client";

import { useEffect } from "react";

function setLink(link: HTMLAnchorElement | null | undefined, href: string, label?: string) {
  if (!link) return;
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  if (label && link.textContent !== label) link.textContent = label;
}

function rewritePricingLinks() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
  links.forEach((link) => {
    const normalized = (link.getAttribute("href") || "").trim();
    if (
      normalized === "#planos" ||
      normalized === "/#planos" ||
      normalized === "./#planos" ||
      normalized === "../#planos" ||
      normalized === "https://imoveis.lenoy.com.br/#planos" ||
      normalized === "https://www.imoveis.lenoy.com.br/#planos"
    ) setLink(link, "/planos/");
  });
}

function ensureLiveTestAccess() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/" && window.location.pathname !== "") return;

  const landing = document.querySelector<HTMLElement>(".platformLanding");
  const hero = document.querySelector<HTMLElement>(".platformLanding .platformHero");
  if (!landing || !hero) return;

  if (!document.getElementById("platform-live-test-access")) {
    const banner = document.createElement("section");
    banner.id = "platform-live-test-access";
    banner.className = "platformLiveTestAccess";
    banner.setAttribute("aria-label", "Acesso de demonstração da plataforma");
    banner.innerHTML = `
      <div class="container platformLiveTestAccessInner">
        <div class="platformLiveTestAccessCopy">
          <span>TESTE A PLATAFORMA COMPLETA</span>
          <h2>Acesse agora como cliente teste.</h2>
          <p>Use de verdade o <strong>painel</strong>, o <strong>site</strong> e o <strong>aplicativo</strong>, com os recursos Premium liberados. A IA permanece visível, porém desativada. Tudo o que for cadastrado ou alterado é apagado automaticamente a cada 2 horas.</p>
          <div class="platformLiveTestCredentials" aria-label="Credenciais de demonstração">
            <b>Usuário: <strong>teste</strong></b>
            <b>Senha: <strong>teste</strong></b>
          </div>
        </div>
        <div class="platformLiveTestActions">
          <a class="button primary platformLiveTestPrimary" href="/login/?demo=1">ENTRAR E TESTAR AGORA</a>
          <a class="button secondary platformLiveTestSecondary" href="https://teste.imoveis.lenoy.com.br/">VER SITE DE TESTE</a>
          <small>Sem cadastro e sem pagamento para testar.</small>
        </div>
      </div>`;
    hero.insertAdjacentElement("beforebegin", banner);
  }

  const topActions = document.querySelector<HTMLElement>(".platformActions");
  if (topActions && !topActions.querySelector(".platformTopTestButton")) {
    const testButton = document.createElement("a");
    testButton.className = "button platformTopTestButton";
    testButton.href = "/login/?demo=1";
    testButton.textContent = "Testar agora";
    topActions.insertBefore(testButton, topActions.firstChild);
  }
}

function rewriteDemoLinks() {
  if (typeof window === "undefined") return;
  rewritePricingLinks();
  if (window.location.pathname !== "/" && window.location.pathname !== "") return;

  const panelNav = document.querySelector<HTMLAnchorElement>('.platformNav nav a[href="#painel-demo"], .platformNav nav a[href="/demonstracao/painel/"]');
  setLink(panelNav, "/demonstracao/painel/");
  const appNav = document.querySelector<HTMLAnchorElement>('.platformNav nav a[href="#app-demo"], .platformNav nav a[href="/demonstracao/aplicativo/"]');
  setLink(appNav, "/demonstracao/aplicativo/");
  const plansNav = Array.from(document.querySelectorAll<HTMLAnchorElement>(".platformNav nav a")).find((link) => (link.textContent || "").trim().toLowerCase() === "planos");
  setLink(plansNav, "/planos/");

  const createTop = document.querySelector<HTMLAnchorElement>(".platformActions .button.primary");
  setLink(createTop, "/planos/", "Ver planos e contratar");
  const heroButtons = document.querySelectorAll<HTMLAnchorElement>(".platformHeroActions .button");
  setLink(heroButtons[0], "/planos/", "Ver planos e contratar");
  setLink(heroButtons[1], "/demonstracao/", "Ver demonstração");
  ensureLiveTestAccess();
}

export default function DemoLinkHardFix() {
  useEffect(() => {
    rewriteDemoLinks();
    const observer = new MutationObserver(() => rewriteDemoLinks());
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
    const timer = window.setTimeout(rewriteDemoLinks, 800);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, []);
  return null;
}
