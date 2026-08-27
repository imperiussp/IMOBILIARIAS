"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

function fileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export default function AdminHeroBackgroundEditorMount() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [agencyId, setAgencyId] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.location.pathname.includes("/admin")) return;
    let disposed = false;
    let observer: MutationObserver | null = null;

    const mount = () => {
      if (disposed) return true;
      const form = document.querySelector<HTMLElement>("#configuracoes form.propertyForm");
      if (!form) return false;
      let target = form.querySelector<HTMLElement>(":scope > .adminHeroBackgroundEditorHost");
      if (!target) {
        target = document.createElement("div");
        target.className = "adminHeroBackgroundEditorHost";
        const logoUpload = form.querySelector<HTMLElement>(".brandingUpload");
        const logoSection = logoUpload?.parentElement;
        if (logoSection?.parentElement === form) logoSection.insertAdjacentElement("afterend", target);
        else form.prepend(target);
      }
      setHost(target);
      return true;
    };

    if (!mount()) {
      observer = new MutationObserver(() => {
        if (mount()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!supabaseBrowser || typeof window === "undefined" || !window.location.pathname.includes("/admin")) return;
    let active = true;
    void (async () => {
      const currentAgency = await getCurrentAgency();
      if (!active || !currentAgency) return;
      setAgencyId(currentAgency.agencyId);
      const result = await supabaseBrowser.rpc("resolve_agency_hero_background", { p_agency_id: currentAgency.agencyId });
      if (!active) return;
      if (result.error) setMessage(result.error.message);
      else setBackgroundUrl(String(result.data || "").trim());
    })();
    return () => { active = false; };
  }, []);

  async function publishUrl(url: string) {
    if (!supabaseBrowser || !agencyId) return false;
    const result = await supabaseBrowser.rpc("set_agency_hero_background", { p_agency_id: agencyId, p_url: url });
    if (result.error) {
      setMessage(result.error.message);
      return false;
    }
    setBackgroundUrl(url);
    window.dispatchEvent(new CustomEvent("lenoy:hero-background-changed", { detail: { url } }));
    return true;
  }

  async function uploadBackground(files: FileList | null) {
    if (!supabaseBrowser || !agencyId || !files?.length) return;
    const file = files[0];
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Envie a imagem em JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("A imagem de fundo pode ter no máximo 5 MB.");
      return;
    }

    setUploading(true);
    setMessage("");
    const path = `${agencyId}/branding/background-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExtension(file)}`;
    const upload = await supabaseBrowser.storage.from("agency-branding").upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "31536000",
    });
    if (upload.error) {
      setUploading(false);
      setMessage(upload.error.message);
      return;
    }

    const publicUrl = supabaseBrowser.storage.from("agency-branding").getPublicUrl(path).data.publicUrl;
    const published = await publishUrl(publicUrl);
    setUploading(false);
    if (published) setMessage("Imagem de fundo publicada no site.");
  }

  async function removeBackground() {
    if (!agencyId || uploading) return;
    setUploading(true);
    setMessage("");
    const published = await publishUrl("");
    setUploading(false);
    if (published) setMessage("Imagem personalizada removida. O site voltou ao fundo padrão.");
  }

  if (!host) return null;

  return createPortal(
    <section className="heroBackgroundEditor" aria-label="Imagem de fundo da capa do site">
      <div className="heroBackgroundEditorCopy">
        <span className="eyebrow">CAPA DO SITE</span>
        <strong>Imagem de fundo</strong>
        <p>O proprietário, administrador ou corretor ativo pode trocar esta imagem sem alterar as outras configurações da imobiliária.</p>
        <div className="heroBackgroundInstructions">
          <b>Imagem recomendada: 1920 × 1080 px (16:9).</b>
          <span>JPG ou WEBP são preferenciais; PNG também é aceito. Máximo de 5 MB.</span>
          <span>Mantenha imóvel, pessoas, logo ou outros elementos importantes no centro: no celular as laterais da imagem podem ser recortadas.</span>
        </div>
      </div>

      <div className="heroBackgroundEditorMedia">
        <div className={`heroBackgroundPreview ${backgroundUrl ? "hasImage" : ""}`}>
          {backgroundUrl ? <img src={backgroundUrl} alt="Prévia da imagem de fundo atual" /> : <span>Fundo padrão do site</span>}
        </div>
        <div className="heroBackgroundEditorActions">
          <label className="button secondary heroBackgroundChooseButton">
            {uploading ? "Enviando..." : backgroundUrl ? "Trocar imagem" : "Escolher imagem"}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || !agencyId} onChange={(event) => { void uploadBackground(event.target.files); event.currentTarget.value = ""; }} />
          </label>
          {backgroundUrl ? <button className="miniButton" type="button" disabled={uploading} onClick={() => void removeBackground()}>Remover imagem</button> : null}
        </div>
      </div>
      {message ? <div className="formMessage heroBackgroundMessage">{message}</div> : null}
    </section>,
    host,
  );
}
