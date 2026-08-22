"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthly_price: number | null;
  annual_price: number | null;
  max_properties: number | null;
  max_users: number | null;
  max_ai_descriptions: number | null;
  features: Record<string, unknown> | null;
  active: boolean;
  display_order: number;
};

function nullableNumber(value: FormDataEntryValue | null) {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export default function PlatformPlanManager() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);

  async function load() {
    if (!supabaseBrowser) return;
    const { data, error } = await supabaseBrowser.from("subscription_plans")
      .select("id,code,name,description,monthly_price,annual_price,max_properties,max_users,max_ai_descriptions,features,active,display_order")
      .order("display_order").order("name");
    if (error) return setMessage(error.message);
    setPlans((data || []) as PlanRow[]);
  }

  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const code = slug(String(form.get("code") || name));
    if (!name || !code) return setMessage("Informe nome e código do plano.");

    const maxDocuments = nullableNumber(form.get("max_documents"));
    const maxDocumentUploads = nullableNumber(form.get("max_document_uploads"));
    const maxBuyerOutreach = nullableNumber(form.get("max_buyer_outreach_per_month"));
    const features = {
      ...(editing?.features || {}),
      custom_domain: form.get("custom_domain") === "on",
      default_trial: form.get("default_trial") === "on",
      trial_days: Math.max(1, Math.min(90, Number(form.get("trial_days") || 14))),
      broker_app: form.get("broker_app") === "on",
      push_notifications: form.get("push_notifications") === "on",
      email_leads: form.get("email_leads") === "on",
      ai_descriptions: form.get("ai_descriptions") === "on",
      ai_buyer_outreach: form.get("ai_buyer_outreach") === "on",
      max_buyer_outreach_per_month: maxBuyerOutreach,
      documents: form.get("documents") === "on",
      max_documents: maxDocuments,
      max_document_uploads: maxDocumentUploads,
    };

    const payload = {
      code,
      name,
      description: String(form.get("description") || "").trim() || null,
      monthly_price: nullableNumber(form.get("monthly_price")),
      annual_price: nullableNumber(form.get("annual_price")),
      max_properties: nullableNumber(form.get("max_properties")),
      max_users: nullableNumber(form.get("max_users")),
      max_ai_descriptions: nullableNumber(form.get("max_ai_descriptions")),
      features,
      active: form.get("active") === "on",
      display_order: Number(form.get("display_order") || 0),
      updated_at: new Date().toISOString(),
    };

    setSaving(true); setMessage("");
    const result = editing
      ? await supabaseBrowser.from("subscription_plans").update(payload).eq("id", editing.id)
      : await supabaseBrowser.from("subscription_plans").insert(payload);
    setSaving(false);
    if (result.error) return setMessage(result.error.message);
    setMessage(editing ? "Plano atualizado." : "Plano criado.");
    setEditing(null);
    event.currentTarget.reset();
    await load();
  }

  async function toggleActive(plan: PlanRow) {
    if (!supabaseBrowser) return;
    const { error } = await supabaseBrowser.from("subscription_plans").update({ active: !plan.active, updated_at: new Date().toISOString() }).eq("id", plan.id);
    if (error) return setMessage(error.message);
    await load();
  }

  const editFeatures = editing?.features || {};

  return <div className="adminPanel" id="planos-plataforma">
    <div className="adminPanelHeader"><div><span className="eyebrow">COMERCIAL</span><h2>Planos da plataforma</h2><p>Defina preços, limites e recursos sem alterar o código. Campos vazios de limite significam ilimitado.</p></div><span>{plans.length} plano(s)</span></div>
    <form className="propertyForm" onSubmit={save} key={editing?.id || "new"}>
      <div className="formGrid three"><label>Nome<input name="name" defaultValue={editing?.name || ""} required /></label><label>Código<input name="code" defaultValue={editing?.code || ""} placeholder="pro" required /></label><label>Ordem<input name="display_order" type="number" defaultValue={editing?.display_order || 0} /></label></div>
      <label>Descrição<input name="description" defaultValue={editing?.description || ""} /></label>
      <div className="formGrid"><label>Preço mensal (R$)<input name="monthly_price" inputMode="decimal" defaultValue={editing?.monthly_price ?? ""} placeholder="Deixe vazio enquanto não decidir" /></label><label>Preço anual (R$)<input name="annual_price" inputMode="decimal" defaultValue={editing?.annual_price ?? ""} placeholder="Opcional" /></label></div>
      <div className="formGrid three"><label>Máx. imóveis<input name="max_properties" type="number" min="1" defaultValue={editing?.max_properties ?? ""} /></label><label>Máx. usuários<input name="max_users" type="number" min="1" defaultValue={editing?.max_users ?? ""} /></label><label>IA/mês<input name="max_ai_descriptions" type="number" min="0" defaultValue={editing?.max_ai_descriptions ?? ""} /></label></div>
      <fieldset className="featurePicker"><legend>Recursos</legend><div><label className="featureOption"><input type="checkbox" name="broker_app" defaultChecked={Boolean(editFeatures.broker_app)} /> Aplicativo do corretor</label><label className="featureOption"><input type="checkbox" name="custom_domain" defaultChecked={Boolean(editFeatures.custom_domain)} /> Domínio próprio</label><label className="featureOption"><input type="checkbox" name="push_notifications" defaultChecked={Boolean(editFeatures.push_notifications)} /> Push no aplicativo</label><label className="featureOption"><input type="checkbox" name="email_leads" defaultChecked={Boolean(editFeatures.email_leads)} /> Contatos por e-mail</label><label className="featureOption"><input type="checkbox" name="ai_descriptions" defaultChecked={Boolean(editFeatures.ai_descriptions)} /> Descrições com IA</label><label className="featureOption"><input type="checkbox" name="ai_buyer_outreach" defaultChecked={Boolean(editFeatures.ai_buyer_outreach)} /> IA de oportunidades para compradores</label><label className="featureOption"><input type="checkbox" name="documents" defaultChecked={Boolean(editFeatures.documents)} /> Central de documentos</label><label className="featureOption"><input type="checkbox" name="default_trial" defaultChecked={Boolean(editFeatures.default_trial)} /> Plano padrão de teste</label></div></fieldset>
      <div className="formGrid three"><label>Máx. contatos IA/mês<input name="max_buyer_outreach_per_month" type="number" min="0" defaultValue={editFeatures.max_buyer_outreach_per_month == null ? "" : Number(editFeatures.max_buyer_outreach_per_month)} placeholder="Ilimitado" /></label><label>Máx. documentos ativos<input name="max_documents" type="number" min="0" defaultValue={editFeatures.max_documents == null ? "" : Number(editFeatures.max_documents)} placeholder="Ilimitado" /></label><label>Máx. anexos privados<input name="max_document_uploads" type="number" min="0" defaultValue={editFeatures.max_document_uploads == null ? "" : Number(editFeatures.max_document_uploads)} placeholder="Ilimitado" /></label></div>
      <div className="formGrid"><label>Dias do teste<input name="trial_days" type="number" min="1" max="90" defaultValue={Number(editFeatures.trial_days || 14)} /></label><label className="checkLabel"><input type="checkbox" name="active" defaultChecked={editing ? editing.active : true} /> Plano ativo para uso</label></div>
      <div className="formActions">{editing ? <button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancelar edição</button> : null}<button className="button primary" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar plano" : "Criar plano"}</button></div>
    </form>
    {message ? <div className="formMessage">{message}</div> : null}
    <div className="accessList">{plans.map((plan) => <article className="accessRow" key={plan.id}><div className="accessIdentity"><strong>{plan.name} · {plan.code}</strong><span>{plan.description || "Sem descrição"}</span><small>Mensal: {plan.monthly_price == null ? "não definido" : `R$ ${Number(plan.monthly_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} · imóveis {plan.max_properties ?? "∞"} · usuários {plan.max_users ?? "∞"} · IA {plan.max_ai_descriptions ?? "∞"} · oportunidades IA {plan.features?.ai_buyer_outreach ? `${String(plan.features.max_buyer_outreach_per_month ?? "∞")}/mês` : "não"} · documentos {plan.features?.documents ? `${String(plan.features.max_documents ?? "∞")}` : "não"}</small></div><div className="accessActions"><span className={`statusPill ${plan.active ? "" : "muted"}`}>{plan.active ? "Ativo" : "Inativo"}</span><button className="miniButton" onClick={() => setEditing(plan)}>Editar</button><button className="miniButton muted" onClick={() => void toggleActive(plan)}>{plan.active ? "Desativar" : "Ativar"}</button></div></article>)}</div>
  </div>;
}
