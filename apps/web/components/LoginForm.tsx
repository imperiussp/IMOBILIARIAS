"use client";

import { FormEvent, useState } from "react";
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
    setStatus("Entrando...");
    const { data: authData, error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    if (error || !authData.user) {
      setStatus("Não foi possível entrar. Confira seus dados.");
      setLoading(false);
      return;
    }

    const { data: roleRow, error: roleError } = await supabaseBrowser.from("user_roles").select("role").eq("user_id", authData.user.id).maybeSingle();
    if (roleError || !roleRow || !["admin", "broker"].includes(roleRow.role)) {
      await supabaseBrowser.auth.signOut();
      setStatus("Sua conta existe, mas ainda aguarda liberação do administrador.");
      setLoading(false);
      return;
    }

    setStatus(roleRow.role === "admin" ? "Acesso de administrador confirmado." : "Acesso de corretor confirmado.");
    window.location.href = "../admin/";
  }

  return (
    <form className="loginCard" onSubmit={handleSubmit}>
      <span className="eyebrow">ACESSO RESTRITO</span>
      <h1>Entrar no painel</h1>
      <p>Área destinada à administração e aos corretores autorizados.</p>
      <label>E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@imobiliaria.com.br" required /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required /></label>
      <button className="button primary full" type="submit" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      {status ? <p className="loginStatus">{status}</p> : null}
      <div className="loginLinks"><a href="../recuperar-senha/">Esqueci minha senha</a><a href="../cadastro/">Criar conta da equipe</a></div>
      <a className="backLink" href="../">← Voltar ao site</a>
    </form>
  );
}
