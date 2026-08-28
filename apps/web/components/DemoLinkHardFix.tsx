"use client";

import { useEffect } from "react";

function rewriteDemoLinks() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/" && window.location.pathname !== "") return;

  const panelNav = document.querySelector<HTMLAnchorElement>('.platformNav nav a[href="#painel-demo"]');
  if (panelNav) panelNav.href = "/demonstracao/painel/";

  const appNav = document.querySelector<HTMLAnchorElement>('.platformNav nav a[href="#app-demo"]');
  if (appNav) appNav.href = "/demonstracao/aplicativo/";

  const createTop = document.querySelector<HTMLAnchorElement>(".platformActions .button.primary");
  if (createTop) {
    createTop.href = "/cadastro/";
    createTop.textContent = "Criar imobiliária";
  }

  const heroButtons = document.querySelectorAll<HTMLAnchorElement>(".platformHeroActions .button");
  if (heroButtons[0]) {
    heroButtons[0].href = "/cadastro/";
    heroButtons[0].textContent = "Começar agora";
  }
  if (heroButtons[1]) {
    heroButtons[1].href = "/demonstracao/";
    heroButtons[1].textContent = "Ver demonstração";
  }
}

export default function DemoLinkHardFix() {
  useEffect(() => {
    rewriteDemoLinks();

    const observer = new MutationObserver(() => rewriteDemoLinks());
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["href"],
    });

    const timer = window.setTimeout(rewriteDemoLinks, 800);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
