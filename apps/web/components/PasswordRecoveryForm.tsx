"use client";

import { FormEvent, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

export default function PasswordRecoveryForm() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured || !supabaseBrowser) return setStatus("A recuperação será ativada quando o Supabase do IMOBILIARIAS estiver configurado.");
    const email = String(new FormData(event.currentTarget).get("email") || "").trim().toLowerCase();
    if (!email) return setStatus("Informe seu e-mail.");
    setLoading(true);
    const redirectTo = `${window.location.origin}${window.location.pathname.replace(/recuperar-senha\/?$/, "nova-senha/")}`;
    const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    setStatus(error ? error.message : "Se o e-mail estiver cadastrado, você receberá as instruções para criar uma nova senha.");
  }

  return <form className="loginCard" onSubmit={submit}>
    <span className="eyebrow">SEGURANÇA</span><h1>Recuperar senha</h1><p>Informe o e-mail da sua conta de acesso.</p>
    <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
    <button className="button primary full" disabled={loading}>{loading ? "Enviando..." : "Enviar recuperação"}</button>
    {status ? <p className="loginStatus">{status}</p> : null}
    <a className="backLink" href="../login/">← Voltar ao login</a>
  </form>;
}
