const base=String(process.env.DEPLOYMENT_URL||process.env.NEXT_PUBLIC_SITE_URL||'').trim().replace(/\/$/,'');
if(!base){console.error('BLOQUEADO: defina DEPLOYMENT_URL ou NEXT_PUBLIC_SITE_URL.');process.exit(2);}
if(!base.startsWith('https://')){console.error('BLOQUEADO: smoke test exige HTTPS.');process.exit(2);}

const failures=[];
async function request(path,expectStatus=200){
  try{
    const r=await fetch(`${base}${path}`,{redirect:'follow',headers:{'user-agent':'IMOBILIARIAS-post-deploy-smoke/1.0'}});
    if(r.status!==expectStatus)failures.push(`${path}: HTTP ${r.status}, esperado ${expectStatus}`);
    return r;
  }catch(error){failures.push(`${path}: ${error instanceof Error?error.message:String(error)}`);return null;}
}

const home=await request('/');
if(home){const text=await home.text();if(!/LENOY IMOBILIÁRIAS/i.test(text))failures.push('/: identidade LENOY IMOBILIÁRIAS não encontrada');}

const login=await request('/login/');
if(login){const text=await login.text();if(!/entrar|login|acesso/i.test(text))failures.push('/login/: conteúdo de autenticação não reconhecido');}

const health=await request('/api/health');
if(health){
  try{
    const data=await health.json();
    if(data?.service!=='LENOY IMOBILIÁRIAS')failures.push('/api/health: service inesperado');
    if(data?.status!=='ok')failures.push(`/api/health: status ${data?.status||'ausente'}`);
    if(data?.identity!=='IMOBILIARIAS')failures.push('/api/health: project_identity inválida');
  }catch{failures.push('/api/health: resposta JSON inválida');}
}

const robots=await request('/robots.txt');
if(robots){
  const text=await robots.text();
  const allowIndexing=String(process.env.EXPECT_INDEXING||'false').toLowerCase()==='true';
  if(!allowIndexing&&!/Disallow:\s*\//i.test(text))failures.push('/robots.txt: homologação deveria bloquear indexação');
}

if(failures.length){
  console.error('SMOKE TEST FALHOU:');
  for(const item of failures)console.error(`- ${item}`);
  process.exit(1);
}
console.log(`OK: smoke test pós-deploy aprovado em ${base}`);
