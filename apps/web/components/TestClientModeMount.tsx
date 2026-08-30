"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type TestStatus = {
  is_test?: boolean;
  username?: string;
  reset_minutes?: number;
  next_reset_at?: string;
};

const TEST_HOST = "teste.imoveis.lenoy.com.br";

const DEMO_COVERS: Record<string, string> = {
  DEMO001: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=82",
  DEMO002: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=82",
  DEMO003: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=82",
  DEMO004: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=82",
  DEMO005: "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=1400&q=82",
  DEMO006: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=82",
  DEMO007: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=82",
  DEMO008: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=82",
  DEMO009: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=82",
};

function markAiControlsDisabled() {
  if (typeof document === "undefined") return;
  const path = window.location.pathname.toLowerCase();
  if (!path.startsWith("/admin") && !path.startsWith("/app")) return;

  const controls = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button']"));
  for (const control of controls) {
    const text = (control.textContent || "").replace(/\s+/g, " ").trim();
    const insideAiPanel = Boolean(control.closest("#descricao-ia, #oportunidades-ia"));
    const looksLikeAi = insideAiPanel || /\bIA\b/i.test(text) || /intelig[eê]ncia artificial/i.test(text) || /gerar descri[cç][aã]o/i.test(text);
    if (!looksLikeAi) continue;

    control.classList.add("lenoyTestAiDisabled");
    control.setAttribute("aria-disabled", "true");
    control.setAttribute("title", "Recurso de IA desativado no ambiente de teste");
    if (control instanceof HTMLButtonElement) control.disabled = true;
    if (control instanceof HTMLAnchorElement) control.tabIndex = -1;
  }
}

function applyDemoCardImages() {
  if (typeof document === "undefined") return;
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith("/admin") || path.startsWith("/app") || path.startsWith("/login")) return;

  document.querySelectorAll<HTMLElement>("article.propertyCard").forEach((card) => {
    const codeText = card.querySelector<HTMLElement>(".propertyCode")?.textContent || "";
    const match = codeText.match(/DEMO00[1-9]/i);
    if (!match) return;
    const url = DEMO_COVERS[match[0].toUpperCase()];
    if (!url) return;

    const imageBox = card.querySelector<HTMLElement>(".propertyImage");
    if (!imageBox) return;
    imageBox.style.setProperty("background-image", `url(\"${url}\")`, "important");
    imageBox.style.setProperty("background-size", "cover", "important");
    imageBox.style.setProperty("background-position", "center", "important");

    let image = imageBox.querySelector<HTMLImageElement>("img.lenoyDemoCover");
    if (!image) {
      image = document.createElement("img");
      image.className = "lenoyDemoCover";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.loading = "eager";
      image.decoding = "async";
      image.style.position = "absolute";
      image.style.inset = "0";
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "cover";
      image.style.display = "block";
      image.style.pointerEvents = "none";
      imageBox.prepend(image);
    }
    if (image.src !== url) image.src = url;
  });
}

function applyUnifiedDemoGrid() {
  if (typeof document === "undefined") return;
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith("/admin") || path.startsWith("/app") || path.startsWith("/login")) return;

  const sections = document.querySelector<HTMLElement>(".categoryResultSections");
  if (!sections) return;
  const columns = window.innerWidth <= 700 ? "1fr" : window.innerWidth <= 1000 ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";

  sections.style.setProperty("display", "grid", "important");
  sections.style.setProperty("grid-template-columns", columns, "important");
  sections.style.setProperty("gap", "20px", "important");
  sections.style.setProperty("align-items", "stretch", "important");
  sections.style.setProperty("width", "100%", "important");

  sections.querySelectorAll<HTMLElement>(".categoryResultGroup").forEach((group) => group.style.setProperty("display", "contents", "important"));
  sections.querySelectorAll<HTMLElement>(".categoryResultHeading").forEach((heading) => heading.style.setProperty("display", "none", "important"));
  sections.querySelectorAll<HTMLElement>(".categoryResultGroup > .propertyGrid").forEach((grid) => grid.style.setProperty("display", "contents", "important"));
  sections.querySelectorAll<HTMLElement>(".showMoreCategory").forEach((button) => button.style.setProperty("display", "none", "important"));
  sections.querySelectorAll<HTMLElement>("article.propertyCard").forEach((card) => {
    card.style.setProperty("width", "100%", "important");
    card.style.setProperty("min-width", "0", "important");
    card.style.setProperty("height", "100%", "important");
  });
}

function applyPublicDemoFixes() {
  applyDemoCardImages();
  applyUnifiedDemoGrid();
}

export default function TestClientModeMount() {
  const [active, setActive] = useState(false);
  const [resetMinutes, setResetMinutes] = useState(120);

  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    let publicTestHost = false;

    const refresh = () => {
      if (publicTestHost) applyPublicDemoFixes();
      markAiControlsDisabled();
    };

    void (async () => {
      publicTestHost = window.location.hostname.toLowerCase() === TEST_HOST;
      let authenticatedTest = false;
      let status: TestStatus | null = null;

      if (supabaseBrowser) {
        const session = await supabaseBrowser.auth.getSession();
        if (session.data.session) {
          const result = await supabaseBrowser.rpc("test_client_mode_status");
          const row = Array.isArray(result.data) ? result.data[0] : null;
          if (!result.error && row?.is_test === true) {
            authenticatedTest = true;
            status = row as TestStatus;
          }
        }
      }

      if (disposed || (!publicTestHost && !authenticatedTest)) return;
      setActive(true);
      setResetMinutes(Number(status?.reset_minutes || 120));
      document.documentElement.classList.add("lenoyTestClientMode");

      refresh();
      observer = new MutationObserver(refresh);
      observer.observe(document.body, { subtree: true, childList: true });
      window.addEventListener("resize", refresh);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("resize", refresh);
      document.documentElement.classList.remove("lenoyTestClientMode");
    };
  }, []);

  if (!active) return null;

  const hours = Math.max(1, Math.round(resetMinutes / 60));
  return (
    <div className="lenoyTestClientNotice" role="status" aria-live="polite">
      <strong>AMBIENTE DE TESTE</strong>
      <span>
        Você pode usar painel, site e aplicativo normalmente. Este ambiente é reiniciado automaticamente a cada {hours} horas e tudo o que for cadastrado ou alterado será apagado. Recursos de IA ficam visíveis, porém desativados nesta demonstração.
      </span>
    </div>
  );
}
