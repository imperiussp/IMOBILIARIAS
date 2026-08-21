"use client";

import { ReactNode, useEffect, useState } from "react";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Props = { children: ReactNode };
type State = "checking" | "allowed" | "blocked" | "demo" | "wrong_backend";

export default function PlatformAdminGate({ children }: Props) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseBrowser) {
      setState("demo");
      return;
    }

    let active = true;
    void (async () => {
      const validBackend = await isImobiliariasBackend();
      if (!active) return;
      if (!validBackend) return setState("wrong_backend");

      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      if (!active) return;
      if (!sessionData.session?.user) return setState("blocked");

      const check = await supabaseBrowser.rpc("is_platform_admin");
      if (!active) return;
      setState(!check.error && check.data === true ? "allowed" : "blocked");
    })();

    return () => { active = false; };
  }, []);

  async function signOut() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    window.location.href = "../login/";
  }

  if (state === "checking") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><strong>Verificando administração da plataforma...</strong></div></div></main>;
  if (state === "wrong_backend") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">PROTEÇÃO DE PROJETO</span><h1>Conexão bloqueada</h1><p>O backend configurado não pertence ao projeto IMOBILIARIAS.</p><a className="backLink" href="../">← Voltar</a></div></div></main>;
  if (state === "blocked") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">ADMINISTRAÇÃO LENOY</span><h1>Acesso não autorizado</h1><p>Esta área é exclusiva da administração global da plataforma.</p><a className="button primary full" href="../admin/">Ir para o painel da imobiliária</a><button className="button secondary full" onClick={() => void signOut()}>Sair</button></div></div></main>;

  return <div data-platform-admin="true">
    {state === "demo" ? <div className="demoAdminBanner">Prévia da administração global. O Supabase ainda não está conectado neste ambiente.</div> : <div className="sessionBar"><span><strong>LENOY IMÓVEIS</strong> · Administração da plataforma</span><button onClick={() => void signOut()}>Sair</button></div>}
    {children}
  </div>;
}
