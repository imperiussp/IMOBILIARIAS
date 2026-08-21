"use client";

import { FormEvent, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import { resolveCurrentTenant } from "../lib/tenantResolver";
import { useSiteSettings } from "../lib/useSiteSettings";

export default function GeneralContactForm() {
  const settings = useSiteSettings();
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const whatsappUrl = useMemo(() => {
    const raw = settings.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "";
    const number = raw.replace(/\D/g, "");
    return number ? `https://wa.me/${number}?text=${encodeURIComponent("Olá, gostaria de falar com a imobiliária.")}` : "";
  }, [settings.whatsapp]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const email = String(data.get("email") || "").trim();
    const message = String(data.get("message") || "").trim();
    const trap = String(data.get("company") || "").trim();
    if (trap) return;
    if (!name || (!phone && !email) || !message) {
      setStatus("Informe nome, uma forma de contato e a mensagem.");
      return;
    }
    if (!isSupabaseConfigured || !supabaseBrowser) {
      setStatus(whatsappUrl ? "O formulário online ainda não está ativo. Use o WhatsApp ao lado." : "O atendimento online será ativado com a configuração do sistema.");
      return;
    }
    setSending(true);
    const tenant = await resolveCurrentTenant();
    if (!tenant) {
      setSending(false);
      setStatus("Não foi possível identificar a imobiliária deste endereço. Use o WhatsApp para atendimento.");
      return;
    }
    const { error } = await supabaseBrowser.from("leads").insert({
      agency_id: tenant.agency_id,
      name,
      phone: phone || null,
      email: email || null,
      message,
      source: "web-general-contact",
    });
    setSending(false);
    if (error) return setStatus("Não foi possível enviar agora. Tente pelo WhatsApp.");
    form.reset();
    setStatus("Mensagem enviada. A equipe poderá retornar pelos dados informados.");
  }

  return <div className="generalContactGrid">
    <form className="generalContactForm" onSubmit={submit}>
      <input className="contactTrap" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="formGrid"><label>Nome<input name="name" required /></label><label>Telefone<input name="phone" inputMode="tel" /></label></div>
      <label>E-mail<input name="email" type="email" /></label>
      <label>Mensagem<textarea name="message" rows={4} required placeholder="Como podemos ajudar?" /></label>
      <button className="button primary" disabled={sending}>{sending ? "Enviando..." : "Enviar mensagem"}</button>
      {status ? <div className="formMessage">{status}</div> : null}
    </form>
    <div className="generalContactAside"><strong>Prefere falar agora?</strong><p>Use o atendimento direto pelo WhatsApp.</p>{whatsappUrl ? <a className="button whatsapp full" target="_blank" rel="noreferrer" href={whatsappUrl}>Abrir WhatsApp</a> : <span>WhatsApp será exibido após a configuração da imobiliária.</span>}</div>
  </div>;
}
