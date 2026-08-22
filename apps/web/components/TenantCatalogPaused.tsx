export default function TenantCatalogPaused(){
  return <main className="tenantUnavailable">
    <div className="tenantUnavailableCard">
      <span className="eyebrow">LENOY IMOBILIÁRIAS</span>
      <h1>Catálogo temporariamente indisponível</h1>
      <p>Esta vitrine está temporariamente pausada para manutenção ou homologação. O painel administrativo continua separado deste bloqueio.</p>
      <div className="tenantUnavailableActions">
        <a className="button secondary" href="https://imoveis.lenoy.com.br/login/">Entrar no painel</a>
      </div>
      <small>Nenhum imóvel foi excluído. A publicação pública pode ser retomada pelo controle global da plataforma.</small>
    </div>
  </main>;
}
