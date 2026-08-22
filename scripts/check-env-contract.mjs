import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const envPath=path.join(root,".env.example");
if(!fs.existsSync(envPath)){
  console.error(".env.example ausente");
  process.exit(1);
}
const text=fs.readFileSync(envPath,"utf8");
const vars=new Set([...text.matchAll(/^([A-Z0-9_]+)=/gm)].map(m=>m[1]));

const required=[
  "IMOBILIARIAS_SUPABASE_PROJECT_REF","SUPABASE_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_URL","EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_PLATFORM_HOST","NEXT_PUBLIC_SITE_URL","NEXT_PUBLIC_ALLOW_INDEXING",
  "SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","PLATFORM_SITE_URL",
  "PLATFORM_MAINTENANCE_SECRET","BILLING_MAINTENANCE_SECRET","PUSH_DISPATCH_SECRET","DOMAIN_VERIFY_SECRET",
  "INFINITEPAY_HANDLE","INFINITEPAY_WEBHOOK_SECRET","INBOUND_EMAIL_SECRET",
  "AI_API_URL","AI_API_KEY","AI_MODEL",
  "BUYER_OUTREACH_MAINTENANCE_SECRET","BUYER_OUTREACH_WEBHOOK_URL","BUYER_OUTREACH_WEBHOOK_TOKEN","BUYER_OUTREACH_PROVIDER_WEBHOOK_SECRET",
  "META_WHATSAPP_ACCESS_TOKEN","META_WHATSAPP_PHONE_NUMBER_ID","META_GRAPH_API_VERSION","META_WHATSAPP_WEBHOOK_VERIFY_TOKEN","META_APP_SECRET",
  "RESEND_API_KEY","RESEND_FROM_EMAIL","RESEND_WEBHOOK_SIGNING_SECRET"
];

const errors=[];
for(const name of required){if(!vars.has(name))errors.push(`variável obrigatória ausente do contrato: ${name}`);}

const secretLike=/(SECRET|SERVICE_ROLE|API_KEY|ACCESS_TOKEN|WEBHOOK_TOKEN|APP_SECRET)/i;
for(const name of vars){
  if((name.startsWith("NEXT_PUBLIC_")||name.startsWith("EXPO_PUBLIC_"))&&secretLike.test(name)){
    errors.push(`segredo potencial exposto em variável pública: ${name}`);
  }
}

if(!/NEXT_PUBLIC_ALLOW_INDEXING=false/.test(text)) errors.push("NEXT_PUBLIC_ALLOW_INDEXING deve permanecer false no exemplo seguro");
if(!/NEXT_PUBLIC_PLATFORM_HOST=imoveis\.lenoy\.com\.br/.test(text)) errors.push("host principal esperado não está documentado corretamente");
if(!/NEXT_PUBLIC_SITE_URL=https:\/\/imoveis\.lenoy\.com\.br/.test(text)) errors.push("URL pública principal esperada não está documentada corretamente");

if(errors.length){
  console.error("Falha no contrato de ambiente:\n- "+errors.join("\n- "));
  process.exit(1);
}
console.log(`Contrato de ambiente OK: ${vars.size} variável(is) documentada(s), sem segredo público evidente.`);
