import { properties } from "../../lib/properties";

export default function AdminPage() {
  const forSale = properties.filter((item) => item.purpose === "Venda").length;
  const forRent = properties.filter((item) => item.purpose === "Locação").length;

  return (
    <main className="adminPage">
      <header className="adminTopbar">
        <div className="container adminNav">
          <a className="brand" href="../"><span className="brandMark">I</span><span>IMOBILIARIAS</span></a>
          <div className="adminNavActions"><span>Painel administrativo</span><a className="button primary small" href="../">Ver site</a></div>
        </div>
      </header>

      <div className="container adminShell">
        <aside className="adminSidebar">
          <strong>Gestão</strong>
          <a className="active" href="#visao-geral">Visão geral</a>
          <a href="#imoveis">Imóveis</a>
          <a href="#novo-imovel">Novo imóvel</a>
          <a href="#corretores">Corretores</a>
          <a href="#contatos">Contatos</a>
        </aside>

        <section className="adminContent" id="visao-geral">
          <div className="adminHeading"><div><span className="eyebrow">PAINEL</span><h1>Visão geral</h1><p>Acompanhe os imóveis e prepare novos cadastros.</p></div><a className="button primary" href="#novo-imovel">+ Cadastrar imóvel</a></div>

          <div className="adminMetrics">
            <article><span>Total de imóveis</span><strong>{properties.length}</strong><small>Base demonstrativa</small></article>
            <article><span>Para venda</span><strong>{forSale}</strong><small>Ativos no catálogo</small></article>
            <article><span>Para locação</span><strong>{forRent}</strong><small>Ativos no catálogo</small></article>
            <article><span>Contatos recebidos</span><strong>0</strong><small>Aguardando integração</small></article>
          </div>

          <div className="adminPanel" id="imoveis">
            <div className="adminPanelHeader"><div><span className="eyebrow">CATÁLOGO</span><h2>Imóveis cadastrados</h2></div><span>{properties.length} registros</span></div>
            <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Código</th><th>Imóvel</th><th>Local</th><th>Finalidade</th><th>Valor</th><th>Status</th></tr></thead><tbody>{properties.map((property) => <tr key={property.code}><td><strong>{property.code}</strong></td><td>{property.title}</td><td>{property.city}</td><td>{property.purpose}</td><td>{property.price}</td><td><span className="statusPill">Disponível</span></td></tr>)}</tbody></table></div>
          </div>

          <div className="adminPanel" id="novo-imovel">
            <div className="adminPanelHeader"><div><span className="eyebrow">CADASTRO</span><h2>Novo imóvel</h2><p>Interface preparada para ser conectada ao Supabase.</p></div></div>
            <form className="propertyForm">
              <label>Título do imóvel<input placeholder="Ex.: Casa com 3 quartos no Centro" /></label>
              <div className="formGrid"><label>Finalidade<select defaultValue="Venda"><option>Venda</option><option>Locação</option></select></label><label>Tipo<select defaultValue="Casa"><option>Casa</option><option>Apartamento</option><option>Comercial</option><option>Rural</option></select></label></div>
              <div className="formGrid"><label>Cidade<input placeholder="Sengés - PR" /></label><label>Bairro<input placeholder="Centro" /></label></div>
              <div className="formGrid"><label>Valor<input placeholder="R$ 0,00" /></label><label>Área<input placeholder="0 m²" /></label></div>
              <div className="formGrid three"><label>Quartos<input type="number" min="0" defaultValue="0" /></label><label>Banheiros<input type="number" min="0" defaultValue="0" /></label><label>Vagas<input type="number" min="0" defaultValue="0" /></label></div>
              <label>Descrição<textarea rows={5} placeholder="Descreva os principais diferenciais do imóvel." /></label>
              <label className="uploadBox">Fotos do imóvel<input type="file" multiple accept="image/*" /><span>Selecione várias fotos. A compressão e o envio serão ativados na integração.</span></label>
              <div className="formActions"><button type="button" className="button secondary">Salvar rascunho</button><button type="button" className="button primary">Publicar imóvel</button></div>
            </form>
          </div>

          <div className="adminSplit">
            <div className="adminPanel" id="corretores"><span className="eyebrow">EQUIPE</span><h2>Corretores</h2><p>Cadastro de nome, WhatsApp, CRECI e região de atuação será centralizado aqui.</p><button className="button secondary" type="button">Adicionar corretor</button></div>
            <div className="adminPanel" id="contatos"><span className="eyebrow">LEADS</span><h2>Contatos recebidos</h2><p>Os pedidos vindos das páginas dos imóveis aparecerão aqui quando o backend estiver conectado.</p><span className="emptyMini">Nenhum contato ainda</span></div>
          </div>
        </section>
      </div>
    </main>
  );
}
