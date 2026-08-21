import AdminPropertyForm from "../../components/AdminPropertyForm";
import { properties } from "../../lib/properties";

export default function AdminPage() {
  const forSale = properties.filter((item) => item.purpose === "Venda").length;
  const forRent = properties.filter((item) => item.purpose === "Locação").length;

  return (
    <main className="adminPage">
      <header className="adminTopbar">
        <div className="container adminNav">
          <a className="brand" href="../"><span className="brandMark">I</span><span>IMOBILIARIAS</span></a>
          <div className="adminNavActions"><span>Painel administrativo</span><a href="../login/">Entrar</a><a className="button primary small" href="../">Ver site</a></div>
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
          <div className="adminHeading"><div><span className="eyebrow">PAINEL</span><h1>Visão geral</h1><p>Gerencie catálogo, equipe e atendimento em um só lugar.</p></div><a className="button primary" href="#novo-imovel">+ Cadastrar imóvel</a></div>

          <div className="adminMetrics">
            <article><span>Total de imóveis</span><strong>{properties.length}</strong><small>Base demonstrativa + Supabase</small></article>
            <article><span>Para venda</span><strong>{forSale}</strong><small>Ativos no catálogo demo</small></article>
            <article><span>Para locação</span><strong>{forRent}</strong><small>Ativos no catálogo demo</small></article>
            <article><span>Contatos recebidos</span><strong>0</strong><small>Atualiza quando o backend estiver conectado</small></article>
          </div>

          <div className="adminPanel" id="imoveis">
            <div className="adminPanelHeader"><div><span className="eyebrow">CATÁLOGO</span><h2>Imóveis cadastrados</h2></div><span>{properties.length} registros demonstrativos</span></div>
            <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Código</th><th>Imóvel</th><th>Local</th><th>Finalidade</th><th>Valor</th><th>Status</th></tr></thead><tbody>{properties.map((property) => <tr key={property.code}><td><strong>{property.code}</strong></td><td>{property.title}</td><td>{property.city}</td><td>{property.purpose}</td><td>{property.price}</td><td><span className="statusPill">Disponível</span></td></tr>)}</tbody></table></div>
          </div>

          <div className="adminPanel" id="novo-imovel">
            <div className="adminPanelHeader"><div><span className="eyebrow">CADASTRO REAL</span><h2>Novo imóvel</h2><p>Quando as chaves do Supabase estiverem configuradas, este formulário grava diretamente na base.</p></div></div>
            <AdminPropertyForm />
          </div>

          <div className="adminSplit">
            <div className="adminPanel" id="corretores"><span className="eyebrow">EQUIPE</span><h2>Corretores</h2><p>Nome, WhatsApp, CRECI e vínculo dos imóveis serão administrados nesta área.</p><button className="button secondary" type="button">Adicionar corretor</button></div>
            <div className="adminPanel" id="contatos"><span className="eyebrow">LEADS</span><h2>Contatos recebidos</h2><p>Os pedidos das páginas dos imóveis serão armazenados na tabela de leads e vinculados ao imóvel e corretor responsáveis.</p><span className="emptyMini">Nenhum contato ainda</span></div>
          </div>
        </section>
      </div>
    </main>
  );
}
