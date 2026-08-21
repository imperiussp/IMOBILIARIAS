"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

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

export default function RegisterForm() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [agencySlug, setAgencySlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const redirect = typeof window !== "undefined" ? safeRedirectTarget() : "";
  const invitationMode = redirect.startsWith("/convite/");

  useEffect(() => {
    if (!invitationMode && !slugTouched) setAgencySlug(slugify(agencyName));
  }, [agencyName, slugTouched, invitationMode]);

  useEffect(() => {
    if (invitationMode) { setSlugState("idle"); return; }
    const slug = slugify(agencySlug);
    if (!slug || slug.length < 3 || !isSupabaseConfigured || !supabaseBrowser) {
      setSlugState("idle");
      return;
    }
    const timer = window.setTimeout(() => {
      setSlugState("checking");
      void supabaseBrowser.rpc("agency_slug_available", { p_slug: slug }).then(({ data, error }) => {
        if (error) setSlugState("idle");
        else setSlugState(data === true ? "available" : "unavailable");
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [agencySlug, invitationMode]);

  const publicAddress = useMemo(() => `${agencySlug || "sua-imobiliaria"}.imoveis.lenoy.com.br`, [agencySlug]);

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
    const normalizedSlug = slugify(agencySlug);
    const normalizedAgencyName = agencyName.trim();

    if (!fullName || !email || !password) { setLoading(false); return setStatus("Preencha nome, e-mail e senha."); }
    if (!invitationMode && !normalizedAgencyName) { setLoading(false); return setStatus("Informe o nome da imobiliária."); }
    if (!invitationMode && normalizedSlug.length < 3) { setLoading(false); return setStatus("Escolha um endereço com pelo menos 3 caracteres."); }
    if (!invitationMode && slugState === "unavailable") { setLoading(false); return setStatus("Este endereço já está em uso ou é reservado. Escolha outro."); }
    if (password.length < 8) { setLoading(false); return setStatus("Use uma senha com pelo menos 8 caracteres."); }
    if (password !== confirm) { setLoading(false); return setStatus("As senhas não conferem."); }

    if (!invitationMode) {
      const available = await supabaseBrowser.rpc("agency_slug_available", { p_slug: normalizedSlug });
      if (available.error || available.data !== true) {
        setLoading(false);
        setSlugState("unavailable");
        return setStatus("Este endereço não está disponível. Escolha outro.");
      }
    }

    const loginPath = window.location.pathname.replace(/cadastro\/?$/, "login/");
    const redirectTo = invitationMode
      ? `${window.location.origin}${loginPath}?redirect=${encodeURIComponent(redirect)}`
      : `${window.location.origin}${loginPath}`;
    const { data: signupData, error } = await supabaseBrowser.auth.signUp({
      email,
      password,
      options: {
        data: invitationMode ? {
          full_name: fullName,
          onboarding_kind: "invited_member",
        } : {
          full_name: fullName,
          onboarding_kind: "agency_owner",
          agency_name: normalizedAgencyName,
          agency_slug: normalizedSlug,
        },
        emailRedirectTo: redirectTo,
      },
    });
    setLoading(false);
    if (error) return setStatus(error.message);

    if (invitationMode) {
      if (signupData.session) {
        window.location.assign(redirect);
        return;
      }
      setStatus("Conta criada. Confirme seu e-mail e depois entre para aceitar o convite da imobiliária.");
      return;
    }
    setStatus(`Conta criada. Após confirmar o e-mail, sua imobiliária estará disponível em ${normalizedSlug}.imoveis.lenoy.com.br.`);
  }

  const loginHref = redirect ? `../login/?redirect=${encodeURIComponent(redirect)}` : "../login/";

  return (
    <form className="loginCard" onSubmit={submit}>
      <span className="eyebrow">{invitationMode ? "CONVITE PARA EQUIPE" : "COMECE SUA IMOBILIÁRIA DIGITAL"}</span>
      <h1>{invitationMode ? "Criar conta para aceitar convite" : "Criar minha imobiliária"}</h1>
      <p>{invitationMode ? "Crie apenas sua conta de acesso. A imobiliária do convite será vinculada depois que você entrar e aceitar o convite." : "Crie sua conta e receba automaticamente um site exclusivo dentro da plataforma."}</p>

      <label>Seu nome completo<input name="full_name" autoComplete="name" required maxLength={160} /></label>
      {!invitationMode ? <>
        <label>Nome da imobiliária<input name="agency_name" value={agencyName} onChange={(event) => setAgencyName(event.target.value)} placeholder="Ex.: João Imobiliária" required /></label>
        <label>Endereço do site
          <div className="slugField"><input name="agency_slug" value={agencySlug} onChange={(event) => { setSlugTouched(true); setAgencySlug(slugify(event.target.value)); }} placeholder="joao" required /><span>.imoveis.lenoy.com.br</span></div>
        </label>
        <small className={`slugHint ${slugState}`}>{slugState === "checking" ? "Verificando disponibilidade..." : slugState === "available" ? `Disponível: ${publicAddress}` : slugState === "unavailable" ? "Este endereço não está disponível." : `Seu site ficará em ${publicAddress}`}</small>
      </> : null}

      <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Confirmar senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="button primary full" type="submit" disabled={loading || (!invitationMode && slugState === "unavailable")}>{loading ? "Criando conta..." : invitationMode ? "Criar conta e continuar" : "Criar minha imobiliária"}</button>
      {status ? <p className="loginStatus">{status}</p> : null}
      <a className="backLink" href={loginHref}>← Já tenho acesso</a>
    </form>
  );
}
