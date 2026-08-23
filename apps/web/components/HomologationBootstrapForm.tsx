"use client";

import { FormEvent, useMemo, useState } from "react";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-").slice(0, 48);
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(`${label} demorou mais de ${Math.round(ms / 1000)} segundos.`)), ms)),
  ]);
}

export default function HomologationBootstrapForm() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [agencySlug, setAgencySlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const publicAddress = useMemo(() => `${agencySlug || "sua-imobiliaria"}.imoveis.lenoy.com.br`, [agencySlug]);

  function changeAgencyName(value: string) {
    setAgencyName(value);
    if (!slugTouched) setAgencySlug(slugify(value));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    if (!isSupabaseConfigured || !supabaseBrowser) return setStatus("Supabase do IMOBILIÁRIAS não configurado.");

    setLoading(true);
    try {
      setStatus("1/3 — Validando backend...");
      const validBackend = Boolean(await withTimeout(isImobiliariasBackend(), 10000, "Validação do backend"));
      if (!validBackend) return setStatus("Conexão bloqueada: backend diferente do IMOBILIÁRIAS.");

      const form = new FormData(event.currentTarget);
      const fullName = String(form.get("full_name") || "").trim();
      const email = String(form.get("email") || "").trim().toLowerCase();
      const password = String(form.get("password") || "");
      const confirm = String(form.get("confirm") || "");
      const bootstrapToken = String(form.get("bootstrap_token") || "").trim();
      const normalizedName = agencyName.trim();
      const normalizedSlug = slugify(agencySlug);

      if (!fullName || !email || !normalizedName || !normalizedSlug || !bootstrapToken) return setStatus("Preencha todos os campos.");
      if (normalizedSlug.length < 3) return setStatus("O endereço precisa ter pelo menos 3 caracteres.");
      if (password.length < 8) return setStatus("Use uma senha com pelo menos 8 caracteres.");
      if (password !== confirm) return setStatus("As senhas não conferem.");

      setStatus("2/3 — Verificando endereço da imobiliária...");
      const available = await withTimeout(
        supabaseBrowser.rpc("agency_slug_available", { p_slug: normalizedSlug }),
        10000,
        "Verificação do endereço",
      );
      if (available.error || available.data !== true) return setStatus("Este endereço não está disponível. Escolha outro.");

      const loginPath = window.location.pathname.replace(/homologacao-bootstrap\/?$/, "login/");
      setStatus("3/3 — Criando conta no Supabase Auth...");
      const { data, error } = await withTimeout(
        supabaseBrowser.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              onboarding_kind: "agency_owner",
              agency_name: normalizedName,
              agency_slug: normalizedSlug,
              bootstrap_token: bootstrapToken,
            },
            emailRedirectTo: `${window.location.origin}${loginPath}`,
          },
        }),
        20000,
        "Criação da conta",
      );
      if (error) return setStatus(`Falha ao criar conta: ${error.message}`);

      if (data.session) {
        setStatus(`Conta criada e autenticada. Imobiliária: ${publicAddress}.`);
        window.setTimeout(() => window.location.assign("../admin/"), 900);
        return;
      }
      setStatus(`Conta criada. Confirme o e-mail e depois entre. Imobiliária: ${publicAddress}. O token foi consumido e não pode ser reutilizado.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Não foi possível concluir: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="loginCard" onSubmit={submit}>
      <span className="eyebrow">HOMOLOGAÇÃO CONTROLADA</span>
      <h1>Criar owner de teste</h1>
      <p>Esta tela não abre o cadastro público. O banco exige um token temporário de uso único e o consome ao criar a conta.</p>
      <label>Token temporário<input name="bootstrap_token" type="password" autoComplete="off" required /></label>
      <label>Seu nome completo<input name="full_name" autoComplete="name" required maxLength={160} /></label>
      <label>Nome da imobiliária<input value={agencyName} onChange={(e) => changeAgencyName(e.target.value)} required /></label>
      <label>Endereço do site<div className="slugField"><input value={agencySlug} onChange={(e) => { setSlugTouched(true); setAgencySlug(slugify(e.target.value)); }} required /><span>.imoveis.lenoy.com.br</span></div></label>
      <small className="slugHint">Tenant de teste: {publicAddress}</small>
      <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Confirmar senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="button primary full" type="submit" disabled={loading}>{loading ? "Processando..." : "Criar conta de homologação"}</button>
      {status ? <p className="loginStatus" aria-live="polite">{status}</p> : null}
      <a className="backLink" href="../login/">← Voltar ao login</a>
    </form>
  );
}
