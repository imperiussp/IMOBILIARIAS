import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const maintenanceSecret = Deno.env.get("PLATFORM_MAINTENANCE_SECRET") || "";
const billingSecret = Deno.env.get("BILLING_MAINTENANCE_SECRET") || "";
const domainSecret = Deno.env.get("DOMAIN_VERIFY_SECRET") || "";
const pushSecret = Deno.env.get("PUSH_DISPATCH_SECRET") || "";
const buyerSecret = Deno.env.get("BUYER_OUTREACH_MAINTENANCE_SECRET") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function callFunction(name:string, headers:Record<string,string>) {
  const started=Date.now();
  try {
    const response=await fetch(`${supabaseUrl}/functions/v1/${name}`,{method:"POST",headers:{"content-type":"application/json",...headers}});
    const body=await response.json().catch(()=>null);
    return {name,ok:response.ok,status:response.status,duration_ms:Date.now()-started,body};
  } catch(error) {
    return {name,ok:false,status:0,duration_ms:Date.now()-started,error:error instanceof Error?error.message:String(error)};
  }
}

Deno.serve(async(request)=>{
  if(request.method!=="POST")return json({error:"method_not_allowed"},405);
  if(!supabaseUrl||!serviceRoleKey||!maintenanceSecret)return json({error:"server_not_configured"},503);
  if(request.headers.get("x-platform-maintenance-secret")!==maintenanceSecret)return json({error:"unauthorized"},401);

  const startedAt=new Date().toISOString();
  const results:any[]=[];
  const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false}});

  const controlsResult=await admin.from("platform_release_controls")
    .select("environment_mode,maintenance_mode,real_billing_enabled,external_messaging_enabled,ai_generation_enabled,push_notifications_enabled")
    .eq("id",1).maybeSingle();
  if(controlsResult.error)return json({error:controlsResult.error.message},500);
  const controls:any=controlsResult.data||{};

  const recoveryStarted=Date.now();
  try{
    const recovery=await admin.rpc("recover_stale_buyer_outreach_attempts",{p_timeout_minutes:20});
    if(recovery.error){results.push({name:"recover-stale-outreach",ok:false,status:500,duration_ms:Date.now()-recoveryStarted,error:recovery.error.message});}
    else{results.push({name:"recover-stale-outreach",ok:true,status:200,duration_ms:Date.now()-recoveryStarted,body:{recovered:Number(recovery.data||0)}});}
  }catch(error){results.push({name:"recover-stale-outreach",ok:false,status:0,duration_ms:Date.now()-recoveryStarted,error:error instanceof Error?error.message:String(error)});}

  const retentionStarted=Date.now();
  try{
    const retention=await admin.rpc("abandon_stale_outreach_provider_events",{p_age_days:7});
    if(retention.error){results.push({name:"retain-orphan-provider-events",ok:false,status:500,duration_ms:Date.now()-retentionStarted,error:retention.error.message});}
    else{results.push({name:"retain-orphan-provider-events",ok:true,status:200,duration_ms:Date.now()-retentionStarted,body:{abandoned:Number(retention.data||0)}});}
  }catch(error){results.push({name:"retain-orphan-provider-events",ok:false,status:0,duration_ms:Date.now()-retentionStarted,error:error instanceof Error?error.message:String(error)});}

  results.push(await callFunction("reconcile-outreach-provider-events",{"x-platform-maintenance-secret":maintenanceSecret}));

  if(!billingSecret) results.push({name:"process-subscription-expiry",ok:false,configuration_error:true,error:"BILLING_MAINTENANCE_SECRET não configurado"});
  else results.push(await callFunction("process-subscription-expiry",{"x-billing-maintenance-secret":billingSecret}));

  const pendingDomains=await admin.from("agency_domains").select("id",{count:"exact",head:true}).eq("kind","custom").eq("verified",false);
  if(pendingDomains.error){
    results.push({name:"verify-custom-domains",ok:false,status:500,error:pendingDomains.error.message});
  } else if((pendingDomains.count||0)===0){
    results.push({name:"verify-custom-domains",ok:true,skipped:true,reason:"no_pending_custom_domains"});
  } else if(!domainSecret){
    results.push({name:"verify-custom-domains",ok:false,configuration_error:true,error:"DOMAIN_VERIFY_SECRET não configurado",pending_domains:pendingDomains.count||0});
  } else {
    results.push(await callFunction("verify-custom-domains",{"x-domain-verify-secret":domainSecret}));
  }

  if(controls.push_notifications_enabled===true){
    if(!pushSecret) results.push({name:"push-broker-notifications",ok:false,configuration_error:true,error:"PUSH_DISPATCH_SECRET não configurado"});
    else results.push(await callFunction("push-broker-notifications",{"x-dispatch-secret":pushSecret}));
  } else {
    results.push({name:"push-broker-notifications",ok:true,skipped:true,reason:"release_gate_disabled"});
  }

  const buyerAutomationWanted=controls.external_messaging_enabled===true||controls.ai_generation_enabled===true;
  if(buyerAutomationWanted){
    if(!buyerSecret) results.push({name:"process-buyer-opportunities",ok:false,configuration_error:true,error:"BUYER_OUTREACH_MAINTENANCE_SECRET não configurado"});
    else results.push(await callFunction("process-buyer-opportunities",{"x-maintenance-secret":buyerSecret}));
  } else {
    results.push({name:"process-buyer-opportunities",ok:true,skipped:true,reason:"release_gates_disabled"});
  }

  const failed=results.filter((item:any)=>!item.ok).length;
  const configurationIssues=results.filter((item:any)=>item.configuration_error===true).length;
  const payload={
    ok:failed===0,
    environment_mode:controls.environment_mode||"unknown",
    maintenance_mode:controls.maintenance_mode===true,
    processed_at:new Date().toISOString(),
    failed,
    configuration_issues:configurationIssues,
    results,
  };

  try {
    await admin.from("platform_maintenance_runs").insert({started_at:startedAt,finished_at:payload.processed_at,success:payload.ok,failed_tasks:failed,result:payload});
  } catch {
    // O log nunca deve impedir as rotinas principais nem alterar seu resultado.
  }

  return json(payload,failed?207:200);
});
