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
    const raw = link.getAttribute("href") || "";
    const normalized = raw.trim();
    if (
      normalized === "#planos" ||
      normalized === "/#planos" ||
      normalized === "./#planos" ||
      normalized === "https://imoveis.lenoy.com.br/#planos" ||
      normalized === "https://www.imoveis.lenoy.com.br/#planos"
    ) {
      setLink(link, "/planos/");
    }
  });
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
  setLink(createTop, "/cadastro/", "Criar imobiliária");

  const heroButtons = document.querySelectorAll<HTMLAnchorElement>(".platformHeroActions .button");
  setLink(heroButtons[0], "/cadastro/", "Começar agora");
  setLink(heroButtons[1], "/demonstracao/", "Ver demonstração");
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
