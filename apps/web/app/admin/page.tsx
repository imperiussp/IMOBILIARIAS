import AdminAuditLog from "../../components/AdminAuditLog";
import AdminBrokers from "../../components/AdminBrokers";
import AdminCatalogSettings from "../../components/AdminCatalogSettings";
import AdminGate from "../../components/AdminGate";
import AdminLiveData from "../../components/AdminLiveData";
import AdminLocations from "../../components/AdminLocations";
import AdminPropertyForm from "../../components/AdminPropertyForm";
import AdminSiteSettings from "../../components/AdminSiteSettings";
import AdminUsers from "../../components/AdminUsers";

export default function AdminPage() {
  return (
    <AdminGate>
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
            <a href="#localidades">Localidades</a>
            <a href="#catalogo-config">Tipos e recursos</a>
            <a href="#corretores">Corretores</a>
            <a href="#usuarios">Usuários</a>
            <a href="#configuracoes">Imobiliária</a>
            <a href="#contatos">Contatos</a>
            <a href="#historico">Histórico</a>
            <a href="#exportacoes">Exportações</a>
          </aside>

          <section className="adminContent" id="visao-geral">
            <div className="adminHeading"><div><span className="eyebrow">PAINEL</span><h1>Visão geral</h1><p>Gerencie catálogo, localidades, equipe, acessos, atendimento e identidade da imobiliária em um só lugar.</p></div><a className="button primary" href="#novo-imovel">+ Cadastrar imóvel</a></div>

            <AdminLiveData />

            <div className="adminPanel" id="novo-imovel">
              <div className="adminPanelHeader"><div><span className="eyebrow">CADASTRO REAL</span><h2>Novo imóvel</h2><p>Cadastro completo com corretor, características, privacidade de endereço e fotos.</p></div></div>
              <AdminPropertyForm />
            </div>

            <AdminLocations />
            <AdminCatalogSettings />
            <AdminBrokers />
            <AdminUsers />
            <AdminSiteSettings />
            <AdminAuditLog />
          </section>
        </div>
      </main>
    </AdminGate>
  );
}
