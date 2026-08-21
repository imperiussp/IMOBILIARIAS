import AdminAgencySwitcher from "../../components/AdminAgencySwitcher";
import AdminAiDescription from "../../components/AdminAiDescription";
import AdminAuditLog from "../../components/AdminAuditLog";
import AdminBrokers from "../../components/AdminBrokers";
import AdminCatalogSettings from "../../components/AdminCatalogSettings";
import AdminDocuments from "../../components/AdminDocuments";
import AdminDomains from "../../components/AdminDomains";
import AdminExportTools from "../../components/AdminExportTools";
import AdminGate from "../../components/AdminGate";
import AdminInfinitePayCheckout from "../../components/AdminInfinitePayCheckout";
import AdminInvitations from "../../components/AdminInvitations";
import AdminLeadQualificationBoard from "../../components/AdminLeadQualificationBoard";
import AdminLiveData from "../../components/AdminLiveData";
import AdminLocations from "../../components/AdminLocations";
import AdminPlan from "../../components/AdminPlan";
import AdminPropertyForm from "../../components/AdminPropertyForm";
import AdminSiteSettings from "../../components/AdminSiteSettings";
import AdminStorageOverview from "../../components/AdminStorageOverview";
import AdminUsers from "../../components/AdminUsers";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/LENOY.jpg";

export default function AdminPage() {
  return (
    <AdminGate>
      <main className="adminPage">
        <header className="adminTopbar">
          <div className="container adminNav">
            <a className="brand" href="../"><img src={lenoyLogo} alt="LENOY" style={{ width: 88, maxWidth: "24vw", height: "auto", display: "block", borderRadius: 8 }} /></a>
            <div className="adminNavActions"><AdminAgencySwitcher /><a className="button primary small" href="../">Ver site</a></div>
          </div>
        </header>

        <div className="container adminShell">
          <aside className="adminSidebar">
            <strong>Gestão</strong>
            <a className="active" href="#visao-geral">Visão geral</a>
            <a href="#imoveis">Imóveis</a>
            <a className="adminOnly" href="#novo-imovel">Novo imóvel</a>
            <a className="adminOnly" href="#descricao-ia">Descrição com IA</a>
            <a className="adminOnly" href="#localidades">Localidades</a>
            <a className="adminOnly" href="#catalogo-config">Tipos e recursos</a>
            <a className="adminOnly" href="#corretores">Corretores</a>
            <a className="adminOnly" href="#usuarios">Usuários</a>
            <a className="adminOnly" href="#convites">Convites</a>
            <a className="adminOnly" href="#documentos">Documentos</a>
            <a className="adminOnly" href="#arquivos">Arquivos</a>
            <a className="adminOnly" href="#meu-plano">Meu plano</a>
            <a className="adminOnly" href="#pagamento-infinitepay">Pagamento</a>
            <a className="adminOnly" href="#configuracoes">Imobiliária</a>
            <a className="adminOnly" href="#dominios">Domínios</a>
            <a href="#contatos">Contatos</a>
            <a href="#qualificacao-contatos">Classificação</a>
            <a className="adminOnly" href="#historico">Histórico</a>
            <a className="adminOnly" href="#exportacoes">Exportações</a>
          </aside>

          <section className="adminContent" id="visao-geral">
            <div className="adminHeading"><div><span className="eyebrow">PAINEL</span><h1>Visão geral</h1><p>Imóveis, equipe, contatos, documentos, arquivos e configurações pertencem sempre à imobiliária ativa.</p></div><a className="button primary adminOnly" href="#novo-imovel">+ Cadastrar imóvel</a></div>

            <AdminLiveData />
            <AdminLeadQualificationBoard />

            <div className="adminPanel adminOnly" id="novo-imovel">
              <div className="adminPanelHeader"><div><span className="eyebrow">CADASTRO REAL</span><h2>Novo imóvel</h2><p>Cadastro completo com corretor, características, privacidade de endereço e fotos.</p></div></div>
              <AdminPropertyForm />
            </div>

            <div className="adminOnly"><AdminAiDescription /></div>
            <div className="adminOnly"><AdminLocations /></div>
            <div className="adminOnly"><AdminCatalogSettings /></div>
            <div className="adminOnly"><AdminBrokers /></div>
            <div className="adminOnly"><AdminUsers /></div>
            <div className="adminOnly"><AdminInvitations /></div>
            <div className="adminOnly"><AdminDocuments /></div>
            <AdminStorageOverview />
            <div className="adminOnly"><AdminPlan /></div>
            <div className="adminOnly"><AdminInfinitePayCheckout /></div>
            <div className="adminOnly"><AdminSiteSettings /></div>
            <div className="adminOnly"><AdminDomains /></div>
            <div className="adminOnly"><AdminAuditLog /></div>
            <div className="adminOnly"><AdminExportTools /></div>
          </section>
        </div>
      </main>
    </AdminGate>
  );
}
