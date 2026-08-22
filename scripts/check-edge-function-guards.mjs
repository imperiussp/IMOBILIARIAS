import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "supabase", "config.toml");
const config = fs.readFileSync(configPath, "utf8");

const required = {
  "platform-maintenance": ["PLATFORM_MAINTENANCE_SECRET"],
  "reconcile-outreach-provider-events": ["PLATFORM_MAINTENANCE_SECRET"],
  "process-subscription-expiry": ["BILLING_MAINTENANCE_SECRET"],
  "verify-custom-domains": ["DOMAIN_VERIFY_SECRET"],
  "push-broker-notifications": ["PUSH_DISPATCH_SECRET"],
  "process-buyer-opportunities": ["BUYER_OUTREACH_MAINTENANCE_SECRET"],
  "deliver-buyer-outreach": ["BUYER_OUTREACH_WEBHOOK_TOKEN"],
  "buyer-outreach-health": ["BUYER_OUTREACH_WEBHOOK_TOKEN"],
  "buyer-outreach-webhook": ["BUYER_OUTREACH_PROVIDER_WEBHOOK_SECRET"],
  "ingest-inbound-email": ["INBOUND_EMAIL_SECRET"],
  "meta-whatsapp-webhook": ["META_APP_SECRET", "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN"],
  "resend-outreach-webhook": ["RESEND_WEBHOOK_SIGNING_SECRET"],
  "infinitepay-webhook": ["INFINITEPAY_WEBHOOK_SECRET"],
};

const errors = [];
for (const [name, envNames] of Object.entries(required)) {
  const section = `[functions.${name}]`;
  const sectionIndex = config.indexOf(section);
  if (sectionIndex < 0) {
    errors.push(`${name}: ausente de supabase/config.toml`);
    continue;
  }
  const after = config.slice(sectionIndex + section.length);
  const nextSection = after.indexOf("\n[functions.");
  const block = nextSection >= 0 ? after.slice(0, nextSection) : after;
  if (!/verify_jwt\s*=\s*false/.test(block)) {
    errors.push(`${name}: esperado verify_jwt=false para endpoint externo/interno protegido pelo próprio segredo`);
  }

  const sourcePath = path.join(root, "supabase", "functions", name, "index.ts");
  if (!fs.existsSync(sourcePath)) {
    errors.push(`${name}: index.ts ausente`);
    continue;
  }
  const source = fs.readFileSync(sourcePath, "utf8");
  for (const envName of envNames) {
    if (!source.includes(envName)) errors.push(`${name}: não referencia ${envName}`);
  }

  const hasUnauthorized = /unauthorized|invalid_signature|forbidden|webhook_secret/i.test(source);
  if (!hasUnauthorized) errors.push(`${name}: nenhuma sinalização de rejeição/autenticação encontrada no código`);
}

if (errors.length) {
  console.error("Falha na verificação de guards das Edge Functions:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`Edge Function guards: ${Object.keys(required).length} endpoints verificados.`);
