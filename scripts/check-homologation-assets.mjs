import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const requiredFiles=[
  ".env.example",
  ".github/workflows/ci.yml",
  "scripts/verify-supabase-target.mjs",
  "scripts/check-env-contract.mjs",
  "scripts/check-edge-function-guards.mjs",
  "scripts/check-migration-safety.mjs",
  "scripts/post-deploy-smoke.mjs",
  "supabase/tests/tenant-isolation-regression.sql",
  "docs/HOMOLOGATION-GO-LIVE.md",
  "docs/GO-LIVE-CHECKLIST.md",
  "docs/DEPLOYMENT-RUNBOOK.md",
  "docs/POST-DEPLOY-CHECKLIST.md",
  "docs/ROLLBACK-PLAN.md",
  "apps/web/app/api/health/route.ts",
  "apps/web/components/PlatformTechnicalHealth.tsx",
  "apps/web/components/PlatformDeploymentReleases.tsx",
  "apps/web/components/PlatformHomologationReadiness.tsx",
  "apps/web/components/PlatformDeploymentCheckpoints.tsx",
  "apps/web/components/PlatformTenantSecurityAudit.tsx",
  "apps/web/components/PlatformReleaseValidations.tsx",
];
const errors=[];
for(const file of requiredFiles){if(!fs.existsSync(path.join(root,file)))errors.push(`arquivo obrigatório de homologação ausente: ${file}`);}

const migrationsDir=path.join(root,"supabase","migrations");
const migrations=fs.readdirSync(migrationsDir).filter(x=>/^\d{4}_.+\.sql$/.test(x)).sort();
if(!migrations.length)errors.push("nenhuma migration encontrada");
else{
  const latest=migrations.at(-1);
  const n=Number(latest.slice(0,4));
  if(n<129)errors.push(`migration mais recente inesperadamente antiga: ${latest}`);
  const requiredMigrationNames=[
    "0109_platform_release_controls.sql",
    "0116_runtime_action_gate.sql",
    "0118_platform_tenant_security_audit.sql",
    "0120_release_validation_evidence.sql",
    "0123_inherited_tenant_audit.sql",
    "0124_platform_deployment_checkpoints.sql",
    "0125_deployment_readiness_in_release_gate.sql",
    "0126_deployment_checkpoint_history.sql",
    "0127_deployment_rollback_and_smoke_checks.sql",
    "0128_platform_deployment_releases.sql",
    "0129_production_requires_smoke_validated_release.sql",
  ];
  for(const file of requiredMigrationNames){if(!migrations.includes(file))errors.push(`migration de homologação ausente: ${file}`);}
}

if(errors.length){
  console.error("Falha na integridade do kit de homologação:\n- "+errors.join("\n- "));
  process.exit(1);
}
console.log(`Kit de homologação íntegro: ${requiredFiles.length} artefatos e ${migrations.length} migrations encontrados.`);
