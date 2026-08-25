"use client";

import { ReactNode, useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Props = { children: ReactNode; appMode?: boolean };
type GateState = "checking" | "allowed" | "blocked" | "unconfirmed" | "demo" | "wrong_backend" | "inactive_broker";
type TenantRole = "owner" | "admin" | "broker" | "staff" | "platform_admin" | "";

function roleLabel(role: TenantRole) {
  if (role === "owner") return "Proprietário";
  if (role === "admin") return "Administrador";
  if (role === "broker") return "Corretor";
  if (role === "staff") return "Equipe";
  if (role === "platform_admin") return "Administrador da plataforma";
  return "Acesso";
}

export default function AdminGate({ children, appMode = false }: Props) {
  const [state, setState] = useState<GateState>("checking");
  const [role, setRole] = useState<TenantRole>("");
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseBrowser) {
      setRole("platform_admin");
      setState("demo");
      return;
    }

    let active = true;
    void (async () => {
      const validBackend = await isImobiliariasBackend();
      if (!active) return;
      if (!validBackend) { setState("wrong_backend"); return; }

      const { data: userData, error: userError } = await supabaseBrowser.auth.getUser();
      if (!active) return;
      const user = userData.user;
      if (userError || !user) { setState("blocked"); return; }

      const confirmedAt = user.email_confirmed_at || user.confirmed_at;
      if (!confirmedAt) {
        setState("unconfirmed");
        return;
      }

      const platformCheck = await supabaseBrowser.rpc("is_platform_admin");
      if (!active) return;
      if (!platformCheck.error && platformCheck.data === true) {
        setRole("platform_admin");
        setState("allowed");
        return;
      }

      const currentAgency = await getCurrentAgency();
      if (!active) return;
      if (!currentAgency) { setState("blocked"); return; }

      const tenantRole = currentAgency.role as TenantRole;
      if (!["owner", "admin", "broker", "staff"].includes(tenantRole)) {
        setState("blocked");
        return;
      }

      setAgencyName(currentAgency.agencyName);

      if (tenantRole === "broker") {
        const { data: brokerRow, error: brokerError } = await supabaseBrowser
          .from("brokers")
          .select("id,active,agency_id")
          .eq("user_id", user.id)
          .eq("agency_id", currentAgency.agencyId)
          .maybeSingle();
        if (!active) return;
        if (brokerError || !brokerRow?.active) {
          setRole("broker");
          setState("inactive_broker");
          return;
        }
      }

      setRole(tenantRole);
      setState("allowed");
    })();

    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (!session) setState("blocked");
      else if (!(session.user.email_confirmed_at || session.user.confirmed_at)) setState("unconfirmed");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    window.location.href = appMode ? "../login/?redirect=%2Fapp%2F" : "../login/";
  }

  const loginHref = appMode ? "../login/?redirect=%2Fapp%2F" : "../login/";

  if (state === "checking") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><strong>Verificando acesso e imobiliária...</strong></div></div></main>;
  if (state === "wrong_backend") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">PROTEÇÃO DE PROJETO</span><h1>Conexão bloqueada</h1><p>O backend configurado não se identificou como IMOBILIARIAS. Nenhum dado será acessado por este painel até a conexão correta ser configurada.</p><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;
  if (state === "unconfirmed") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">CONFIRMAÇÃO NECESSÁRIA</span><h1>Confirme seu e-mail</h1><p>Seu cadastro foi recebido, mas o painel só é liberado depois da confirmação do endereço de e-mail.</p><button className="button secondary full" onClick={() => void signOut()}>Voltar ao login</button></div></div></main>;
  if (state === "inactive_broker") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">ACESSO DO CORRETOR</span><h1>Perfil não liberado</h1><p>Sua conta está vinculada à imobiliária selecionada, mas o perfil de corretor ainda não está ativo nela.</p><button className="button secondary full" onClick={() => void signOut()}>Sair</button><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;
  if (state === "blocked") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">ACESSO RESTRITO</span><h1>Login ou vínculo necessário</h1><p>Entre com uma conta vinculada a uma imobiliária ativa.</p><a className="button primary full" href={loginHref}>Entrar no painel</a><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;

  const accessRole = role === "broker" || role === "staff" ? "broker" : "admin";
  return <div data-access-role={accessRole} data-tenant-role={role}>
    {!appMode && (state === "demo"
      ? <div className="demoAdminBanner">Modo demonstração: o Supabase ainda não está configurado neste ambiente.</div>
      : <div className="sessionBar"><span>{role === "platform_admin" ? <><strong>LENOY IMÓVEIS</strong> · </> : agencyName ? <><strong>{agencyName}</strong> · </> : null}Acesso: <strong>{roleLabel(role)}</strong></span>{role === "platform_admin" ? <a href="../plataforma/">Painel da plataforma</a> : null}<button onClick={() => void signOut()}>Sair</button></div>)}
    {children}
  </div>;
}
