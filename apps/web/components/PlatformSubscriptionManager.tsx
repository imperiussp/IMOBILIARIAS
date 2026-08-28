"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Agency = { id: string; name: string; slug: string; status: string };
type Plan = { id: string; name: string; code: string; active: boolean; monthly_price: number | null; annual_price: number | null; implementation_fee: number | null };
type Subscription = { id: string; agency_id: string; plan_id: string; status: string; starts_at: string; renews_at: string | null; ends_at: string | null };
type Discount = { id: string; agency_id: string; plan_id: string; billing_cycle: "monthly" | "annual"; base_amount: number; final_amount: number; discount_percent: number; status: string; created_at: string };

const statusOptions = [["trial","Conta interna / teste"],["active","Ativa"],["past_due","Pagamento atrasado"],["cancelled","Cancelada"],["expired","Encerrada"]] as const;
function dateInput(value:string|null){if(!value)return "";const d=new Date(value);if(Number.isNaN(d.getTime()))return "";return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function toIso(value:string){return value?new Date(`${value}T12:00:00`).toISOString():null;}
function money(value:number|null|undefined){return value==null?"—":new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value));}
function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value));}

export default function PlatformSubscriptionManager(){
  const [agencies,setAgencies]=useState<Agency[]>([]); const [plans,setPlans]=useState<Plan[]>([]); const [subscriptions,setSubscriptions]=useState<Subscription[]>([]); const [discounts,setDiscounts]=useState<Discount[]>([]);
  const [agencyId,setAgencyId]=useState(""); const [planId,setPlanId]=useState(""); const [subscriptionStatus,setSubscriptionStatus]=useState("active"); const [renewsAt,setRenewsAt]=useState(""); const [endsAt,setEndsAt]=useState("");
  const [cycle,setCycle]=useState<"monthly"|"annual">("monthly"); const [finalAmount,setFinalAmount]=useState(""); const [discountPercent,setDiscountPercent]=useState("0.00"); const [message,setMessage]=useState(""); const [saving,setSaving]=useState(false);

  async function load(){
    if(!supabaseBrowser||!isSupabaseConfigured)return;
    const [a,p,s,d]=await Promise.all([
      supabaseBrowser.from("agencies").select("id,name,slug,status").order("name"),
      supabaseBrowser.from("subscription_plans").select("id,name,code,active,monthly_price,annual_price,implementation_fee").order("display_order"),
      supabaseBrowser.from("agency_subscriptions").select("id,agency_id,plan_id,status,starts_at,renews_at,ends_at").order("starts_at",{ascending:false}),
      supabaseBrowser.from("agency_billing_discounts").select("id,agency_id,plan_id,billing_cycle,base_amount,final_amount,discount_percent,status,created_at").eq("status","active").order("created_at",{ascending:false}),
    ]);
    const error=a.error||p.error||s.error||d.error;if(error)return setMessage(error.message);
    setAgencies((a.data||[]) as Agency[]);setPlans((p.data||[]) as Plan[]);setSubscriptions((s.data||[]) as Subscription[]);setDiscounts((d.data||[]) as Discount[]);setAgencyId((current)=>current||String(a.data?.[0]?.id||""));
  }
  useEffect(()=>{void load();},[]);
  const commercialPlans=plans.filter((plan)=>plan.code!=="homologacao"&&plan.active);
  const currentSubscription=useMemo(()=>subscriptions.find((item)=>item.agency_id===agencyId&&["trial","active","past_due"].includes(item.status))||null,[subscriptions,agencyId]);
  const currentPlan=plans.find((plan)=>plan.id===currentSubscription?.plan_id)||null;
  const selectedPlan=plans.find((plan)=>plan.id===planId)||null;
  const basePrice=selectedPlan?Number(cycle==="annual"?selectedPlan.annual_price||0:selectedPlan.monthly_price||0):0;
  const currentDiscount=discounts.find((item)=>item.agency_id===agencyId&&item.plan_id===planId&&item.billing_cycle===cycle)||null;

  useEffect(()=>{
    if(currentSubscription){setPlanId(currentSubscription.plan_id);setSubscriptionStatus(currentSubscription.status);setRenewsAt(dateInput(currentSubscription.renews_at));setEndsAt(dateInput(currentSubscription.ends_at));}
    else{setPlanId(commercialPlans[0]?.id||"");setSubscriptionStatus("active");setRenewsAt("");setEndsAt("");}
  },[agencyId,currentSubscription?.id,plans.length]);
  useEffect(()=>{if(!basePrice){setFinalAmount("");setDiscountPercent("0.00");return;}if(currentDiscount){setFinalAmount(Number(currentDiscount.final_amount).toFixed(2));setDiscountPercent(Number(currentDiscount.discount_percent).toFixed(2));}else{setFinalAmount(basePrice.toFixed(2));setDiscountPercent("0.00");}},[agencyId,planId,cycle,currentDiscount?.id,basePrice]);
  function changeFinal(text:string){setFinalAmount(text);const value=Number(text.replace(",","."));if(!basePrice||!Number.isFinite(value))return;setDiscountPercent(clamp(((basePrice-value)/basePrice)*100,0,99.99).toFixed(2));}
  function changePercent(text:string){setDiscountPercent(text);const value=Number(text.replace(",","."));if(!basePrice||!Number.isFinite(value))return;setFinalAmount((basePrice*(1-clamp(value,0,99.99)/100)).toFixed(2));}

  async function saveSubscription(){if(!supabaseBrowser||!agencyId||!planId)return setMessage("Selecione cliente e plano.");setSaving(true);setMessage("");const {error}=await supabaseBrowser.rpc("platform_set_agency_subscription",{p_agency_id:agencyId,p_plan_id:planId,p_status:subscriptionStatus,p_renews_at:toIso(renewsAt),p_ends_at:toIso(endsAt)});setSaving(false);if(error)return setMessage(error.message);setMessage("Assinatura atualizada.");await load();}
  async function saveDiscount(){if(!supabaseBrowser||!agencyId||!planId||!basePrice)return setMessage("Selecione cliente, plano e cobrança.");const final=Number(finalAmount.replace(",","."));if(!Number.isFinite(final)||final<=0||final>basePrice)return setMessage("Informe um valor válido.");setSaving(true);setMessage("");const result=final<basePrice?await supabaseBrowser.rpc("platform_set_agency_billing_discount",{p_agency_id:agencyId,p_plan_id:planId,p_billing_cycle:cycle,p_final_amount:final}):await supabaseBrowser.rpc("platform_clear_agency_billing_discount",{p_agency_id:agencyId,p_plan_id:planId,p_billing_cycle:cycle});setSaving(false);if(result.error)return setMessage(result.error.message);setMessage(final<basePrice?`Desconto salvo: ${discountPercent}%.`:"Valor normal restaurado.");await load();}

  if(!isSupabaseConfigured)return <details className="adminPanel commercialToolCard" id="assinaturas-plataforma"><summary><span>Assinaturas</span><strong>Plano, cobrança e desconto</strong></summary><div className="formNotice">Cobrança não conectada.</div></details>;
  return <details className="adminPanel commercialToolCard" id="assinaturas-plataforma">
    <summary className="commercialToolSummary"><span>ASSINATURAS</span><strong>Plano, cobrança e desconto por cliente</strong><small>Toque para administrar</small></summary>
    <div className="commercialToolBody">
      <div className="propertyForm">
        <div className="formGrid"><label>Cliente<select value={agencyId} onChange={(e)=>setAgencyId(e.target.value)}>{agencies.map((agency)=><option key={agency.id} value={agency.id}>{agency.name} · {agency.slug}</option>)}</select></label><label>Plano<select value={planId} onChange={(e)=>setPlanId(e.target.value)}>{currentPlan?.code==="homologacao"?<option value={currentPlan.id}>Conta interna atual</option>:null}{commercialPlans.map((plan)=><option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label></div>
        <div className="formGrid three"><label>Status da assinatura<select value={subscriptionStatus} onChange={(e)=>setSubscriptionStatus(e.target.value)}>{statusOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Próximo vencimento<input type="date" value={renewsAt} onChange={(e)=>setRenewsAt(e.target.value)}/></label><label>Término<input type="date" value={endsAt} onChange={(e)=>setEndsAt(e.target.value)}/></label></div>
        <div className="formActions"><button className="button primary" type="button" disabled={saving} onClick={()=>void saveSubscription()}>{saving?"Salvando...":"Salvar assinatura"}</button></div>
      </div>
      <div className="platformDiscountEditor compactDiscountEditor">
        <h3>Desconto da próxima cobrança</h3>
        <div className="formGrid three"><label>Cobrança<select value={cycle} onChange={(e)=>setCycle(e.target.value as "monthly"|"annual")}><option value="monthly">Mensal</option><option value="annual">Anual · 25% padrão</option></select></label><label>Valor normal<input value={money(basePrice)} readOnly/></label><label>Implantação<input value={cycle==="annual"?"Grátis no anual":selectedPlan?money(selectedPlan.implementation_fee):"—"} readOnly/></label></div>
        <div className="formGrid"><label>Valor a cobrar (R$)<input type="number" min="0.01" step="0.01" value={finalAmount} onChange={(e)=>changeFinal(e.target.value)}/></label><label>Desconto (%)<input type="number" min="0" max="99.99" step="0.01" value={discountPercent} onChange={(e)=>changePercent(e.target.value)}/></label></div>
        <div className="formActions"><button className="button primary" type="button" disabled={saving} onClick={()=>void saveDiscount()}>Salvar valor / desconto</button></div>
      </div>
      {message?<div className="formMessage">{message}</div>:null}
    </div>
  </details>;
}
