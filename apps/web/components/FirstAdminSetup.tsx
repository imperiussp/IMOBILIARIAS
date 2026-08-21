"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

export default function FirstAdminSetup() {
  const [status, setStatus] = useState("Verificando configuração...");
  const [available, setAvailable] = useState(false);
  const [logged, setLogged] = useState(false);
  const [working, setWorking] = useState(false);

  async function check() {
    if (!isSupabaseConfigured || !supabaseBrowser) {
      setStatus("O Supabase exclusivo do IMOBILIARIAS ainda não está configurado.");
      return;
    }
    const session = await supabaseBrowser.auth.getSession();
    const hasSession = Boolean(session.data.session?.user);
    setLogged(hasSession);
    if (!hasSession) {
      setStatus("Entre com a conta que será o primeiro administrador.");
      return;
    }
    const { data, error } = await supabaseBrowser.rpc("initial_admin_available");
    if (error) return setStatus(error.message);
    setAvailable(Boolean(data));
    setStatus(data ? "Esta instalação ainda não possui administrador. Você pode assumir o primeiro acesso." : "O primeiro administrador já foi definido. Novos acessos devem ser liberados pelo painel.");
  }

  useEffect(() => { void check(); }, []);

  async function claim() {
    if (!supabaseBrowser) return;
    setWorking(true);
    const { error } = await supabaseBrowser.rpc("claim_initial_admin");
    setWorking(false);
    if (error) return setStatus(error.message);
    setAvailable(false);
    setStatus("Administrador inicial configurado com sucesso. O painel já está liberado para esta conta.");
  }

  return <div className="loginCard">
    <span className="eyebrow">CONFIGURAÇÃO INICIAL</span>
    <h1>Primeiro administrador</h1>
    <p>Esta etapa só funciona uma única vez, quando o IMOBILIARIAS ainda não possui nenhum administrador cadastrado.</p>
    <p className="loginStatus">{status}</p>
    {!logged && isSupabaseConfigured ? <a className="button primary full" href="../login/">Entrar primeiro</a> : null}
    {logged && available ? <button className="button primary full" onClick={() => void claim()} disabled={working}>{working ? "Configurando..." : "Definir esta conta como administrador"}</button> : null}
    {logged && !available ? <a className="button primary full" href="../admin/">Abrir painel</a> : null}
    <a className="backLink" href="../">← Voltar ao site</a>
  </div>;
}
