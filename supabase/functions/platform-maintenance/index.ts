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
  if(!supabaseUrl||!maintenanceSecret)return json({error:"server_not_configured"},503);
  if(request.headers.get("x-platform-maintenance-secret")!==maintenanceSecret)return json({error:"unauthorized"},401);

  const startedAt=new Date().toISOString();
  const results:any[]=[];

  if(serviceRoleKey){
    const recoveryStarted=Date.now();
    try{
      const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false}});
      const recovery=await admin.rpc("recover_stale_buyer_outreach_attempts",{p_timeout_minutes:20});
      if(recovery.error){results.push({name:"recover-stale-outreach",ok:false,status:500,duration_ms:Date.now()-recoveryStarted,error:recovery.error.message});}
      else{results.push({name:"recover-stale-outreach",ok:true,status:200,duration_ms:Date.now()-recoveryStarted,body:{recovered:Number(recovery.data||0)}});}
    }catch(error){results.push({name:"recover-stale-outreach",ok:false,status:0,duration_ms:Date.now()-recoveryStarted,error:error instanceof Error?error.message:String(error)});}
  }else{
    results.push({name:"recover-stale-outreach",ok:false,skipped:true,error:"service_role_not_configured"});
  }

  results.push(await callFunction("reconcile-outreach-provider-events",{"x-platform-maintenance-secret":maintenanceSecret}));

  const tasks:[string,Record<string,string>,boolean][]=[
    ["process-subscription-expiry",{"x-billing-maintenance-secret":billingSecret},Boolean(billingSecret)],
    ["verify-custom-domains",{"x-domain-verify-secret":domainSecret},Boolean(domainSecret)],
    ["push-broker-notifications",{"x-dispatch-secret":pushSecret},Boolean(pushSecret)],
    ["process-buyer-opportunities",{"x-maintenance-secret":buyerSecret},Boolean(buyerSecret)],
  ];

  for(const [name,headers,enabled] of tasks){
    if(!enabled){results.push({name,ok:false,skipped:true,error:"secret_not_configured"});continue;}
    results.push(await callFunction(name,headers));
  }

  const failed=results.filter((item:any)=>!item.ok&&!item.skipped).length;
  const payload={ok:failed===0,processed_at:new Date().toISOString(),failed,results};

  if(serviceRoleKey){
    try {
      const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false}});
      await admin.from("platform_maintenance_runs").insert({started_at:startedAt,finished_at:payload.processed_at,success:payload.ok,failed_tasks:failed,result:payload});
    } catch {
      // O log nunca deve impedir as rotinas principais nem alterar seu resultado.
    }
  }

  return json(payload,failed?207:200);
});
