import AdminAuditLog from "../../components/AdminAuditLog";
import AdminBrokers from "../../components/AdminBrokers";
import AdminCatalogSettings from "../../components/AdminCatalogSettings";
import AdminDomains from "../../components/AdminDomains";
import AdminGate from "../../components/AdminGate";
import AdminInvitations from "../../components/AdminInvitations";
import AdminLiveData from "../../components/AdminLiveData";
import AdminLocations from "../../components/AdminLocations";
import AdminPlan from "../../components/AdminPlan";
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
            <div className="adminNavActions"><span>Painel de gestão</span><a className="button primary small" href="../">Ver site</a></div>
          </div>
        </header>

        <div className="container adminShell">
          <aside className="adminSidebar">
            <strong>Gestão</strong>
            <a className="active" href="#visao-geral">Visão geral</a>
            <a href="#imoveis">Imóveis</a>
            <a className="adminOnly" href="#novo-imovel">Novo imóvel</a>
            <a className="adminOnly" href="#localidades">Localidades</a>
            <a className="adminOnly" href="#catalogo-config">Tipos e recursos</a>
            <a className="adminOnly" href="#corretores">Corretores</a>
            <a className="adminOnly" href="#usuarios">Usuários</a>
            <a className="adminOnly" href="#convites">Convites</a>
            <a className="adminOnly" href="#meu-plano">Meu plano</a>
            <a className="adminOnly" href="#configuracoes">Imobiliária</a>
            <a className="adminOnly" href="#dominios">Domínios</a>
            <a href="#contatos">Contatos</a>
            <a className="adminOnly" href="#historico">Histórico</a>
            <a className="adminOnly" href="#exportacoes">Exportações</a>
          </aside>

          <section className="adminContent" id="visao-geral">
            <div className="adminHeading"><div><span className="eyebrow">PAINEL</span><h1>Visão geral</h1><p>Imóveis e contatos aparecem conforme as permissões da sua conta.</p></div><a className="button primary adminOnly" href="#novo-imovel">+ Cadastrar imóvel</a></div>

            <AdminLiveData />

            <div className="adminPanel adminOnly" id="novo-imovel">
              <div className="adminPanelHeader"><div><span className="eyebrow">CADASTRO REAL</span><h2>Novo imóvel</h2><p>Cadastro completo com corretor, características, privacidade de endereço e fotos.</p></div></div>
              <AdminPropertyForm />
            </div>

            <div className="adminOnly"><AdminLocations /></div>
            <div className="adminOnly"><AdminCatalogSettings /></div>
            <div className="adminOnly"><AdminBrokers /></div>
            <div className="adminOnly"><AdminUsers /></div>
            <div className="adminOnly"><AdminInvitations /></div>
            <div className="adminOnly"><AdminPlan /></div>
            <div className="adminOnly"><AdminSiteSettings /></div>
            <div className="adminOnly"><AdminDomains /></div>
            <div className="adminOnly"><AdminAuditLog /></div>
          </section>
        </div>
      </main>
    </AdminGate>
  );
}
