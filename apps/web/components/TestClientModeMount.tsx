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

export default function TestClientModeMount() {
  const [active, setActive] = useState(false);
  const [resetMinutes, setResetMinutes] = useState(120);

  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;

    void (async () => {
      const publicTestHost = window.location.hostname.toLowerCase() === TEST_HOST;
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

      if (authenticatedTest) {
        markAiControlsDisabled();
        observer = new MutationObserver(() => markAiControlsDisabled());
        observer.observe(document.body, { subtree: true, childList: true });
      }
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
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
