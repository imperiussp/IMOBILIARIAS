"use client";

import { FormEvent, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

export default function NewPasswordForm() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured || !supabaseBrowser) return setStatus("A alteração será ativada quando o Supabase do IMOBILIARIAS estiver configurado.");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password.length < 8) return setStatus("Use uma senha com pelo menos 8 caracteres.");
    if (password !== confirm) return setStatus("As senhas não conferem.");
    setLoading(true);
    const { error } = await supabaseBrowser.auth.updateUser({ password });
    setLoading(false);
    if (error) return setStatus(error.message);
    setStatus("Senha alterada. Você já pode entrar no painel.");
  }

  return <form className="loginCard" onSubmit={submit}>
    <span className="eyebrow">SEGURANÇA</span><h1>Criar nova senha</h1><p>Defina a nova senha da sua conta.</p>
    <label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
    <label>Confirmar nova senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
    <button className="button primary full" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</button>
    {status ? <p className="loginStatus">{status}</p> : null}
    <a className="backLink" href="../login/">Ir para o login</a>
  </form>;
}
