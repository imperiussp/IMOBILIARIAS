import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const OFFICIAL_SUPABASE_PROJECT_REF = "rvjsonspplqelktzwusu";

type RegistrationStatus = {
  enabled: boolean;
  environment_mode: string;
  release_label: string | null;
};

type CatalogStatus = {
  enabled: boolean;
  maintenance_mode: boolean;
  environment_mode: string;
};

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value) && value.length > 0) return value[0] as T;
  if (value && typeof value === "object") return value as T;
  return null;
}

export async function GET(){
  const url=String(process.env.NEXT_PUBLIC_SUPABASE_URL||"").trim();
  const publicKey=String(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"").trim();
  const expectedRef=String(process.env.IMOBILIARIAS_SUPABASE_PROJECT_REF||process.env.SUPABASE_PROJECT_REF||OFFICIAL_SUPABASE_PROJECT_REF).trim();
  const allowIndexing=String(process.env.NEXT_PUBLIC_ALLOW_INDEXING||"false").toLowerCase()==="true";
  const commitSha=String(process.env.NEXT_PUBLIC_COMMIT_SHA||process.env.VERCEL_GIT_COMMIT_SHA||"").trim().toLowerCase()||null;
  const buildLabel=String(process.env.NEXT_PUBLIC_BUILD_LABEL||"").trim()||null;

  const checks={
    web:true,
    supabase_configured:Boolean(url&&publicKey),
    project_identity:false,
    project_ref_matches:false,
    release_controls_available:false,
    indexing_enabled:allowIndexing,
    build_identity_present:Boolean(commitSha&&buildLabel),
  };

  let identity:string|null=null;
  let supabaseError:string|null=null;
  let urlRef:string|null=null;
  let registration:RegistrationStatus|null=null;
  let catalog:CatalogStatus|null=null;

  try{
    if(url){
      const host=new URL(url).hostname;
      urlRef=host.endsWith(".supabase.co")?host.split(".")[0]:null;
      checks.project_ref_matches=Boolean(expectedRef&&urlRef===expectedRef);
    }
  }catch{
    checks.project_ref_matches=false;
  }

  if(url&&publicKey){
    try{
      const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const [identityResult,registrationResult,catalogResult]=await Promise.all([
        client.rpc("project_identity"),
        client.rpc("platform_registration_status"),
        client.rpc("platform_public_catalog_status"),
      ]);

      if(identityResult.error){
        supabaseError="project_identity_unavailable";
      }else{
        identity=typeof identityResult.data==="string"?identityResult.data:null;
        checks.project_identity=identity==="IMOBILIARIAS";
      }

      if(!registrationResult.error)registration=firstRow<RegistrationStatus>(registrationResult.data);
      if(!catalogResult.error)catalog=firstRow<CatalogStatus>(catalogResult.data);
      checks.release_controls_available=Boolean(registration&&catalog);

      if(!supabaseError&&(registrationResult.error||catalogResult.error))supabaseError="release_controls_unavailable";
    }catch{
      supabaseError="supabase_unreachable";
    }
  }

  const appEnvironment=registration?.environment_mode||catalog?.environment_mode||"unknown";
  const releaseLabel=registration?.release_label||buildLabel;
  const healthy=checks.web&&checks.supabase_configured&&checks.project_identity&&checks.project_ref_matches;
  const body={
    service:"LENOY IMOBILIÁRIAS",
    status:healthy?"ok":"degraded",
    environment:appEnvironment,
    runtime:{node_env:process.env.NODE_ENV||"unknown"},
    build:{commit_sha:commitSha,build_label:buildLabel,release_label:releaseLabel},
    release:{
      public_registration_enabled:registration?.enabled??null,
      public_catalog_enabled:catalog?.enabled??null,
      maintenance_mode:catalog?.maintenance_mode??null,
    },
    checks,
    identity,
    error:supabaseError,
    timestamp:new Date().toISOString(),
  };

  return NextResponse.json(body,{status:healthy?200:503,headers:{"Cache-Control":"no-store"}});
}
