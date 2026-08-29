"use client";

import { FormEvent, useState } from "react";
import { getAvailableAgencies, setPreferredAgencyId } from "../lib/currentAgency";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

const TEST_USERNAME = "teste";
const TEST_AUTH_EMAIL = "teste@demo.imoveis.lenoy.com.br";
const TEST_PASSWORD = "teste";

function safeRedirectTarget() {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get("redirect") || "";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "";
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return "";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch { return ""; }
}

export default function LoginForm() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const demoAccess = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const loginId = String(data.get("email") || "").trim();
    const email = loginId.toLowerCase() === TEST_USERNAME ? TEST_AUTH_EMAIL : loginId;
    const password = String(data.get("password") || "");

    if (!loginId || !password) {
      setStatus("Informe usuário/e-mail e senha.");
      return;
    }

    if (!isSupabaseConfigured || !supabaseBrowser) {
      setStatus("O login será ativado assim que as chaves do Supabase forem configuradas.");
      return;
    }

    setLoading(true);
    setStatus("Verificando projeto...");
    const validBackend = await isImobiliariasBackend();
    if (!validBackend) {
      setLoading(false);
      setStatus("Conexão bloqueada: o backend configurado não pertence ao IMOBILIARIAS.");
      return;
    }

    setStatus("Entrando...");
    const { data: authData, error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    if (error || !authData.user) {
      setStatus("Não foi possível entrar. Confira seus dados.");
      setLoading(false);
      return;
    }

    const redirect = safeRedirectTarget();
    if (redirect) {
      setStatus("Acesso confirmado. Continuando...");
      window.location.assign(redirect);
      return;
    }

    const platformCheck = await supabaseBrowser.rpc("is_platform_admin");
    if (!platformCheck.error && platformCheck.data === true) {
      setStatus("Acesso da plataforma confirmado.");
      window.location.href = "../plataforma/";
      return;
    }

    const agencies = await getAvailableAgencies();
    if (agencies.length > 0) {
      if (agencies.length === 1) setPreferredAgencyId(agencies[0].agencyId);
      setStatus(agencies.length === 1 ? `Acesso confirmado: ${agencies[0].agencyName}.` : `${agencies.length} imobiliárias disponíveis. Abrindo painel...`);
      window.location.href = "../admin/";
      return;
    }

    // O bootstrap administrativo legado foi encerrado no hardening do banco.
    // Contas sem vínculo ativo não recebem qualquer fallback de primeiro acesso.
    await supabaseBrowser.auth.signOut();
    setStatus("Sua conta existe, mas ainda não possui vínculo ativo com uma imobiliária.");
    setLoading(false);
  }

  const redirect = typeof window !== "undefined" ? safeRedirectTarget() : "";
  const signupHref = redirect ? `../cadastro/?redirect=${encodeURIComponent(redirect)}` : "../cadastro/";

  return (
    <form className="loginCard" onSubmit={handleSubmit}>
      <span className="eyebrow">ACESSO RESTRITO</span>
      <h1>{demoAccess ? "Testar a plataforma" : "Entrar no painel"}</h1>
      <p>{demoAccess ? "As credenciais de demonstração já estão preenchidas. Clique em Entrar no modo teste para acessar o ambiente completo." : redirect ? "Entre para continuar o convite ou a ação que trouxe você até aqui." : "Use sua conta da imobiliária. A plataforma identifica automaticamente seus vínculos e permissões."}</p>
      <div className="loginTestAccessNotice">
        <strong>Acesso de demonstração:</strong> usuário <b>teste</b> e senha <b>teste</b>. Você pode usar painel, site e aplicativo. O ambiente é reiniciado automaticamente a cada 2 horas e tudo o que for cadastrado ou alterado é apagado. Os recursos de IA ficam visíveis, porém desativados.
      </div>
      <label>E-mail ou usuário<input name="email" type="text" autoComplete="username" placeholder="voce@imobiliaria.com.br ou teste" defaultValue={demoAccess ? TEST_USERNAME : ""} required /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" placeholder="••••••••" defaultValue={demoAccess ? TEST_PASSWORD : ""} required /></label>
      <button className="button primary full" type="submit" disabled={loading}>{loading ? "Aguarde..." : demoAccess ? "Entrar no modo teste" : "Entrar"}</button>
      {status ? <p className="loginStatus">{status}</p> : null}
      <div className="loginLinks"><a href="../recuperar-senha/">Esqueci minha senha</a><a href={signupHref}>Criar conta</a></div>
      <a className="backLink" href="../">← Voltar ao site</a>
    </form>
  );
}
