"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type PlanRow = { id:string; code:string; name:string; description:string|null; monthly_price:number|null; annual_price:number|null; implementation_fee:number|null; annual_discount_percent:number|null; max_properties:number|null; max_users:number|null; max_ai_descriptions:number|null; features:Record<string,unknown>|null; active:boolean; display_order:number };
function nullableNumber(value:FormDataEntryValue|null){const text=String(value||"").trim().replace(",", ".");if(!text)return null;const number=Number(text);return Number.isFinite(number)?number:null;}
function slug(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);}
const resourceFields=[
  ["exclusive_site","Site exclusivo"],["full_management","Gestão completa"],["broker_app","Aplicativo do corretor"],["crm_real_estate","CRM imobiliário"],["documents","Central de documentos"],["ai_buyer_outreach","IA de oportunidades"],
  ["property_portals","Portais imobiliários"],["facebook_lead_ads","Facebook Lead Ads"],["key_control","Controle de chaves"],["proposal_control","Controle de propostas"],["inspections","Vistorias"],["visit_agenda","Agenda e visitas"],
  ["customer_management","Gestão de clientes"],["sales_management","Gestão de vendas"],["advanced_lead_reservation","Reserva avançada de leads"],["user_permissions","Permissões por usuário"],["strategic_reports","Relatórios estratégicos"],["multi_team","Gestão multi-equipe"],
  ["custom_domain","Domínio próprio"],["push_notifications","Push no aplicativo"],["email_leads","Contatos por e-mail"],["ai_descriptions","Descrições com IA"],
] as const;

