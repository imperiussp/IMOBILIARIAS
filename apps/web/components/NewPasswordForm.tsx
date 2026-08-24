"use client";

import { FormEvent, useEffect, useState } from "react";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

export default function NewPasswordForm() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseBrowser) {
      setCheckingSession(false);
      return;
    }

    let active = true;
    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionReady(Boolean(data.session));
      setCheckingSession(false);
      if (!data.session) setStatus("Abra esta página pelo link de recuperação enviado ao seu e-mail. Se o link expirou, solicite outro.");
    });

    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(Boolean(session));
        setCheckingSession(false);
        if (session) setStatus("");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured || !supabaseBrowser) return setStatus("A alteração será ativada quando o Supabase do IMOBILIARIAS estiver configurado.");
    if (!sessionReady) return setStatus("Link de recuperação inválido ou expirado. Solicite uma nova recuperação de senha.");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password.length < 8) return setStatus("Use uma senha com pelo menos 8 caracteres.");
    if (password !== confirm) return setStatus("As senhas não conferem.");

    setLoading(true);
    const validBackend = await isImobiliariasBackend();
    if (!validBackend) {
      setLoading(false);
      return setStatus("Conexão bloqueada: o backend configurado não pertence ao IMOBILIARIAS.");
    }

    const { data: currentSession } = await supabaseBrowser.auth.getSession();
    if (!currentSession.session) {
      setLoading(false);
      setSessionReady(false);
      return setStatus("A sessão de recuperação expirou. Solicite um novo link.");
    }

    const { error } = await supabaseBrowser.auth.updateUser({ password });
    setLoading(false);
    if (error) return setStatus(error.message);

    await supabaseBrowser.auth.signOut();
    setSessionReady(false);
    setStatus("Senha alterada com sucesso. Entre novamente usando a nova senha.");
  }

  return <form className="loginCard" onSubmit={submit}>
    <span className="eyebrow">SEGURANÇA</span><h1>Criar nova senha</h1><p>Defina a nova senha da sua conta.</p>
    <label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} required disabled={checkingSession || !sessionReady} /></label>
    <label>Confirmar nova senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} required disabled={checkingSession || !sessionReady} /></label>
    <button className="button primary full" disabled={loading || checkingSession || !sessionReady}>{checkingSession ? "Validando link..." : loading ? "Salvando..." : "Salvar nova senha"}</button>
    {status ? <p className="loginStatus">{status}</p> : null}
    {!sessionReady && !checkingSession ? <a className="backLink" href="../recuperar-senha/">Solicitar novo link</a> : null}
    <a className="backLink" href="../login/">Ir para o login</a>
  </form>;
}
