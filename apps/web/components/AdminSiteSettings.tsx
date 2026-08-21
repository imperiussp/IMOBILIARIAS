"use client";

import { FormEvent, useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import { defaultSiteSettings, type SiteSettings } from "../lib/useSiteSettings";

export default function AdminSiteSettings() {
  const [agencyId, setAgencyId] = useState("");
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

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
        .select("name,tagline,phone,whatsapp,email,address,company_creci,logo_url,primary_color,secondary_color")
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
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
      });
    })();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return setMessage("Supabase ainda não configurado.");
    if (!agencyId) return setMessage("Não foi possível identificar a imobiliária desta conta.");
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
    };
    const { error } = await supabaseBrowser.from("agencies").update(payload).eq("id", agencyId);
    setSaving(false);
    setMessage(error ? error.message : "Identidade pública da imobiliária atualizada.");
  }

  return <div className="adminPanel" id="configuracoes">
    <div className="adminPanelHeader"><div><span className="eyebrow">IDENTIDADE</span><h2>Dados da imobiliária</h2><p>Nome, marca, contatos e cores usados somente no site desta imobiliária.</p></div><span>{isSupabaseConfigured ? "Configuração do tenant" : "Modo demonstração"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">Esses dados serão gravados quando o Supabase exclusivo do IMOBILIARIAS estiver conectado.</div> : null}
    <form className="propertyForm" onSubmit={submit}>
      <div className="formGrid"><label>Nome da imobiliária<input value={settings.agency_name} onChange={(e) => setSettings({ ...settings, agency_name: e.target.value })} /></label><label>CRECI da empresa<input value={settings.company_creci || ""} onChange={(e) => setSettings({ ...settings, company_creci: e.target.value })} placeholder="CRECI Jurídico, se houver" /></label></div>
      <label>Slogan<input value={settings.tagline} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} /></label>
      <div className="formGrid three"><label>Telefone<input value={settings.phone || ""} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label><label>WhatsApp<input value={settings.whatsapp || ""} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} /></label><label>E-mail<input type="email" value={settings.email || ""} onChange={(e) => setSettings({ ...settings, email: e.target.value })} /></label></div>
      <label>Endereço da imobiliária<input value={settings.address || ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label>
      <label>URL do logotipo<input value={settings.logo_url || ""} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })} placeholder="https://.../logo.png" /></label>
      <div className="formGrid"><label>Cor principal<input value={settings.primary_color || ""} onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })} placeholder="#17202a" /></label><label>Cor secundária<input value={settings.secondary_color || ""} onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })} placeholder="#f4f6f8" /></label></div>
      {message ? <div className="formMessage">{message}</div> : null}
      <div className="formActions"><button className="button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar identidade da imobiliária"}</button></div>
    </form>
  </div>;
}
