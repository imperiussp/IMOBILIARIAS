import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const groqKey=Deno.env.get("GROQ_API_KEY")||"";
const groqModel=Deno.env.get("GROQ_MODEL")||"openai/gpt-oss-20b";
const geminiKey=Deno.env.get("GEMINI_API_KEY")||"";
const geminiModel=Deno.env.get("GEMINI_MODEL")||"gemini-3.5-flash-lite";
const legacyUrl=Deno.env.get("AI_API_URL")||"";
const legacyKey=Deno.env.get("AI_API_KEY")||"";
const legacyModel=Deno.env.get("AI_MODEL")||"";

const corsHeaders={
 "access-control-allow-origin":"*",
 "access-control-allow-headers":"authorization, x-client-info, apikey, content-type",
 "access-control-allow-methods":"POST, OPTIONS",
};

type Generated={content:string;provider:string;model:string};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"content-type":"application/json; charset=utf-8"}})}
function text(v:unknown,max=600){return String(v??"").trim().slice(0,max)}
async function groqGenerate(system:string,prompt:string,temperature:number,maxTokens:number):Promise<Generated>{
 const c=new AbortController();const t=setTimeout(()=>c.abort(),18000);
 try{const payload:any={model:groqModel,messages:[{role:"system",content:system},{role:"user",content:prompt}],temperature,max_completion_tokens:maxTokens};if(groqModel.includes("gpt-oss")){payload.include_reasoning=false;payload.reasoning_effort="low"}const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${groqKey}`},body:JSON.stringify(payload),signal:c.signal});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(String(d?.error?.message||`Groq HTTP ${r.status}`));const content=String(d?.choices?.[0]?.message?.content||"").trim();if(!content)throw new Error("Groq empty response");return{content,provider:"groq",model:groqModel}}finally{clearTimeout(t)}}
async function geminiGenerate(system:string,prompt:string,temperature:number,maxTokens:number):Promise<Generated>{
 const c=new AbortController();const t=setTimeout(()=>c.abort(),18000);
 try{const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`;const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature,maxOutputTokens:maxTokens}}),signal:c.signal});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(String(d?.error?.message||`Gemini HTTP ${r.status}`));const content=String((d?.candidates?.[0]?.content?.parts||[]).map((p:any)=>p?.text||"").join("")).trim();if(!content)throw new Error("Gemini empty response");return{content,provider:"gemini",model:geminiModel}}finally{clearTimeout(t)}}
