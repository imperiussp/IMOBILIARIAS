import AdminLiveData from "../../components/AdminLiveData";
import AdminPropertyForm from "../../components/AdminPropertyForm";

export default function AdminPage() {
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

          <AdminLiveData />

          <div className="adminPanel" id="novo-imovel">
            <div className="adminPanelHeader"><div><span className="eyebrow">CADASTRO REAL</span><h2>Novo imóvel</h2><p>O formulário já grava no Supabase e pode enviar fotos para o storage quando as chaves do projeto estiverem configuradas.</p></div></div>
            <AdminPropertyForm />
          </div>

          <div className="adminPanel" id="corretores">
            <span className="eyebrow">EQUIPE</span>
            <h2>Corretores</h2>
            <p>Nome, WhatsApp, CRECI e vínculo dos imóveis ficam centralizados no mesmo banco. A próxima evolução desta área será cadastro, edição e ativação de corretores sem sair do painel.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
