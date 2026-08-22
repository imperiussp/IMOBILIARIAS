const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
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

  const tasks:[string,Record<string,string>,boolean][]=[
    ["process-subscription-expiry",{"x-billing-maintenance-secret":billingSecret},Boolean(billingSecret)],
    ["verify-custom-domains",{"x-domain-verify-secret":domainSecret},Boolean(domainSecret)],
    ["push-broker-notifications",{"x-dispatch-secret":pushSecret},Boolean(pushSecret)],
    ["process-buyer-opportunities",{"x-maintenance-secret":buyerSecret},Boolean(buyerSecret)],
  ];

  const results=[];
  for(const [name,headers,enabled] of tasks){
    if(!enabled){results.push({name,ok:false,skipped:true,error:"secret_not_configured"});continue;}
    results.push(await callFunction(name,headers));
  }

  const failed=results.filter((item:any)=>!item.ok&&!item.skipped).length;
  return json({
    ok:failed===0,
    processed_at:new Date().toISOString(),
    failed,
    results,
  },failed?207:200);
});
