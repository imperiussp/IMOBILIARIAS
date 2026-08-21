"use client";

import { FormEvent, useState } from "react";
import { getAvailableAgencies, setPreferredAgencyId } from "../lib/currentAgency";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

export default function LoginForm() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    if (!email || !password) {
      setStatus("Informe e-mail e senha.");
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

    const { data: initialAvailable, error: initialError } = await supabaseBrowser.rpc("initial_admin_available");
    if (!initialError && initialAvailable === true) {
      setStatus("Primeira instalação detectada. Abrindo configuração do administrador da plataforma...");
      window.location.href = "../primeiro-acesso/";
      return;
    }

    await supabaseBrowser.auth.signOut();
    setStatus("Sua conta existe, mas ainda não possui vínculo ativo com uma imobiliária.");
    setLoading(false);
  }

  return (
    <form className="loginCard" onSubmit={handleSubmit}>
      <span className="eyebrow">ACESSO RESTRITO</span>
      <h1>Entrar no painel</h1>
      <p>Use sua conta da imobiliária. A plataforma identifica automaticamente seus vínculos e permissões.</p>
      <label>E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@imobiliaria.com.br" required /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required /></label>
      <button className="button primary full" type="submit" disabled={loading}>{loading ? "Aguarde..." : "Entrar"}</button>
      {status ? <p className="loginStatus">{status}</p> : null}
      <div className="loginLinks"><a href="../recuperar-senha/">Esqueci minha senha</a><a href="../cadastro/">Criar minha imobiliária</a></div>
      <a className="backLink" href="../">← Voltar ao site</a>
    </form>
  );
}