async function legacyGenerate(system:string,prompt:string,temperature:number,maxTokens:number):Promise<Generated>{const r=await fetch(legacyUrl,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${legacyKey}`},body:JSON.stringify({model:legacyModel,messages:[{role:"system",content:system},{role:"user",content:prompt}],temperature,max_tokens:maxTokens})});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(String(d?.error?.message||`AI HTTP ${r.status}`));const content=String(d?.choices?.[0]?.message?.content||"").trim();if(!content)throw new Error("AI empty response");return{content,provider:"legacy",model:legacyModel}}
async function generate(system:string,prompt:string,temperature:number,maxTokens:number):Promise<Generated>{const errors:string[]=[];if(groqKey){try{return await groqGenerate(system,prompt,temperature,maxTokens)}catch(e){errors.push(`groq:${e instanceof Error?e.message:String(e)}`)}}if(geminiKey){try{return await geminiGenerate(system,prompt,temperature,maxTokens)}catch(e){errors.push(`gemini:${e instanceof Error?e.message:String(e)}`)}}if(legacyUrl&&legacyKey&&legacyModel){try{return await legacyGenerate(system,prompt,temperature,maxTokens)}catch(e){errors.push(`legacy:${e instanceof Error?e.message:String(e)}`)}}if(!groqKey&&!geminiKey&&!(legacyUrl&&legacyKey&&legacyModel))throw new Error("ai_providers_not_configured");throw new Error(`ai_providers_unavailable:${errors.join("|").slice(0,500)}`)}

Deno.serve(async(request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});
 if(request.method!=="POST")return json({error:"method_not_allowed"},405);
 const authHeader=request.headers.get("authorization")||"";if(!authHeader.toLowerCase().startsWith("bearer "))return json({error:"unauthorized"},401);
 if(!supabaseUrl||!anonKey||!serviceRoleKey)return json({error:"supabase_not_configured"},500);
 const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false}});
 const user=await userClient.auth.getUser();if(user.error||!user.data.user)return json({error:"unauthorized"},401);
 const release=await admin.from("platform_release_controls").select("environment_mode,maintenance_mode,ai_generation_enabled").eq("id",1).maybeSingle();if(release.error)return json({error:"release_controls_unavailable"},503);if(release.data?.maintenance_mode)return json({error:"platform_maintenance_mode"},423);if(release.data?.ai_generation_enabled!==true)return json({error:"ai_generation_disabled",environment_mode:release.data?.environment_mode||"unknown"},423);
 let payload:Record<string,unknown>;try{payload=await request.json()}catch{return json({error:"invalid_json"},400)}
 const agencyId=text(payload.agency_id,80);if(!agencyId)return json({error:"agency_required"},400);
 const title=text(payload.title,160),type=text(payload.property_type,80),purpose=text(payload.purpose,40),city=text(payload.city,100),neighborhood=text(payload.neighborhood,100),price=text(payload.price,60),bedrooms=text(payload.bedrooms,20),bathrooms=text(payload.bathrooms,20),suites=text(payload.suites,20),parking=text(payload.parking,20),area=text(payload.area,40),notes=text(payload.notes,1200),tone=text(payload.tone,40)||"profissional";
 if(!title&&!type&&!notes)return json({error:"property_details_required"},400);
 const membership=await userClient.from("agency_memberships").select("role").eq("agency_id",agencyId).eq("user_id",user.data.user.id).eq("active",true).maybeSingle();if(membership.error||!membership.data)return json({error:"agency_access_denied"},403);
 const testAccount=await admin.from("test_client_accounts").select("agency_id").eq("agency_id",agencyId).eq("enabled",true).maybeSingle();if(testAccount.data)return json({error:"test_environment_ai_disabled"},403);
 const reservation=await userClient.rpc("reserve_ai_description_usage",{p_agency_id:agencyId,p_metadata:{source:"admin",tone,title:title||null}});if(reservation.error||!reservation.data)return json({error:reservation.error?.message||"ai_quota_unavailable"},429);const usageEventId=String(reservation.data);
 const facts=[title&&`Título: ${title}`,type&&`Tipo: ${type}`,purpose&&`Finalidade: ${purpose}`,city&&`Cidade: ${city}`,neighborhood&&`Bairro: ${neighborhood}`,price&&`Preço: ${price}`,bedrooms&&`Quartos: ${bedrooms}`,suites&&`Suítes: ${suites}`,bathrooms&&`Banheiros: ${bathrooms}`,parking&&`Vagas: ${parking}`,area&&`Área: ${area}`,notes&&`Observações: ${notes}`].filter(Boolean).join("\n");
 const system="Você é redator de anúncios imobiliários no Brasil. Escreva em português brasileiro, com linguagem clara, persuasiva e responsável. Não invente características, localização, metragem, condições comerciais ou benefícios não fornecidos. Não use promessas absolutas. Produza somente a descrição final, sem título e sem comentários adicionais.";const prompt=`Crie uma descrição de imóvel em tom ${tone}. Use de 2 a 4 parágrafos curtos e, quando fizer sentido, finalize com uma chamada para contato.\n\nDados confirmados:\n${facts}`;
 try{const g=await generate(system,prompt,0.55,700);return json({description:g.content,usage_event_id:usageEventId,provider:g.provider,model:g.model})}catch(e){await userClient.rpc("cancel_ai_description_usage",{p_event_id:usageEventId});const code=e instanceof Error?e.message:String(e);if(code==="ai_providers_not_configured")return json({error:"AI provider ainda não configurado no servidor."},503);return json({error:"Os provedores de IA estão temporariamente indisponíveis."},502)}
});