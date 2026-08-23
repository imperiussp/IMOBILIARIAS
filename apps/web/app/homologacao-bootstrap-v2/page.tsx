type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function HomologacaoBootstrapV2Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const success = valueOf(params.success);
  const error = valueOf(params.error);

  return (
    <main className="loginPage">
      <div className="loginShell">
        <a className="brand loginBrand" href="../">
          <img
            src="https://lenoy.com.br/wp-content/uploads/2026/08/hh.png"
            alt="LENOY IMOBILIÁRIAS"
            style={{ width: 118, maxWidth: "34vw", height: "auto", display: "block" }}
          />
        </a>
        <form className="loginCard" action="/api/homologacao-bootstrap-v2" method="post">
          <span className="eyebrow">HOMOLOGAÇÃO V2 • SERVIDOR</span>
          <h1>Criar owner de teste</h1>
          <p>Esta versão não depende do JavaScript do navegador para criar a conta. O formulário é enviado diretamente ao servidor da Vercel.</p>

          {success ? <p className="loginStatus" style={{ border: "1px solid #b7d8c0", background: "#eef8f1" }}>{success}</p> : null}
          {error ? <p className="loginStatus" style={{ border: "1px solid #e3b8b8", background: "#fff1f1" }}>{error}</p> : null}

          <label>Token temporário<input name="bootstrap_token" type="password" autoComplete="off" required /></label>
          <label>Seu nome completo<input name="full_name" autoComplete="name" required maxLength={160} /></label>
          <label>Nome da imobiliária<input name="agency_name" required maxLength={160} /></label>
          <label>Endereço do site
            <div className="slugField">
              <input name="agency_slug" placeholder="homologacao-a" pattern="[a-z0-9][a-z0-9-]{1,46}[a-z0-9]" required />
              <span>.imoveis.lenoy.com.br</span>
            </div>
          </label>
          <small className="slugHint">Use letras minúsculas, números e hífen.</small>
          <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
          <label>Senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label>Confirmar senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
          <button className="button primary full" type="submit">Criar conta de homologação V2</button>
          <a className="backLink" href="../login/">← Voltar ao login</a>
        </form>
      </div>
    </main>
  );
}
