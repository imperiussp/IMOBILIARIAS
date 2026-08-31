"use client";

import { useEffect, useState } from "react";

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

function ensureTopTestButton() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/" && window.location.pathname !== "") return;

  document.getElementById("platform-live-test-access")?.remove();

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

  const appNav = Array.from(document.querySelectorAll<HTMLAnchorElement>(".platformNav nav a")).find(
    (link) => (link.textContent || "").trim().toLowerCase() === "aplicativo"
  );
  setLink(appNav, "#app-demo");

  const plansNav = Array.from(document.querySelectorAll<HTMLAnchorElement>(".platformNav nav a")).find((link) => (link.textContent || "").trim().toLowerCase() === "planos");
  setLink(plansNav, "/planos/");

  const createTop = document.querySelector<HTMLAnchorElement>(".platformActions .button.primary");
  setLink(createTop, "/planos/", "Ver planos e contratar");
  const heroButtons = document.querySelectorAll<HTMLAnchorElement>(".platformHeroActions .button");
  setLink(heroButtons[0], "/planos/", "Ver planos e contratar");
  setLink(heroButtons[1], "/demonstracao/", "Ver demonstração");
  ensureTopTestButton();
}

export default function DemoLinkHardFix() {
  const [appModalOpen, setAppModalOpen] = useState(false);

  useEffect(() => {
    rewriteDemoLinks();
    const observer = new MutationObserver(() => rewriteDemoLinks());
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
    const timer = window.setTimeout(rewriteDemoLinks, 800);

    const handleAppClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest<HTMLAnchorElement>(".platformNav nav a");
      if (!link) return;
      const label = (link.textContent || "").trim().toLowerCase();
      if (label !== "aplicativo") return;
      event.preventDefault();
      event.stopPropagation();
      setAppModalOpen(true);
    };

    document.addEventListener("click", handleAppClick, true);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      document.removeEventListener("click", handleAppClick, true);
    };
  }, []);

  useEffect(() => {
    if (!appModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAppModalOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [appModalOpen]);

  if (!appModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aplicativo do corretor"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAppModalOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(2, 10, 20, .86)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(92vw, 520px)",
          maxHeight: "92vh",
          overflow: "auto",
          border: "1px solid rgba(255,255,255,.18)",
          borderRadius: 24,
          background: "#071725",
          boxShadow: "0 30px 90px rgba(0,0,0,.55)",
          padding: 14,
        }}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => setAppModalOpen(false)}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 2,
            width: 38,
            height: 38,
            border: 0,
            borderRadius: 999,
            background: "rgba(4,18,34,.92)",
            color: "#fff",
            fontSize: 24,
            lineHeight: "38px",
            cursor: "pointer",
          }}
        >
          ×
        </button>

        <img
          src="/app-offline-modal.webp"
          alt="Aplicativo exclusivo do corretor, com funcionamento também offline"
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            maxHeight: "84vh",
            objectFit: "contain",
            borderRadius: 16,
          }}
        />
      </div>
    </div>
  );
}
