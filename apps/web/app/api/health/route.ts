import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(){
  const url=String(process.env.NEXT_PUBLIC_SUPABASE_URL||"").trim();
  const anon=String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||"").trim();
  const expectedRef=String(process.env.IMOBILIARIAS_SUPABASE_PROJECT_REF||process.env.SUPABASE_PROJECT_REF||"").trim();
  const allowIndexing=String(process.env.NEXT_PUBLIC_ALLOW_INDEXING||"false").toLowerCase()==="true";
  const commitSha=String(process.env.NEXT_PUBLIC_COMMIT_SHA||"").trim().toLowerCase()||null;
  const buildLabel=String(process.env.NEXT_PUBLIC_BUILD_LABEL||"").trim()||null;

  const checks={
    web:true,
    supabase_configured:Boolean(url&&anon),
    project_identity:false,
    project_ref_matches:false,
    indexing_enabled:allowIndexing,
    build_identity_present:Boolean(commitSha&&buildLabel),
  };

  let identity:string|null=null;
  let supabaseError:string|null=null;
  let urlRef:string|null=null;

  try{
    if(url){
      const host=new URL(url).hostname;
      urlRef=host.endsWith(".supabase.co")?host.split(".")[0]:null;
      checks.project_ref_matches=Boolean(expectedRef&&urlRef===expectedRef);
    }
  }catch{
    checks.project_ref_matches=false;
  }

  if(url&&anon){
    try{
      const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
      const result=await client.rpc("project_identity");
      if(result.error)supabaseError="project_identity_unavailable";
      else{
        identity=typeof result.data==="string"?result.data:null;
        checks.project_identity=identity==="IMOBILIARIAS";
      }
    }catch{
      supabaseError="supabase_unreachable";
    }
  }

  const healthy=checks.web&&checks.supabase_configured&&checks.project_identity&&checks.project_ref_matches;
  const body={
    service:"LENOY IMOBILIÁRIAS",
    status:healthy?"ok":"degraded",
    environment:process.env.NODE_ENV||"unknown",
    build:{commit_sha:commitSha,build_label:buildLabel},
    checks,
    identity,
    error:supabaseError,
    timestamp:new Date().toISOString(),
  };

  return NextResponse.json(body,{status:healthy?200:503,headers:{"Cache-Control":"no-store"}});
}
