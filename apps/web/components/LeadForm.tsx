"use client";

import { FormEvent, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Props = {
  propertyCode: string;
  propertyTitle: string;
  whatsappUrl: string;
};

export default function LeadForm({ propertyCode, propertyTitle, whatsappUrl }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const text = String(form.get("message") || "").trim();

    if (!name || !phone) {
      setStatus("error");
      setMessage("Informe nome e telefone para continuar.");
      return;
    }

    if (!isSupabaseConfigured || !supabaseBrowser) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setStatus("sending");
    setMessage("");
    const { error } = await supabaseBrowser.from("leads").insert({
      name,
      phone,
      message: text || `Interesse no imóvel ${propertyCode} - ${propertyTitle}`,
      source: "property_page",
    });

    if (error) {
      setStatus("error");
      setMessage("Não foi possível registrar agora. Você ainda pode usar o WhatsApp.");
      return;
    }

    setStatus("sent");
    setMessage("Contato enviado. O corretor poderá retornar por este número.");
    event.currentTarget.reset();
  }

  return (
    <form className="leadForm" onSubmit={handleSubmit}>
      <label>Seu nome<input name="name" placeholder="Nome" autoComplete="name" /></label>
      <label>Telefone / WhatsApp<input name="phone" placeholder="(00) 00000-0000" inputMode="tel" autoComplete="tel" /></label>
      <label>Mensagem<textarea name="message" rows={3} placeholder={`Tenho interesse no ${propertyCode}`} /></label>
      <button className="button primary full" type="submit" disabled={status === "sending"}>{status === "sending" ? "Enviando..." : "Solicitar contato"}</button>
      {message ? <p className={status === "error" ? "formMessage error" : "formMessage"}>{message}</p> : null}
      <a className="button whatsapp full" href={whatsappUrl} target="_blank" rel="noreferrer">Conversar no WhatsApp</a>
    </form>
  );
}
