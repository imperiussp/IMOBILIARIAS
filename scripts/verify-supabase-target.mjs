const expected = String(process.env.IMOBILIARIAS_SUPABASE_PROJECT_REF || "").trim();
const target = String(process.env.SUPABASE_PROJECT_REF || "").trim();

function projectRefFromUrl(value){
  const raw=String(value||"").trim();
  if(!raw)return "";
  try{
    const host=new URL(raw).hostname.toLowerCase();
    const suffix=".supabase.co";
    return host.endsWith(suffix)?host.slice(0,-suffix.length):"";
  }catch{return "";}
}

if (!expected) {
  console.error("BLOQUEADO: defina IMOBILIARIAS_SUPABASE_PROJECT_REF com o project ref exclusivo do IMOBILIARIAS.");
  process.exit(2);
}

if (!target) {
  console.error("BLOQUEADO: não foi informado SUPABASE_PROJECT_REF para o destino da migration.");
  process.exit(2);
}

if (expected !== target) {
  console.error(`BLOQUEADO: destino ${target} não corresponde ao Supabase autorizado do IMOBILIARIAS (${expected}).`);
  console.error("Nenhuma migration deve ser executada. Isso protege Moto Connect e outros projetos.");
  process.exit(3);
}

const urlVars=["SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL","EXPO_PUBLIC_SUPABASE_URL"];
const mismatches=[];
for(const name of urlVars){
  const value=process.env[name];
  if(!value)continue;
  const ref=projectRefFromUrl(value);
  if(!ref)mismatches.push(`${name}: URL inválida ou fora de *.supabase.co`);
  else if(ref!==expected)mismatches.push(`${name}: aponta para ${ref}, esperado ${expected}`);
}
if(mismatches.length){
  console.error("BLOQUEADO: há URLs Supabase inconsistentes com o projeto autorizado:\n- "+mismatches.join("\n- "));
  process.exit(4);
}

console.log(`OK: destino e URLs Supabase confirmados para IMOBILIARIAS (${target}).`);
