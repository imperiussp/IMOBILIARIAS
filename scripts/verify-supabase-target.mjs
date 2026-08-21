const expected = String(process.env.IMOBILIARIAS_SUPABASE_PROJECT_REF || "").trim();
const target = String(process.env.SUPABASE_PROJECT_REF || "").trim();

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

console.log(`OK: destino Supabase confirmado para IMOBILIARIAS (${target}).`);
