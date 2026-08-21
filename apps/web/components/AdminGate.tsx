"use client";

import { ReactNode, useEffect, useState } from "react";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Props = { children: ReactNode };

type GateState = "checking" | "allowed" | "blocked" | "demo" | "wrong_backend" | "inactive_broker";

export default function AdminGate({ children }: Props) {
  const [state, setState] = useState<GateState>("checking");
  const [role, setRole] = useState<"admin" | "broker" | "">("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseBrowser) {
      setRole("admin");
      setState("demo");
      return;
    }
    let active = true;
    void (async () => {
      const validBackend = await isImobiliariasBackend();
      if (!active) return;
      if (!validBackend) { setState("wrong_backend"); return; }

      const { data } = await supabaseBrowser.auth.getSession();
      if (!active) return;
      const user = data.session?.user;
      if (!user) { setState("blocked"); return; }

      const { data: roleRow, error: roleError } = await supabaseBrowser.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (roleError || !roleRow) { setState("blocked"); return; }

      if (roleRow.role === "admin") {
        setRole("admin");
        setState("allowed");
        return;
      }

      if (roleRow.role === "broker") {
        const { data: brokerRow, error: brokerError } = await supabaseBrowser
          .from("brokers")
          .select("id,active")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!active) return;
        if (brokerError || !brokerRow?.active) {
          setRole("broker");
          setState("inactive_broker");
          return;
        }
        setRole("broker");
        setState("allowed");
        return;
      }

      setState("blocked");
    })();

    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (!session) setState("blocked");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    window.location.href = "../login/";
  }

  if (state === "checking") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><strong>Verificando acesso e projeto...</strong></div></div></main>;
  if (state === "wrong_backend") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">PROTEÇÃO DE PROJETO</span><h1>Conexão bloqueada</h1><p>O backend configurado não se identificou como IMOBILIARIAS. Nenhum dado será acessado por este painel até a conexão correta ser configurada.</p><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;
  if (state === "inactive_broker") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">ACESSO DO CORRETOR</span><h1>Perfil não liberado</h1><p>Sua conta existe, mas o perfil de corretor ainda não está ativo ou vinculado corretamente.</p><button className="button secondary full" onClick={() => void signOut()}>Sair</button><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;
  if (state === "blocked") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">ACESSO RESTRITO</span><h1>Login necessário</h1><p>Entre com uma conta autorizada para abrir o painel.</p><a className="button primary full" href="../login/">Entrar no painel</a><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;

  return <div data-access-role={role || "admin"}>
    {state === "demo" ? <div className="demoAdminBanner">Modo demonstração: o Supabase ainda não está configurado neste ambiente.</div> : <div className="sessionBar"><span>Acesso: <strong>{role === "admin" ? "Administrador" : "Corretor"}</strong></span><button onClick={() => void signOut()}>Sair</button></div>}
    {children}
  </div>;
}