export default function PlatformPlanManager(){
  const [plans,setPlans]=useState<PlanRow[]>([]);const [message,setMessage]=useState("");const [saving,setSaving]=useState(false);const [editing,setEditing]=useState<PlanRow|null>(null);const [creating,setCreating]=useState(false);
  async function load(){if(!supabaseBrowser)return;const {data,error}=await supabaseBrowser.from("subscription_plans").select("id,code,name,description,monthly_price,annual_price,implementation_fee,annual_discount_percent,max_properties,max_users,max_ai_descriptions,features,active,display_order").neq("code","homologacao").order("display_order").order("name");if(error)return setMessage(error.message);const rows=(data||[]) as PlanRow[];setPlans(rows);setEditing((current)=>current?rows.find((plan)=>plan.id===current.id)||rows[0]||null:rows[0]||null);}
  useEffect(()=>{void load();},[]);
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!supabaseBrowser)return;const form=new FormData(event.currentTarget);const name=String(form.get("name")||"").trim();const code=slug(String(form.get("code")||name));if(!name||!code)return setMessage("Informe nome e código do plano.");
    const features:Record<string,unknown>={...(editing?.features||{}),commercial:true,internal_only:false,default_trial:false};resourceFields.forEach(([key])=>{features[key]=form.get(key)==="on";});features.max_buyer_outreach_per_month=nullableNumber(form.get("max_buyer_outreach_per_month"));features.max_documents=nullableNumber(form.get("max_documents"));features.max_document_uploads=nullableNumber(form.get("max_document_uploads"));
    const payload={code,name,description:String(form.get("description")||"").trim()||null,monthly_price:nullableNumber(form.get("monthly_price")),annual_price:nullableNumber(form.get("annual_price")),implementation_fee:nullableNumber(form.get("implementation_fee"))||0,annual_discount_percent:nullableNumber(form.get("annual_discount_percent"))??25,max_properties:nullableNumber(form.get("max_properties")),max_users:nullableNumber(form.get("max_users")),max_ai_descriptions:nullableNumber(form.get("max_ai_descriptions")),features,active:form.get("active")==="on",display_order:Number(form.get("display_order")||0),updated_at:new Date().toISOString()};
    setSaving(true);setMessage("");const result=editing&&!creating?await supabaseBrowser.from("subscription_plans").update(payload).eq("id",editing.id):await supabaseBrowser.from("subscription_plans").insert(payload);setSaving(false);if(result.error)return setMessage(result.error.message);setMessage(editing&&!creating?"Plano atualizado.":"Plano criado.");setCreating(false);await load();
  }
  const editFeatures=creating?{}:editing?.features||{};
  const selectedKey=creating?"new":editing?.id||"none";
  return <details className="adminPanel commercialToolCard" id="planos-plataforma">
    <summary className="commercialToolSummary"><span>PLANOS</span><strong>Planos e preços</strong><small>Toque para editar</small></summary>
    <div className="commercialToolBody">
      <div className="planEditorChooser">
        <label>Plano para editar<select value={creating?"new":editing?.id||""} onChange={(event)=>{if(event.target.value==="new"){setCreating(true);setEditing(null);}else{setCreating(false);setEditing(plans.find((plan)=>plan.id===event.target.value)||null);}}}><option value="new">+ Criar novo plano</option>{plans.map((plan)=><option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
        <span>{editing&&!creating?(editing.active?"Ativo":"Inativo"):"Novo plano"}</span>
      </div>
      <form className="propertyForm compactPlanForm" onSubmit={save} key={selectedKey}>
        <div className="formGrid three"><label>Nome<input name="name" defaultValue={creating?"":editing?.name||""} required/></label><label>Código<input name="code" defaultValue={creating?"":editing?.code||""} required/></label><label>Ordem<input name="display_order" type="number" defaultValue={creating?plans.length*10+10:editing?.display_order||0}/></label></div>
        <label>Descrição<input name="description" defaultValue={creating?"":editing?.description||""}/></label>
        <div className="formGrid three"><label>Preço mensal (R$)<input name="monthly_price" inputMode="decimal" defaultValue={creating?"":editing?.monthly_price??""}/></label><label>Preço anual (R$)<input name="annual_price" inputMode="decimal" defaultValue={creating?"":editing?.annual_price??""}/></label><label>Implantação (R$)<input name="implementation_fee" inputMode="decimal" defaultValue={creating?"":editing?.implementation_fee??""}/></label></div>
        <div className="formGrid"><label>Desconto anual padrão (%)<input name="annual_discount_percent" type="number" min="0" max="99" step="0.01" defaultValue={creating?25:editing?.annual_discount_percent??25}/></label><label>Regra do anual<input value="Implantação grátis no anual" readOnly/></label></div>
        <div className="formGrid three"><label>Máx. imóveis<input name="max_properties" type="number" min="1" defaultValue={creating?"":editing?.max_properties??""}/></label><label>Máx. usuários<input name="max_users" type="number" min="1" defaultValue={creating?"":editing?.max_users??""}/></label><label>Descrições IA/mês<input name="max_ai_descriptions" type="number" min="0" defaultValue={creating?"":editing?.max_ai_descriptions??""}/></label></div>
        <fieldset className="featurePicker compactFeaturePicker"><legend>Recursos do plano</legend><div className="commercialFeatureGrid">{resourceFields.map(([key,label])=><label className="featureOption" key={key}><input type="checkbox" name={key} defaultChecked={creating?["exclusive_site","broker_app","crm_real_estate"].includes(key):Boolean(editFeatures[key])}/><span>{label}</span></label>)}</div></fieldset>
        <div className="formGrid three"><label>Máx. contatos IA/mês<input name="max_buyer_outreach_per_month" type="number" min="0" defaultValue={editFeatures.max_buyer_outreach_per_month==null?"":Number(editFeatures.max_buyer_outreach_per_month)} placeholder="Ilimitado"/></label><label>Máx. documentos ativos<input name="max_documents" type="number" min="0" defaultValue={editFeatures.max_documents==null?"":Number(editFeatures.max_documents)} placeholder="Ilimitado"/></label><label>Máx. anexos privados<input name="max_document_uploads" type="number" min="0" defaultValue={editFeatures.max_document_uploads==null?"":Number(editFeatures.max_document_uploads)} placeholder="Ilimitado"/></label></div>
        <label className="compactActiveCheck"><input type="checkbox" name="active" defaultChecked={creating?true:editing?.active??true}/><span>Plano ativo para novas compras</span></label>
        <div className="formActions"><button className="button primary" disabled={saving}>{saving?"Salvando...":creating?"Criar plano":"Salvar alterações"}</button></div>
      </form>
      {message?<div className="formMessage">{message}</div>:null}
    </div>
  </details>;
}
