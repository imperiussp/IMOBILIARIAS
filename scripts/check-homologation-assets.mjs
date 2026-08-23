import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const requiredFiles=[
  ".env.example",
  ".github/workflows/ci.yml",
  "package.json",
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
  "docs/LAUNCH-STATUS.md",
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

const packagePath=path.join(root,"package.json");
if(fs.existsSync(packagePath)){
  const pkg=JSON.parse(fs.readFileSync(packagePath,"utf8"));
  if(!pkg?.scripts?.["release:validate"])errors.push("script obrigatório release:validate ausente do package.json");
}

const healthPath=path.join(root,"apps/web/app/api/health/route.ts");
if(fs.existsSync(healthPath)){
  const health=fs.readFileSync(healthPath,"utf8");
  if(!health.includes("NEXT_PUBLIC_COMMIT_SHA"))errors.push("health não expõe NEXT_PUBLIC_COMMIT_SHA");
  if(!health.includes("NEXT_PUBLIC_BUILD_LABEL"))errors.push("health não expõe NEXT_PUBLIC_BUILD_LABEL");
}

const smokePath=path.join(root,"scripts/post-deploy-smoke.mjs");
if(fs.existsSync(smokePath)){
  const smoke=fs.readFileSync(smokePath,"utf8");
  if(!smoke.includes("EXPECTED_COMMIT_SHA"))errors.push("smoke pós-deploy não valida EXPECTED_COMMIT_SHA");
}

const migrationsDir=path.join(root,"supabase","migrations");
const migrations=fs.readdirSync(migrationsDir).filter(x=>/^\d{4}_.+\.sql$/.test(x)).sort();
if(!migrations.length)errors.push("nenhuma migration encontrada");
else{
  const latest=migrations.at(-1);
  const n=Number(latest.slice(0,4));
  if(n<133)errors.push(`migration mais recente inesperadamente antiga: ${latest}`);
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
    "0130_final_rpc_execute_hardening.sql",
    "0131_revoke_public_execute_inherited.sql",
    "0132_revoke_trigger_rpc_execution.sql",
    "0133_fix_property_storage_tenant_policies.sql",
  ];
  for(const file of requiredMigrationNames){if(!migrations.includes(file))errors.push(`migration de homologação ausente: ${file}`);}
}

if(errors.length){
  console.error("Falha na integridade do kit de homologação:\n- "+errors.join("\n- "));
  process.exit(1);
}
console.log(`Kit de homologação íntegro: ${requiredFiles.length} artefatos, release:validate, build identity, smoke SHA e ${migrations.length} migrations encontrados.`);
