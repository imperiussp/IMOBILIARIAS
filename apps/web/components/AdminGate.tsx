"use client";

import { ReactNode, useEffect, useState } from "react";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Props = { children: ReactNode };
type GateState = "checking" | "allowed" | "blocked" | "demo" | "wrong_backend" | "inactive_broker";
type TenantRole = "owner" | "admin" | "broker" | "staff" | "platform_admin" | "";

function roleLabel(role: TenantRole) {
  if (role === "owner") return "Proprietário";
  if (role === "admin") return "Administrador";
  if (role === "broker") return "Corretor";
  if (role === "staff") return "Equipe";
  if (role === "platform_admin") return "Administrador da plataforma";
  return "Acesso";
}

export default function AdminGate({ children }: Props) {
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

      const { data } = await supabaseBrowser.auth.getSession();
      if (!active) return;
      const user = data.session?.user;
      if (!user) { setState("blocked"); return; }

      // Administrador global da plataforma continua tendo acesso operacional.
      const { data: globalRole } = await supabaseBrowser
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (globalRole?.role === "admin") {
        setRole("platform_admin");
        setState("allowed");
        return;
      }

      // No SaaS, o acesso normal nasce do vínculo com uma imobiliária.
      const { data: memberships, error: membershipError } = await supabaseBrowser
        .from("agency_memberships")
        .select("agency_id,role,active")
        .eq("user_id", user.id)
        .eq("active", true)
        .limit(1);
      if (!active) return;
      const membership = memberships?.[0];
      if (membershipError || !membership) { setState("blocked"); return; }

      const tenantRole = membership.role as TenantRole;
      if (!["owner", "admin", "broker", "staff"].includes(tenantRole)) {
        setState("blocked");
        return;
      }

      const { data: agency } = await supabaseBrowser
        .from("agencies")
        .select("name,status")
        .eq("id", membership.agency_id)
        .maybeSingle();
      if (!active) return;
      if (!agency || !["trial", "active", "past_due"].includes(agency.status)) {
        setState("blocked");
        return;
      }
      setAgencyName(agency.name || "");

      if (tenantRole === "broker") {
        const { data: brokerRow, error: brokerError } = await supabaseBrowser
          .from("brokers")
          .select("id,active,agency_id")
          .eq("user_id", user.id)
          .eq("agency_id", membership.agency_id)
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
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function signOut() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    window.location.href = "../login/";
  }

  if (state === "checking") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><strong>Verificando acesso e imobiliária...</strong></div></div></main>;
  if (state === "wrong_backend") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">PROTEÇÃO DE PROJETO</span><h1>Conexão bloqueada</h1><p>O backend configurado não se identificou como IMOBILIARIAS. Nenhum dado será acessado por este painel até a conexão correta ser configurada.</p><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;
  if (state === "inactive_broker") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">ACESSO DO CORRETOR</span><h1>Perfil não liberado</h1><p>Sua conta está vinculada à imobiliária, mas o perfil de corretor ainda não está ativo.</p><button className="button secondary full" onClick={() => void signOut()}>Sair</button><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;
  if (state === "blocked") return <main className="loginPage"><div className="loginShell"><div className="loginCard"><span className="eyebrow">ACESSO RESTRITO</span><h1>Login ou vínculo necessário</h1><p>Entre com uma conta vinculada a uma imobiliária ativa.</p><a className="button primary full" href="../login/">Entrar no painel</a><a className="backLink" href="../">← Voltar ao site</a></div></div></main>;

  const accessRole = role === "broker" || role === "staff" ? "broker" : "admin";
  return <div data-access-role={accessRole} data-tenant-role={role}>
    {state === "demo"
      ? <div className="demoAdminBanner">Modo demonstração: o Supabase ainda não está configurado neste ambiente.</div>
      : <div className="sessionBar"><span>{agencyName ? <><strong>{agencyName}</strong> · </> : null}Acesso: <strong>{roleLabel(role)}</strong></span><button onClick={() => void signOut()}>Sair</button></div>}
    {children}
  </div>;
}
