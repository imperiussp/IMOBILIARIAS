"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../../lib/supabaseBrowser";

export default function InvitationPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("Verificando convite...");
  const [working, setWorking] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const currentToken = new URLSearchParams(window.location.search).get("token") || "";
    setToken(currentToken);
    if (!currentToken) {
      setMessage("Este link não contém um convite válido.");
      return;
    }
    if (!supabaseBrowser) {
      setMessage("O sistema de convites será ativado quando o Supabase de produção estiver configurado.");
      return;
    }
    void supabaseBrowser.auth.getUser().then(({ data }) => {
      const active = Boolean(data.user);
      setLoggedIn(active);
      setMessage(active ? "Convite encontrado. Confirme para entrar na imobiliária." : "Faça login com o mesmo e-mail que recebeu o convite.");
    });
  }, []);

  async function accept() {
    if (!supabaseBrowser || !token) return;
    setWorking(true); setMessage("");
    const { data, error } = await supabaseBrowser.rpc("accept_agency_invitation", { p_token: token });
    setWorking(false);
    if (error) return setMessage(error.message);
    const result = Array.isArray(data) ? data[0] : null;
    setMessage(result?.agency_name ? `Acesso liberado para ${result.agency_name}. Redirecionando para o painel...` : "Convite aceito. Redirecionando para o painel...");
    window.setTimeout(() => { window.location.href = "../admin/"; }, 900);
  }

  const loginHref = token ? `../login/?redirect=${encodeURIComponent(`/convite/?token=${token}`)}` : "../login/";

  return <main className="accessPage">
    <section className="accessCard">
      <a className="brand accessBrand" href="../"><span className="brandMark">I</span><span>IMOBILIARIAS</span></a>
      <span className="eyebrow">CONVITE DE EQUIPE</span>
      <h1>Entrar em uma imobiliária</h1>
      <p>O convite fica vinculado ao e-mail informado pelo proprietário ou administrador da imobiliária.</p>
      {!isSupabaseConfigured ? <div className="formNotice">Modo demonstração.</div> : null}
      {message ? <div className="formMessage">{message}</div> : null}
      {token && loggedIn ? <button className="button primary" disabled={working} onClick={() => void accept()}>{working ? "Confirmando..." : "Aceitar convite"}</button> : null}
      {token && !loggedIn ? <a className="button primary" href={loginHref}>Fazer login para aceitar</a> : null}
      <a className="button secondary" href="../">Voltar ao site</a>
    </section>
  </main>;
}
