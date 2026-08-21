"use client";

import { FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import { defaultSiteSettings, type SiteSettings } from "../lib/useSiteSettings";

export default function AdminSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabaseBrowser) return;
    void supabaseBrowser.from("site_settings").select("agency_name,tagline,phone,whatsapp,email,address,company_creci,logo_url").eq("id", 1).maybeSingle().then(({ data, error }) => {
      if (error) setMessage(error.message);
      else if (data) setSettings({ ...defaultSiteSettings, ...data } as SiteSettings);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado.");
    setSaving(true); setMessage("");
    const payload = {
      id: 1,
      agency_name: settings.agency_name.trim() || "IMOBILIARIAS",
      tagline: settings.tagline.trim() || defaultSiteSettings.tagline,
      phone: settings.phone?.trim() || null,
      whatsapp: settings.whatsapp?.replace(/\D/g, "") || null,
      email: settings.email?.trim() || null,
      address: settings.address?.trim() || null,
      company_creci: settings.company_creci?.trim() || null,
      logo_url: settings.logo_url?.trim() || null,
    };
    const { error } = await supabaseBrowser.from("site_settings").upsert(payload, { onConflict: "id" });
    setSaving(false);
    setMessage(error ? error.message : "Dados públicos da imobiliária atualizados.");
  }

  return <div className="adminPanel" id="configuracoes">
    <div className="adminPanelHeader"><div><span className="eyebrow">IDENTIDADE</span><h2>Dados da imobiliária</h2><p>Nome, contato e identificação usados no site público.</p></div><span>{isSupabaseConfigured ? "Configuração ativa" : "Modo demonstração"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">Esses dados serão gravados quando o Supabase exclusivo do IMOBILIARIAS estiver conectado.</div> : null}
    <form className="propertyForm" onSubmit={submit}>
      <div className="formGrid"><label>Nome da imobiliária<input value={settings.agency_name} onChange={(e) => setSettings({ ...settings, agency_name: e.target.value })} /></label><label>CRECI da empresa<input value={settings.company_creci || ""} onChange={(e) => setSettings({ ...settings, company_creci: e.target.value })} placeholder="CRECI Jurídico, se houver" /></label></div>
      <label>Slogan<input value={settings.tagline} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} /></label>
      <div className="formGrid three"><label>Telefone<input value={settings.phone || ""} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label><label>WhatsApp<input value={settings.whatsapp || ""} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} /></label><label>E-mail<input type="email" value={settings.email || ""} onChange={(e) => setSettings({ ...settings, email: e.target.value })} /></label></div>
      <label>Endereço da imobiliária<input value={settings.address || ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label>
      <label>URL do logotipo<input value={settings.logo_url || ""} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })} placeholder="https://.../logo.png" /></label>
      {message ? <div className="formMessage">{message}</div> : null}
      <div className="formActions"><button className="button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar dados da imobiliária"}</button></div>
    </form>
  </div>;
}
