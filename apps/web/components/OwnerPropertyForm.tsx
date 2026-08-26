"use client";

import { FormEvent, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import { currentHostname } from "../lib/tenantResolver";
import { useSiteSettings } from "../lib/useSiteSettings";

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorMessage(code: string) {
  if (code.includes("agency_not_found") || code.includes("invalid_hostname")) return "Não foi possível identificar a imobiliária deste endereço.";
  if (code.includes("photo_required")) return "Envie pelo menos uma foto do imóvel.";
  if (code.includes("too_many_photos")) return `Envie no máximo ${MAX_PHOTOS} fotos.`;
  if (code.includes("invalid_photo_type")) return "As fotos devem estar em JPG, PNG ou WEBP.";
  if (code.includes("photo_too_large")) return "Cada foto pode ter no máximo 8 MB.";
  if (code.includes("missing_required_fields")) return "Preencha todos os campos obrigatórios.";
  return "Não foi possível enviar o imóvel agora. Confira os dados e tente novamente.";
}

export default function OwnerPropertyForm() {
  const settings = useSiteSettings();
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);

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
    if (String(data.get("website") || "").trim()) return;

    if (!isSupabaseConfigured || !supabaseBrowser) {
      setStatus("O envio online está indisponível neste momento.");
      return;
    }

    const required = ["name", "phone", "email", "address", "city", "state_code", "property_type", "purpose", "description"];
    if (required.some((key) => !String(data.get(key) || "").trim())) {
      setStatus("Preencha todos os campos obrigatórios.");
      return;
    }

    const files = data.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) return setStatus("Envie pelo menos uma foto do imóvel.");
    if (files.length > MAX_PHOTOS) return setStatus(`Envie no máximo ${MAX_PHOTOS} fotos.`);
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) return setStatus("As fotos devem estar em JPG, PNG ou WEBP.");
      if (file.size > MAX_PHOTO_BYTES) return setStatus("Cada foto pode ter no máximo 8 MB.");
    }

    const host = currentHostname();
    if (!host) return setStatus("Não foi possível identificar o endereço da imobiliária.");
    data.set("hostname", host);
    data.delete("website");

    setSending(true);
    setStatus("");
    const { data: response, error } = await supabaseBrowser.functions.invoke("submit-owner-property", { body: data });
    setSending(false);

    if (error || !response?.ok) {
      const raw = `${response?.error || ""} ${error?.message || ""}`.trim();
      setStatus(errorMessage(raw));
      return;
    }

    form.reset();
    setPhotoCount(0);
    setStatus("Imóvel enviado com sucesso. A imobiliária recebeu os dados e as fotos para avaliação.");
  }

  return <div className="ownerIntakeGrid">
    <div className="ownerPitch">
      <span className="eyebrow">PARA PROPRIETÁRIOS</span>
      <h2>Quer vender ou alugar seu imóvel?</h2>
      <p>Envie as informações e fotos do imóvel. A equipe avalia o cadastro antes de publicar o anúncio.</p>
      <div className="ownerBenefits"><span>✓ Dados completos do imóvel</span><span>✓ Fotos enviadas junto ao cadastro</span><span>✓ Aviso direto para a imobiliária</span><span>✓ Venda ou locação</span></div>
      {whatsappUrl ? <a className="button secondary" href={whatsappUrl} target="_blank" rel="noreferrer">Falar pelo WhatsApp</a> : null}
    </div>

    <form className="ownerForm ownerPropertyCompleteForm" onSubmit={submit}>
      <input className="contactTrap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="formGrid"><label>Seu nome<input name="name" required maxLength={160} autoComplete="name" /></label><label>WhatsApp<input name="phone" inputMode="tel" required maxLength={40} autoComplete="tel" /></label></div>
      <label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>

      <label>Endereço do imóvel<input name="address" required maxLength={500} placeholder="Rua, número e complemento" /></label>
      <div className="formGrid three"><label>Bairro<input name="neighborhood" maxLength={160} /></label><label>Cidade<input name="city" required maxLength={160} /></label><label>UF<input name="state_code" required maxLength={2} minLength={2} placeholder="PR" style={{ textTransform: "uppercase" }} /></label></div>

      <div className="formGrid"><label>Tipo de imóvel<select name="property_type" defaultValue="" required><option value="" disabled>Selecione</option><option value="Casa">Casa</option><option value="Apartamento">Apartamento</option><option value="Terreno">Terreno</option><option value="Comercial">Comercial</option><option value="Rural">Rural</option><option value="Outro">Outro</option></select></label><label>Finalidade<select name="purpose" defaultValue="" required><option value="" disabled>Selecione</option><option value="sale">Venda</option><option value="rent">Locação</option><option value="both">Venda ou locação</option></select></label></div>

      <div className="formGrid three"><label>Quartos<input name="bedrooms" type="number" min="0" inputMode="numeric" /></label><label>Banheiros<input name="bathrooms" type="number" min="0" inputMode="numeric" /></label><label>Garagens<input name="garages" type="number" min="0" inputMode="numeric" /></label></div>
      <div className="formGrid"><label>Área aproximada (m²)<input name="area_m2" inputMode="decimal" placeholder="Ex.: 120" /></label><label>Valor pretendido<input name="requested_price" inputMode="decimal" placeholder="Ex.: 350000" /></label></div>
      <label>Pode financiar pela Caixa?<select name="caixa_financeable" defaultValue=""><option value="">Não sei informar</option><option value="yes">Sim</option><option value="no">Não</option><option value="other">Precisa avaliar</option></select></label>

      <label>Descrição do imóvel<textarea name="description" rows={5} required maxLength={3000} placeholder="Conte os principais detalhes, estado de conservação, diferenciais e demais informações úteis." /></label>
      <label className="ownerPhotoField">Fotos do imóvel<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => setPhotoCount(event.currentTarget.files?.length || 0)} /><small>{photoCount ? `${photoCount} foto(s) selecionada(s).` : `Envie de 1 a ${MAX_PHOTOS} fotos em JPG, PNG ou WEBP, até 8 MB cada.`}</small></label>

      <button className="button primary" disabled={sending}>{sending ? "Enviando imóvel..." : "Enviar imóvel para avaliação"}</button>
      {status ? <div className="formMessage" role="status">{status}</div> : null}
    </form>
  </div>;
}
