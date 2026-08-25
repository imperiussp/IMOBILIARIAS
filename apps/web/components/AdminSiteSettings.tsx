"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import { defaultSiteSettings, type SiteSettings } from "../lib/useSiteSettings";

type PresetId = NonNullable<SiteSettings["theme_preset"]>;
type ButtonStyle = NonNullable<SiteSettings["button_style"]>;

const presets: Array<{ id: PresetId; name: string; description: string; primary: string; secondary: string; background: string; text: string }> = [
  { id: "classic", name: "Clássico", description: "Sóbrio e imobiliário", primary: "#17202a", secondary: "#d6ac58", background: "#f7f8fa", text: "#18212b" },
  { id: "modern", name: "Moderno", description: "Contraste limpo", primary: "#123c69", secondary: "#2a9d8f", background: "#f4f8fb", text: "#102a43" },
  { id: "elegant", name: "Elegante", description: "Visual premium", primary: "#2d2438", secondary: "#b48a56", background: "#f8f5f1", text: "#241f29" },
  { id: "minimal", name: "Minimalista", description: "Leve e direto", primary: "#202124", secondary: "#6b7280", background: "#ffffff", text: "#202124" },
];

function validHex(value: string | null | undefined, fallback: string) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function fileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export default function AdminSiteSettings() {
  const [agencyId, setAgencyId] = useState("");
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (!supabaseBrowser) return;
    let active = true;
    void (async () => {
      const currentAgency = await getCurrentAgency();
      if (!active) return;
      if (!currentAgency) {
        setMessage("Não foi possível identificar a imobiliária desta conta.");
        return;
      }
      setAgencyId(currentAgency.agencyId);
      const { data, error } = await supabaseBrowser
        .from("agencies")
        .select("name,tagline,phone,whatsapp,email,address,company_creci,logo_url,primary_color,secondary_color,background_color,text_color,theme_preset,button_style")
        .eq("id", currentAgency.agencyId)
        .maybeSingle();
      if (!active) return;
      if (error) setMessage(error.message);
      else if (data) setSettings({
        ...defaultSiteSettings,
        agency_name: data.name,
        tagline: data.tagline || defaultSiteSettings.tagline,
        phone: data.phone,
        whatsapp: data.whatsapp,
        email: data.email,
        address: data.address,
        company_creci: data.company_creci,
        logo_url: data.logo_url,
        agency_id: currentAgency.agencyId,
        primary_color: data.primary_color || defaultSiteSettings.primary_color,
        secondary_color: data.secondary_color || defaultSiteSettings.secondary_color,
        background_color: data.background_color || defaultSiteSettings.background_color,
        text_color: data.text_color || defaultSiteSettings.text_color,
        theme_preset: (data.theme_preset as SiteSettings["theme_preset"]) || defaultSiteSettings.theme_preset,
        button_style: (data.button_style as SiteSettings["button_style"]) || defaultSiteSettings.button_style,
      });
    })();
    return () => { active = false; };
  }, []);

  const preview = useMemo(() => {
    const primary = validHex(settings.primary_color, "#17202a");
    const secondary = validHex(settings.secondary_color, "#d6ac58");
    const background = validHex(settings.background_color, "#f7f8fa");
    const text = validHex(settings.text_color, "#18212b");
    const radius = settings.button_style === "pill" ? 999 : settings.button_style === "square" ? 5 : 12;
    return { primary, secondary, background, text, radius };
  }, [settings.primary_color, settings.secondary_color, settings.background_color, settings.text_color, settings.button_style]);

  function applyPreset(id: PresetId) {
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    setSettings((current) => ({
      ...current,
      theme_preset: id,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
      background_color: preset.background,
      text_color: preset.text,
    }));
  }

  async function uploadLogo(files: FileList | null) {
    if (!supabaseBrowser || !agencyId || !files?.length) return;
    const file = files[0];
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setMessage("Envie a logo em JPG, PNG ou WEBP.");
    if (file.size > 5 * 1024 * 1024) return setMessage("A logo pode ter no máximo 5 MB.");
    setUploadingLogo(true); setMessage("");
    const path = `${agencyId}/branding/logo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExtension(file)}`;
    const upload = await supabaseBrowser.storage.from("agency-branding").upload(path, file, { upsert: false, contentType: file.type, cacheControl: "31536000" });
    if (upload.error) {
      setUploadingLogo(false);
      return setMessage(upload.error.message);
    }
    const publicUrl = supabaseBrowser.storage.from("agency-branding").getPublicUrl(path).data.publicUrl;
    setSettings((current) => ({ ...current, logo_url: publicUrl }));
    setUploadingLogo(false);
    setMessage("Logo carregada. Clique em Publicar alterações para aplicá-la ao site e ao aplicativo.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado.");
    if (!agencyId) return setMessage("Não foi possível identificar a imobiliária desta conta.");
    const colors = [settings.primary_color, settings.secondary_color, settings.background_color, settings.text_color];
    if (colors.some((value) => !/^#[0-9a-f]{6}$/i.test(String(value || "")))) return setMessage("As quatro cores precisam estar no formato hexadecimal, por exemplo #17202a.");
    setSaving(true); setMessage("");
    const payload = {
      name: settings.agency_name.trim() || "IMOBILIÁRIA",
      tagline: settings.tagline.trim() || defaultSiteSettings.tagline,
      phone: settings.phone?.trim() || null,
      whatsapp: settings.whatsapp?.replace(/\D/g, "") || null,
      email: settings.email?.trim() || null,
      address: settings.address?.trim() || null,
      company_creci: settings.company_creci?.trim() || null,
      logo_url: settings.logo_url?.trim() || null,
      primary_color: settings.primary_color?.trim() || null,
      secondary_color: settings.secondary_color?.trim() || null,
      background_color: settings.background_color?.trim() || null,
      text_color: settings.text_color?.trim() || null,
      theme_preset: settings.theme_preset || "classic",
      button_style: settings.button_style || "rounded",
    };
    const { error } = await supabaseBrowser.from("agencies").update(payload).eq("id", agencyId);
    setSaving(false);
    setMessage(error ? error.message : "Identidade publicada. Site e aplicativo passarão a usar esta configuração.");
  }

  const previewButtonStyle: CSSProperties = { background: preview.primary, borderRadius: preview.radius };

  return <div className="adminPanel" id="configuracoes">
    <div className="adminPanelHeader"><div><span className="eyebrow">IDENTIDADE E APARÊNCIA</span><h2>Sua marca no site e no aplicativo</h2><p>Configure uma vez. Logo, cores e estilo passam a identificar a imobiliária em todos os ambientes.</p></div><span>{isSupabaseConfigured ? "Identidade compartilhada" : "Modo demonstração"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">Esses dados serão gravados quando o Supabase exclusivo do IMOBILIARIAS estiver conectado.</div> : null}
    <form className="propertyForm" onSubmit={submit}>
      <div className="formGrid"><label>Nome da imobiliária<input value={settings.agency_name} onChange={(e) => setSettings({ ...settings, agency_name: e.target.value })} /></label><label>CRECI da empresa<input value={settings.company_creci || ""} onChange={(e) => setSettings({ ...settings, company_creci: e.target.value })} placeholder="CRECI Jurídico, se houver" /></label></div>
      <label>Slogan<input value={settings.tagline} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} /></label>

      <div>
        <label style={{ marginBottom: 9 }}>Logo da imobiliária</label>
        <div className="brandingUpload">
          <div className="brandingUploadPreview">{settings.logo_url ? <img src={settings.logo_url} alt="Prévia da logo" /> : <span>{settings.agency_name.slice(0, 1).toUpperCase()}</span>}</div>
          <div className="brandingUploadText"><strong>Envie a imagem diretamente</strong><small>PNG, JPG ou WEBP · máximo de 5 MB. A logo não muda até você publicar.</small><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingLogo} onChange={(event) => { void uploadLogo(event.target.files); event.currentTarget.value = ""; }} /></div>
        </div>
      </div>

      <div><label style={{ marginBottom: 9 }}>Escolha um estilo inicial</label><div className="themePresetGrid">{presets.map((preset) => <button key={preset.id} type="button" className={`themePresetButton ${settings.theme_preset === preset.id ? "active" : ""}`} onClick={() => applyPreset(preset.id)}><strong>{preset.name}</strong><span>{preset.description}</span></button>)}</div></div>

      <div className="themeColorGrid">
        {([
          ["Cor principal", "primary_color", preview.primary],
          ["Cor de destaque", "secondary_color", preview.secondary],
          ["Fundo", "background_color", preview.background],
          ["Texto", "text_color", preview.text],
        ] as const).map(([label, key, color]) => <label className="themeColorField" key={key}>{label}<div className="themeColorControl"><input type="color" value={color} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} /><input type="text" value={String(settings[key] || "")} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} /></div></label>)}
      </div>

      <div><label style={{ marginBottom: 9 }}>Estilo dos botões</label><div className="choiceBar">{(["rounded", "pill", "square"] as ButtonStyle[]).map((style) => <button type="button" key={style} className={`miniButton ${settings.button_style === style ? "active" : ""}`} onClick={() => setSettings({ ...settings, button_style: style })}>{style === "rounded" ? "Arredondado" : style === "pill" ? "Pílula" : "Reto"}</button>)}</div></div>

      <div className="themePreview" style={{ background: preview.background, color: preview.text }}>
        <div className="themePreviewTop" style={{ borderBottom: `1px solid ${preview.secondary}44` }}><div className="themePreviewBrand">{settings.logo_url ? <img className="themePreviewLogo" src={settings.logo_url} alt="" /> : <span className="themePreviewMark" style={{ background: preview.primary }}>{settings.agency_name.slice(0, 1).toUpperCase()}</span>}<div><strong>{settings.agency_name || "Sua imobiliária"}</strong><small>{settings.company_creci || "Identidade da imobiliária"}</small></div></div><span style={{ color: preview.primary, fontWeight: 900 }}>Imóveis</span></div>
        <div className="themePreviewHero"><div><span style={{ color: preview.secondary, fontWeight: 900, fontSize: 11 }}>PRÉ-VISUALIZAÇÃO</span><h3>Seu site com a sua identidade.</h3><p>{settings.tagline || defaultSiteSettings.tagline}</p></div><span className="themePreviewButton" style={previewButtonStyle}>Ver imóveis</span></div>
      </div>
      <p className="themePublishNote">As mudanças acima são apenas uma prévia enquanto você edita. Elas só passam para o site e para o aplicativo ao clicar em Publicar alterações.</p>

      <div className="formGrid three"><label>Telefone<input value={settings.phone || ""} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label><label>WhatsApp<input value={settings.whatsapp || ""} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} /></label><label>E-mail público de contato<input type="email" value={settings.email || ""} onChange={(e) => setSettings({ ...settings, email: e.target.value })} /></label></div>
      <label>Endereço da imobiliária<input value={settings.address || ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label>
      {message ? <div className="formMessage">{message}</div> : null}
      <div className="formActions"><button className="button secondary" type="button" onClick={() => applyPreset("classic")}>Restaurar tema clássico</button><button className="button primary" disabled={saving || uploadingLogo}>{saving ? "Publicando..." : "Publicar alterações"}</button></div>
    </form>
  </div>;
}
