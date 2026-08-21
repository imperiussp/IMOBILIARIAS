export default function TenantUnavailable({ hostname }: { hostname: string }) {
  return <main className="tenantUnavailable">
    <div className="tenantUnavailableCard">
      <span className="eyebrow">LENOY IMÓVEIS</span>
      <h1>Imobiliária não localizada</h1>
      <p>O endereço <strong>{hostname || "informado"}</strong> ainda não está vinculado a uma imobiliária ativa nesta plataforma.</p>
      <div className="tenantUnavailableActions">
        <a className="button primary" href="https://imoveis.lenoy.com.br/">Ir para LENOY IMÓVEIS</a>
        <a className="button secondary" href="https://imoveis.lenoy.com.br/login/">Entrar no painel</a>
      </div>
      <small>Se este domínio acabou de ser configurado, a validação de DNS pode ainda estar pendente.</small>
    </div>
  </main>;
}
