"use client";

import { FormEvent, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

export default function LoginForm() {
  const [status, setStatus] = useState("");

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

    setStatus("Entrando...");
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("Não foi possível entrar. Confira seus dados.");
      return;
    }
    window.location.href = "../admin/";
  }

  return (
    <form className="loginCard" onSubmit={handleSubmit}>
      <span className="eyebrow">ACESSO RESTRITO</span>
      <h1>Entrar no painel</h1>
      <p>Área destinada à administração e aos corretores autorizados.</p>
      <label>E-mail<input name="email" type="email" autoComplete="email" placeholder="voce@imobiliaria.com.br" /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" placeholder="••••••••" /></label>
      <button className="button primary full" type="submit">Entrar</button>
      {status ? <p className="loginStatus">{status}</p> : null}
      <a className="backLink" href="../">← Voltar ao site</a>
    </form>
  );
}
