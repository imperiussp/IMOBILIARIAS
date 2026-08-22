import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "supabase", "migrations");
const files = fs.readdirSync(dir).filter((name)=>name.endsWith(".sql")).sort();
const errors=[];
const warnings=[];

for(const file of files){
  const full=path.join(dir,file);
  const sql=fs.readFileSync(full,"utf8");
  const lower=sql.toLowerCase();

  // SECURITY DEFINER deve sempre fixar search_path para reduzir risco de hijacking.
  if(lower.includes("security definer") && !/set\s+search_path\s*=/.test(lower)){
    errors.push(`${file}: SECURITY DEFINER sem SET search_path`);
  }

  // Bloqueia operações destrutivas de alto risco no histórico normal de migrations.
  if(/drop\s+(schema|database)\b/i.test(sql)) errors.push(`${file}: DROP SCHEMA/DATABASE não permitido`);
  if(/truncate\s+table\b/i.test(sql)) warnings.push(`${file}: TRUNCATE TABLE detectado; revisar manualmente`);

  // Novas tabelas com agency_id devem ter RLS habilitado no mesmo arquivo ou em migration posterior.
  const created=[...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)/gi)].map(m=>m[1]);
  for(const table of created){
    const tablePattern=new RegExp(`create\\s+table[\\s\\S]{0,4000}?public\\.${table}\\b[\\s\\S]{0,4000}?agency_id\\b`,`i`);
    if(tablePattern.test(sql)){
      const rlsPattern=new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,`i`);
      const rlsLater=files.some((later)=>later>file && new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,`i`).test(fs.readFileSync(path.join(dir,later),"utf8")));
      if(!rlsPattern.test(sql) && !rlsLater) errors.push(`${file}: tabela tenant ${table} criada com agency_id sem RLS encontrado`);
    }
  }
}

if(warnings.length) console.warn("Avisos de migration:\n- "+warnings.join("\n- "));
if(errors.length){
  console.error("Falha na verificação de segurança das migrations:\n- "+errors.join("\n- "));
  process.exit(1);
}
console.log(`Migration safety: ${files.length} arquivo(s) verificados.`);
