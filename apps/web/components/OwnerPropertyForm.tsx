"use client";

import { FormEvent, useMemo, useState } from "react";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import { useSiteSettings } from "../lib/useSiteSettings";

export default function OwnerPropertyForm() {
  const settings = useSiteSettings();
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const whatsappUrl = useMemo(() => {
    const raw = settings.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "";
    const number = raw.replace(/\D/g, "");
    const text = encodeURIComponent("Olá, gostaria de anunciar um imóvel com a imobiliária.");
    return number ? `https://wa.me/${number}?text=${text}` : "";
  }, [settings.whatsapp]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const trap = String(data.get("website") || "").trim();
    if (trap) return;
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const city = String(data.get("city") || "").trim();
    const type = String(data.get("type") || "").trim();
    const purpose = String(data.get("purpose") || "").trim();
    const notes = String(data.get("notes") || "").trim();
    if (!name || !phone || !city || !type || !purpose) {
      setStatus("Preencha nome, telefone, cidade, tipo e finalidade do imóvel.");
      return;
    }
    const message = [
      "PROPRIETÁRIO QUER ANUNCIAR IMÓVEL",
      `Cidade: ${city}`,
      `Tipo: ${type}`,
      `Finalidade: ${purpose}`,
      notes ? `Observações: ${notes}` : "",
    ].filter(Boolean).join("\n");

    if (!isSupabaseConfigured || !supabaseBrowser) {
      setStatus(whatsappUrl ? "O cadastro online será ativado com o banco. Enquanto isso, use o WhatsApp." : "O cadastro será ativado com a configuração do sistema.");
      return;
    }
    setSending(true);
    const validBackend = await isImobiliariasBackend();
    if (!validBackend) {
      setSending(false);
      setStatus("Envio bloqueado: o backend configurado não pertence ao IMOBILIARIAS.");
      return;
    }
    const { error } = await supabaseBrowser.from("leads").insert({
      name,
      phone,
      email: null,
      message,
      source: "web-owner-property",
    });
    setSending(false);
    if (error) {
      setStatus("Não foi possível enviar agora. Use o WhatsApp.");
      return;
    }
    form.reset();
    setStatus("Recebemos os dados do imóvel. A equipe poderá entrar em contato pelo telefone informado.");
  }

  return <div className="ownerIntakeGrid">
    <div className="ownerPitch">
      <span className="eyebrow">PARA PROPRIETÁRIOS</span>
      <h2>Quer vender ou alugar seu imóvel?</h2>
      <p>Envie os dados básicos. A equipe avalia o cadastro e entra em contato antes da publicação.</p>
      <div className="ownerBenefits"><span>✓ Cadastro organizado</span><span>✓ Atendimento por corretor</span><span>✓ Fotos e anúncio centralizados</span><span>✓ Venda ou locação</span></div>
      {whatsappUrl ? <a className="button secondary" href={whatsappUrl} target="_blank" rel="noreferrer">Enviar pelo WhatsApp</a> : null}
    </div>
    <form className="ownerForm" onSubmit={submit}>
      <input className="contactTrap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="formGrid"><label>Seu nome<input name="name" required /></label><label>WhatsApp<input name="phone" inputMode="tel" required /></label></div>
      <div className="formGrid"><label>Cidade do imóvel<input name="city" placeholder="Cidade - UF" required /></label><label>Tipo<select name="type" defaultValue="" required><option value="" disabled>Selecione</option><option>Casa</option><option>Apartamento</option><option>Terreno</option><option>Comercial</option><option>Rural</option><option>Outro</option></select></label></div>
      <label>O que deseja fazer?<select name="purpose" defaultValue="" required><option value="" disabled>Selecione</option><option>Vender</option><option>Alugar</option><option>Vender ou alugar</option></select></label>
      <label>Observações<textarea name="notes" rows={4} placeholder="Bairro, área aproximada, número de quartos ou outras informações." /></label>
      <button className="button primary" disabled={sending}>{sending ? "Enviando..." : "Quero anunciar meu imóvel"}</button>
      {status ? <div className="formMessage">{status}</div> : null}
    </form>
  </div>;
}
