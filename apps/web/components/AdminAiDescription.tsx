"use client";

import { FormEvent, useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

export default function AdminAiDescription() {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [canUse, setCanUse] = useState(true);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabaseBrowser) return;
    void (async () => {
      const current = await getCurrentAgency();
      if (!current) return setMessage("Não foi possível identificar a imobiliária ativa.");
      setAgencyId(current.agencyId);
      setAgencyName(current.agencyName);
      const quota = await supabaseBrowser.rpc("agency_can_use_ai_description", { p_agency_id: current.agencyId });
      if (!quota.error) setCanUse(quota.data !== false);
    })();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId) return setMessage("Conecte o Supabase para usar a geração de descrições.");
    if (!canUse) return setMessage("O limite mensal de descrições com IA foi atingido para este plano.");
    const form = new FormData(event.currentTarget);
    const payload = {
      agency_id: agencyId,
      title: String(form.get("title") || "").trim(),
      property_type: String(form.get("property_type") || "").trim(),
      purpose: String(form.get("purpose") || "").trim(),
      city: String(form.get("city") || "").trim(),
      neighborhood: String(form.get("neighborhood") || "").trim(),
      price: String(form.get("price") || "").trim(),
      bedrooms: String(form.get("bedrooms") || "").trim(),
      suites: String(form.get("suites") || "").trim(),
      bathrooms: String(form.get("bathrooms") || "").trim(),
      parking: String(form.get("parking") || "").trim(),
      area: String(form.get("area") || "").trim(),
      tone: String(form.get("tone") || "profissional"),
      notes: String(form.get("notes") || "").trim(),
    };
    if (!payload.title && !payload.property_type && !payload.notes) return setMessage("Informe ao menos título, tipo ou observações do imóvel.");

    setLoading(true); setMessage(""); setDescription("");
    const result = await supabaseBrowser.functions.invoke("generate-property-description", { body: payload });
    setLoading(false);
    if (result.error) return setMessage(result.error.message || "Não foi possível gerar a descrição.");
    if (result.data?.error) return setMessage(String(result.data.error));
    const generated = String(result.data?.description || "").trim();
    if (!generated) return setMessage("A IA não retornou texto nesta tentativa.");
    setDescription(generated);
    setMessage("Descrição gerada. Revise antes de publicar; a IA não deve substituir a conferência dos dados do imóvel.");
  }

  async function copy() {
    if (!description) return;
    try {
      await navigator.clipboard.writeText(description);
      setMessage("Descrição copiada.");
    } catch { setMessage("Selecione o texto e copie manualmente."); }
  }

  return <div className="adminPanel" id="descricao-ia">
    <div className="adminPanelHeader"><div><span className="eyebrow">ASSISTENTE</span><h2>Descrição de imóvel com IA</h2><p>Gere um texto a partir apenas dos dados confirmados do imóvel de {agencyName || "sua imobiliária"}.</p></div><span>{canUse ? "Disponível no plano" : "Limite atingido"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">A ferramenta fica pronta para uso quando o backend de produção e o provedor de IA forem configurados.</div> : null}
    <form className="propertyForm" onSubmit={submit}>
      <div className="formGrid"><label>Título<input name="title" placeholder="Casa com 3 quartos no Centro" /></label><label>Tipo<input name="property_type" placeholder="Casa, apartamento, terreno..." /></label></div>
      <div className="formGrid three"><label>Finalidade<select name="purpose" defaultValue="Venda"><option>Venda</option><option>Locação</option></select></label><label>Cidade<input name="city" /></label><label>Bairro<input name="neighborhood" /></label></div>
      <div className="formGrid three"><label>Valor<input name="price" placeholder="R$ 485.000" /></label><label>Área<input name="area" placeholder="120 m²" /></label><label>Tom<select name="tone" defaultValue="profissional"><option value="profissional">Profissional</option><option value="acolhedor">Acolhedor</option><option value="objetivo">Objetivo</option><option value="sofisticado">Sofisticado</option></select></label></div>
      <div className="formGrid three"><label>Quartos<input name="bedrooms" inputMode="numeric" /></label><label>Suítes<input name="suites" inputMode="numeric" /></label><label>Banheiros<input name="bathrooms" inputMode="numeric" /></label></div>
      <label>Informações confirmadas<textarea name="notes" rows={4} placeholder="Ex.: cozinha planejada, quintal, duas vagas cobertas, próximo ao centro. Não informe nada que não esteja confirmado." /></label>
      <div className="formActions"><button className="button primary" type="submit" disabled={loading || !agencyId || !canUse}>{loading ? "Gerando..." : "Gerar descrição"}</button></div>
    </form>
    {message ? <div className="formMessage">{message}</div> : null}
    {description ? <div className="domainPrimaryCard"><div style={{ flex: 1 }}><span className="eyebrow">TEXTO GERADO</span><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{description}</p></div><button className="miniButton" type="button" onClick={() => void copy()}>Copiar</button></div> : null}
  </div>;
}
