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
      className="appShowcaseModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-showcase-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAppModalOpen(false);
      }}
    >
      <style>{`
        .appShowcaseModal {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(2, 8, 16, .78);
          backdrop-filter: blur(9px);
          -webkit-backdrop-filter: blur(9px);
        }
        .appShowcaseModal__panel {
          position: relative;
          width: min(94vw, 980px);
          max-height: 90vh;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 390px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, .14);
          border-radius: 28px;
          background: linear-gradient(135deg, #071725 0%, #0b2237 58%, #06111c 100%);
          box-shadow: 0 34px 110px rgba(0, 0, 0, .62);
          color: #fff;
        }
        .appShowcaseModal__close {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 5;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, .18);
          border-radius: 999px;
          background: rgba(2, 13, 24, .74);
          color: #fff;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
          transition: transform .18s ease, background .18s ease;
        }
        .appShowcaseModal__close:hover {
          transform: scale(1.06);
          background: rgba(255, 255, 255, .14);
        }
        .appShowcaseModal__copy {
          min-width: 0;
          padding: 54px 50px 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .appShowcaseModal__eyebrow {
          align-self: flex-start;
          margin-bottom: 18px;
          padding: 8px 12px;
          border: 1px solid rgba(235, 185, 77, .32);
          border-radius: 999px;
          background: rgba(235, 185, 77, .09);
          color: #f5ca68;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
        }
        .appShowcaseModal__copy h2 {
          margin: 0;
          max-width: 560px;
          color: #fff;
          font-size: clamp(34px, 4vw, 52px);
          line-height: .98;
          letter-spacing: -.035em;
        }
        .appShowcaseModal__lead {
          margin: 22px 0 0;
          max-width: 560px;
          color: rgba(255, 255, 255, .76);
          font-size: 18px;
          line-height: 1.55;
        }
        .appShowcaseModal__features {
          display: grid;
          gap: 12px;
          margin-top: 28px;
        }
        .appShowcaseModal__feature {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          color: rgba(255, 255, 255, .92);
          font-size: 15px;
          line-height: 1.4;
        }
        .appShowcaseModal__check {
          flex: 0 0 24px;
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          margin-top: -1px;
          border-radius: 999px;
          background: rgba(235, 185, 77, .14);
          color: #f5ca68;
          font-size: 14px;
          font-weight: 900;
        }
        .appShowcaseModal__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 34px;
        }
        .appShowcaseModal__primary,
        .appShowcaseModal__secondary {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }
        .appShowcaseModal__primary {
          border: 1px solid #f0c25e;
          background: #f0c25e;
          color: #071725;
          box-shadow: 0 12px 30px rgba(240, 194, 94, .18);
        }
        .appShowcaseModal__secondary {
          border: 1px solid rgba(255, 255, 255, .17);
          background: rgba(255, 255, 255, .06);
          color: #fff;
        }
        .appShowcaseModal__visual {
          position: relative;
          min-height: 540px;
          display: grid;
          place-items: center;
          padding: 64px 34px 34px;
          overflow: hidden;
          border-left: 1px solid rgba(255, 255, 255, .08);
          background:
            radial-gradient(circle at 50% 25%, rgba(235, 185, 77, .18), transparent 34%),
            linear-gradient(180deg, rgba(1, 8, 15, .2), rgba(0, 0, 0, .38));
        }
        .appShowcaseModal__visual::after {
          content: "";
          position: absolute;
          width: 250px;
          height: 250px;
          border-radius: 999px;
          background: rgba(42, 145, 219, .13);
          filter: blur(34px);
          bottom: -95px;
          right: -70px;
          pointer-events: none;
        }
        .appShowcaseModal__visual img {
          position: relative;
          z-index: 1;
          display: block;
          width: min(100%, 320px);
          height: auto;
          max-height: 74vh;
          object-fit: contain;
          border-radius: 20px;
          box-shadow: 0 24px 55px rgba(0, 0, 0, .48);
        }
        @media (max-width: 760px) {
          .appShowcaseModal {
            padding: 12px;
            align-items: center;
          }
          .appShowcaseModal__panel {
            width: min(96vw, 520px);
            max-height: 94vh;
            grid-template-columns: 1fr;
            overflow-y: auto;
            border-radius: 22px;
          }
          .appShowcaseModal__copy {
            padding: 34px 24px 28px;
          }
          .appShowcaseModal__copy h2 {
            font-size: clamp(30px, 9vw, 42px);
          }
          .appShowcaseModal__lead {
            margin-top: 16px;
            font-size: 16px;
          }
          .appShowcaseModal__features {
            margin-top: 22px;
          }
          .appShowcaseModal__actions {
            margin-top: 26px;
          }
          .appShowcaseModal__primary,
          .appShowcaseModal__secondary {
            flex: 1 1 160px;
          }
          .appShowcaseModal__visual {
            min-height: 0;
            padding: 28px 24px 30px;
            border-left: 0;
            border-top: 1px solid rgba(255, 255, 255, .08);
          }
          .appShowcaseModal__visual img {
            width: min(100%, 260px);
            max-height: none;
          }
          .appShowcaseModal__close {
            top: 10px;
            right: 10px;
          }
        }
      `}</style>

      <div className="appShowcaseModal__panel">
        <button
          type="button"
          className="appShowcaseModal__close"
          aria-label="Fechar"
          onClick={() => setAppModalOpen(false)}
        >
          ×
        </button>

        <div className="appShowcaseModal__copy">
          <span className="appShowcaseModal__eyebrow">Aplicativo exclusivo do corretor</span>
          <h2 id="app-showcase-title">Seu escritório cabe no bolso.</h2>
          <p className="appShowcaseModal__lead">
            Gerencie imóveis, clientes e visitas onde estiver — inclusive quando estiver sem internet.
          </p>

          <div className="appShowcaseModal__features">
            <div className="appShowcaseModal__feature">
              <span className="appShowcaseModal__check">✓</span>
              <span>Consulte e organize seus imóveis com rapidez.</span>
            </div>
            <div className="appShowcaseModal__feature">
              <span className="appShowcaseModal__check">✓</span>
              <span>Acompanhe clientes e visitas diretamente pelo celular.</span>
            </div>
            <div className="appShowcaseModal__feature">
              <span className="appShowcaseModal__check">✓</span>
              <span>Continue trabalhando offline e sincronize depois.</span>
            </div>
          </div>

          <div className="appShowcaseModal__actions">
            <a
              className="appShowcaseModal__primary"
              href="/login/?demo=1"
              onClick={() => setAppModalOpen(false)}
            >
              Testar agora
            </a>
            <button
              type="button"
              className="appShowcaseModal__secondary"
              onClick={() => setAppModalOpen(false)}
            >
              Continuar no site
            </button>
          </div>
        </div>

        <div className="appShowcaseModal__visual" aria-hidden="true">
          <img
            src="/app-offline-modal.webp"
            alt=""
          />
        </div>
      </div>
    </div>
  );
}
