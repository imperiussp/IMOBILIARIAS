const base=String(process.env.DEPLOYMENT_URL||process.env.NEXT_PUBLIC_SITE_URL||'').trim().replace(/\/$/,'');
const expectedSha=String(process.env.EXPECTED_COMMIT_SHA||process.env.EXPECT_COMMIT_SHA||'').trim().toLowerCase();
const expectedEnvironment=String(process.env.EXPECT_APP_ENVIRONMENT||'').trim().toLowerCase();
const expectedRegistration=String(process.env.EXPECT_REGISTRATION_ENABLED||'').trim().toLowerCase();
const expectedIndexing=String(process.env.EXPECT_INDEXING||'false').trim().toLowerCase()==='true';

if(!base){console.error('BLOQUEADO: defina DEPLOYMENT_URL ou NEXT_PUBLIC_SITE_URL.');process.exit(2);}
if(!base.startsWith('https://')){console.error('BLOQUEADO: smoke test exige HTTPS.');process.exit(2);}

const failures=[];
async function request(path,expectStatus=200){
  try{
    const r=await fetch(`${base}${path}`,{redirect:'follow',headers:{'user-agent':'IMOBILIARIAS-post-deploy-smoke/1.2'}});
    if(r.status!==expectStatus)failures.push(`${path}: HTTP ${r.status}, esperado ${expectStatus}`);
    return r;
  }catch(error){failures.push(`${path}: ${error instanceof Error?error.message:String(error)}`);return null;}
}

const home=await request('/');
if(home){const text=await home.text();if(!/LENOY IMOBILIÁRIAS/i.test(text))failures.push('/: identidade LENOY IMOBILIÁRIAS não encontrada');}

const routeChecks=[
  ['/login','entrar|login|acesso'],
  ['/cadastro','cadastro|imobiliária|conta'],
  ['/imovel','imóvel|carregando'],
  ['/admin','acesso|admin|painel'],
];
for(const [path,pattern] of routeChecks){
  const response=await request(path);
  if(response){const text=await response.text();if(!(new RegExp(pattern,'i')).test(text))failures.push(`${path}: conteúdo esperado não reconhecido`);}
}

const health=await request('/api/health');
if(health){
  try{
    const data=await health.json();
    if(data?.service!=='LENOY IMOBILIÁRIAS')failures.push('/api/health: service inesperado');
    if(data?.status!=='ok')failures.push(`/api/health: status ${data?.status||'ausente'}`);
    if(data?.identity!=='IMOBILIARIAS')failures.push('/api/health: project_identity inválida');
    if(data?.checks?.supabase_configured!==true)failures.push('/api/health: Supabase não configurado');
    if(data?.checks?.project_ref_matches!==true)failures.push('/api/health: project ref divergente');
    if(data?.checks?.release_controls_available!==true)failures.push('/api/health: controles de release indisponíveis');
    if(data?.checks?.build_identity_present!==true)failures.push('/api/health: identidade do build ausente');

    if(expectedEnvironment){
      const deployedEnvironment=String(data?.environment||'').toLowerCase();
      if(deployedEnvironment!==expectedEnvironment)failures.push(`/api/health: ambiente ${deployedEnvironment||'ausente'} diferente de ${expectedEnvironment}`);
    }

    if(expectedRegistration==='true'||expectedRegistration==='false'){
      const expected=expectedRegistration==='true';
      if(data?.release?.public_registration_enabled!==expected)failures.push(`/api/health: cadastro público ${String(data?.release?.public_registration_enabled)} diferente de ${expected}`);
    }else if(expectedEnvironment==='homologation'&&data?.release?.public_registration_enabled!==false){
      failures.push('/api/health: homologação não pode deixar cadastro público aberto por padrão');
    }

    if(expectedEnvironment==='homologation'&&data?.checks?.indexing_enabled!==false){
      failures.push('/api/health: homologação está com indexação pública habilitada');
    }

    if(expectedSha){
      const deployedSha=String(data?.build?.commit_sha||'').toLowerCase();
      if(!deployedSha)failures.push('/api/health: commit_sha ausente');
      else if(!(deployedSha===expectedSha||deployedSha.startsWith(expectedSha)||expectedSha.startsWith(deployedSha)))failures.push(`/api/health: commit ${deployedSha} diferente do esperado ${expectedSha}`);
    }
  }catch{failures.push('/api/health: resposta JSON inválida');}
}

const robots=await request('/robots.txt');
if(robots){
  const text=await robots.text();
  if(!expectedIndexing&&!/Disallow:\s*\//i.test(text))failures.push('/robots.txt: ambiente deveria bloquear indexação');
  if(expectedIndexing&&/Disallow:\s*\//i.test(text))failures.push('/robots.txt: produção deveria permitir indexação quando explicitamente esperada');
}

if(failures.length){
  console.error('SMOKE TEST FALHOU:');
  for(const item of failures)console.error(`- ${item}`);
  process.exit(1);
}
console.log(`OK: smoke test pós-deploy aprovado em ${base}${expectedSha?` para commit ${expectedSha}`:''}${expectedEnvironment?` no ambiente ${expectedEnvironment}`:''}`);
