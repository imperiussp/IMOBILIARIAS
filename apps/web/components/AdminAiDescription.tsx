"use client";

import { FormEvent, useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

function aiError(value: unknown) {
  const code = String(value || "");
  if (code.includes("ai_generation_disabled") || code.includes("platform_maintenance_mode") || code.includes("release_controls_unavailable")) return "A geração com IA está temporariamente indisponível.";
  return code || "Não foi possível gerar a descrição.";
}

export default function AdminAiDescription({ compact = false }: { compact?: boolean }) {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [canUse, setCanUse] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [planName, setPlanName] = useState("");
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabaseBrowser) return;
    void (async () => {
      const current = await getCurrentAgency();
      if (!current) return setMessage("Não foi possível identificar a imobiliária ativa.");
      setAgencyId(current.agencyId); setAgencyName(current.agencyName);
      const [quota, featureResult] = await Promise.all([
        supabaseBrowser.rpc("agency_can_use_ai_description", { p_agency_id: current.agencyId }),
        supabaseBrowser.rpc("agency_plan_feature_snapshot", { p_agency_id: current.agencyId }),
      ]);
      if (!quota.error) setCanUse(quota.data !== false);
      const feature = Array.isArray(featureResult.data) ? featureResult.data[0] : null;
      if (!featureResult.error && feature) { setFeatureEnabled(feature.ai_descriptions !== false); setPlanName(String(feature.plan_name || "")); }
    })();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId) return setMessage("A geração com IA está indisponível agora.");
    if (!featureEnabled) return setMessage("A geração de descrições com IA não está incluída no plano atual.");
    if (!canUse) return setMessage("O limite mensal de descrições com IA foi atingido.");
    const form = new FormData(event.currentTarget);
    const payload = {
      agency_id: agencyId,
      title: String(form.get("title") || "").trim(), property_type: String(form.get("property_type") || "").trim(), purpose: String(form.get("purpose") || "").trim(),
      city: String(form.get("city") || "").trim(), neighborhood: String(form.get("neighborhood") || "").trim(), price: String(form.get("price") || "").trim(),
      bedrooms: String(form.get("bedrooms") || "").trim(), suites: String(form.get("suites") || "").trim(), bathrooms: String(form.get("bathrooms") || "").trim(),
      parking: String(form.get("parking") || "").trim(), area: String(form.get("area") || "").trim(), tone: String(form.get("tone") || "profissional"), notes: String(form.get("notes") || "").trim(),
    };
    if (!payload.title && !payload.property_type && !payload.notes) return setMessage("Informe ao menos título, tipo ou observações do imóvel.");
    setLoading(true); setMessage(""); setDescription("");
    const result = await supabaseBrowser.functions.invoke("generate-property-description", { body: payload });
    setLoading(false);
    if (result.error || result.data?.error) return setMessage(aiError(result.data?.error || result.error?.message));
    const generated = String(result.data?.description || "").trim();
    if (!generated) return setMessage("A IA não retornou texto nesta tentativa.");
    setDescription(generated); setMessage("Descrição gerada. Revise o texto antes de publicar.");
  }

  async function copy() {
    if (!description) return;
    try { await navigator.clipboard.writeText(description); setMessage("Descrição copiada."); }
    catch { setMessage("Selecione o texto e copie manualmente."); }
  }

  const available = featureEnabled && canUse;
  return <div className={`adminPanel${compact ? " compactAiPanel" : ""}`} id="descricao-ia">
    <div className="adminPanelHeader"><div><span className="eyebrow">ASSISTENTE</span><h2>Descrição de imóvel com IA</h2><p>{compact ? "Use apenas informações confirmadas do imóvel." : `Gere um texto a partir apenas dos dados confirmados do imóvel de ${agencyName || "sua imobiliária"}.`}</p></div><span>{!featureEnabled ? "Não incluída no plano" : canUse ? "Disponível" : "Limite atingido"}</span></div>
    {!compact && planName ? <div className="formNotice">Plano identificado: <strong>{planName}</strong>.</div> : null}
    {!compact && !isSupabaseConfigured ? <div className="formNotice">A ferramenta fica disponível com o backend de produção configurado.</div> : null}
    {!featureEnabled ? <div className="formNotice">Este recurso não está disponível no plano atual.</div> : null}
    <form className="propertyForm" onSubmit={submit}>
      <div className="formGrid"><label>Título<input name="title" placeholder="Casa com 3 quartos no Centro" /></label><label>Tipo<input name="property_type" placeholder="Casa, apartamento, terreno..." /></label></div>
      <div className="formGrid three"><label>Finalidade<select name="purpose" defaultValue="Venda"><option>Venda</option><option>Locação</option></select></label><label>Cidade<input name="city" /></label><label>Bairro<input name="neighborhood" /></label></div>
      <div className="formGrid three"><label>Valor<input name="price" placeholder="R$ 485.000" /></label><label>Área<input name="area" placeholder="120 m²" /></label><label>Tom<select name="tone" defaultValue="profissional"><option value="profissional">Profissional</option><option value="acolhedor">Acolhedor</option><option value="objetivo">Objetivo</option><option value="sofisticado">Sofisticado</option></select></label></div>
      <div className="formGrid three"><label>Quartos<input name="bedrooms" inputMode="numeric" /></label><label>Suítes<input name="suites" inputMode="numeric" /></label><label>Banheiros<input name="bathrooms" inputMode="numeric" /></label></div>
      <label>Informações confirmadas<textarea name="notes" rows={4} placeholder="Ex.: cozinha planejada, quintal, duas vagas cobertas." /></label>
      <div className="formActions"><button className="button primary" type="submit" disabled={loading || !agencyId || !available}>{loading ? "Gerando..." : "Gerar descrição"}</button></div>
    </form>
    {message ? <div className="formMessage">{message}</div> : null}
    {description ? <div className="domainPrimaryCard"><div style={{ flex:1 }}><span className="eyebrow">TEXTO GERADO</span><p style={{ whiteSpace:"pre-wrap", lineHeight:1.65 }}>{description}</p></div><button className="miniButton" type="button" onClick={() => void copy()}>Copiar</button></div> : null}
  </div>;
}
