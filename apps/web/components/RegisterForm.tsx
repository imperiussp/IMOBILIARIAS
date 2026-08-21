"use client";

import { FormEvent, useState } from "react";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

export default function RegisterForm() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    if (!isSupabaseConfigured || !supabaseBrowser) {
      setStatus("O cadastro será ativado quando o Supabase exclusivo do IMOBILIARIAS estiver configurado.");
      return;
    }
    setLoading(true);
    const validBackend = await isImobiliariasBackend();
    if (!validBackend) {
      setLoading(false);
      setStatus("Conexão bloqueada: o backend configurado não pertence ao IMOBILIARIAS.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("full_name") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (!fullName || !email || !password) { setLoading(false); return setStatus("Preencha nome, e-mail e senha."); }
    if (password.length < 8) { setLoading(false); return setStatus("Use uma senha com pelo menos 8 caracteres."); }
    if (password !== confirm) { setLoading(false); return setStatus("As senhas não conferem."); }

    const redirectTo = `${window.location.origin}${window.location.pathname.replace(/cadastro\/?$/, "login/")}`;
    const { error } = await supabaseBrowser.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (error) return setStatus(error.message);
    event.currentTarget.reset();
    setStatus("Cadastro criado. Confirme o e-mail, se solicitado. Depois o administrador precisa liberar seu acesso como corretor ou administrador.");
  }

  return (
    <form className="loginCard" onSubmit={submit}>
      <span className="eyebrow">EQUIPE</span>
      <h1>Criar acesso</h1>
      <p>Este cadastro cria a conta. O acesso ao painel e ao aplicativo só é liberado depois da autorização do administrador.</p>
      <label>Nome completo<input name="full_name" autoComplete="name" required /></label>
      <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Confirmar senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="button primary full" type="submit" disabled={loading}>{loading ? "Verificando..." : "Criar conta"}</button>
      {status ? <p className="loginStatus">{status}</p> : null}
      <a className="backLink" href="../login/">← Já tenho acesso</a>
    </form>
  );
}
