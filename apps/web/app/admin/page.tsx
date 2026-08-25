import AdminAgencySwitcher from "../../components/AdminAgencySwitcher";
import AdminAiDescription from "../../components/AdminAiDescription";
import AdminAuditLog from "../../components/AdminAuditLog";
import AdminBrokerGoals from "../../components/AdminBrokerGoals";
import AdminBrokerPerformance from "../../components/AdminBrokerPerformance";
import AdminBrokers from "../../components/AdminBrokers";
import AdminBuyerConsent from "../../components/AdminBuyerConsent";
import AdminBuyerDeliveryMonitor from "../../components/AdminBuyerDeliveryMonitor";
import AdminBuyerOutreach from "../../components/AdminBuyerOutreach";
import AdminBuyerOutreachResponses from "../../components/AdminBuyerOutreachResponses";
import AdminBuyerPreferences from "../../components/AdminBuyerPreferences";
import AdminCatalogSettings from "../../components/AdminCatalogSettings";
import AdminCommercialFunnel from "../../components/AdminCommercialFunnel";
import AdminDocuments from "../../components/AdminDocuments";
import AdminDocumentUploads from "../../components/AdminDocumentUploads";
import AdminDocumentUsage from "../../components/AdminDocumentUsage";
import AdminDomains from "../../components/AdminDomains";
import AdminExportTools from "../../components/AdminExportTools";
import AdminFollowups from "../../components/AdminFollowups";
import AdminGate from "../../components/AdminGate";
import AdminInfinitePayCheckout from "../../components/AdminInfinitePayCheckout";
import AdminInvitations from "../../components/AdminInvitations";
import AdminLeadQualificationBoard from "../../components/AdminLeadQualificationBoard";
import AdminLeadResponseMetrics from "../../components/AdminLeadResponseMetrics";
import AdminLeadTimeline from "../../components/AdminLeadTimeline";
import AdminLiveData from "../../components/AdminLiveData";
import AdminLocations from "../../components/AdminLocations";
import AdminOperationalAlerts from "../../components/AdminOperationalAlerts";
import AdminPlan from "../../components/AdminPlan";
import AdminProfessionalEmails from "../../components/AdminProfessionalEmails";
import AdminPropertyDocumentChecklist from "../../components/AdminPropertyDocumentChecklist";
import AdminPropertyForm from "../../components/AdminPropertyForm";
import AdminPropertyLifecycle from "../../components/AdminPropertyLifecycle";
import AdminPropertyPerformance from "../../components/AdminPropertyPerformance";
import AdminPropertyPriceHistory from "../../components/AdminPropertyPriceHistory";
import AdminPropertyQuality from "../../components/AdminPropertyQuality";
import AdminSiteSettings from "../../components/AdminSiteSettings";
import AdminStorageOverview from "../../components/AdminStorageOverview";
import AdminUsers from "../../components/AdminUsers";
import AdminVisitSchedule from "../../components/AdminVisitSchedule";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

export default function AdminPage() {
  return (
    <AdminGate>
      <main className="adminPage">
        <header className="adminTopbar">
          <div className="container adminNav">
            <a className="brand" href="../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" style={{ width: 88, maxWidth: "24vw", height: "auto", display: "block" }} /></a>
            <div className="adminNavActions"><AdminAgencySwitcher /><a className="button primary small" href="../">Ver site</a></div>
          </div>
        </header>

        <div className="container adminShell">
          <aside className="adminSidebar">
            <strong>Gestão</strong>
            <a className="active" href="#visao-geral">Visão geral</a>
            <a href="#alertas-operacionais">Alertas operacionais</a>
            <a href="#funil-comercial">Funil comercial</a>
            <a href="#tempo-resposta">Tempo de resposta</a>
            <a href="#agenda-visitas">Agenda de visitas</a>
            <a href="#perfil-compra">Perfil de compra</a>
            <a href="#consentimento-compradores">Consentimentos</a>
            <a className="adminOnly" href="#oportunidades-ia">Oportunidades IA</a>
            <a className="adminOnly" href="#entregas-oportunidades">Entregas IA</a>
            <a href="#respostas-oportunidades">Respostas IA</a>
            <a href="#imoveis">Imóveis</a>
            <a className="adminOnly" href="#desempenho-imoveis">Desempenho dos imóveis</a>
            <a className="adminOnly" href="#ciclo-imoveis">Ciclo dos imóveis</a>
            <a className="adminOnly" href="#historico-precos">Histórico de preços</a>
            <a className="adminOnly" href="#documentacao-imovel">Documentação dos imóveis</a>
            <a className="adminOnly" href="#qualidade-imoveis">Qualidade dos anúncios</a>
            <a className="adminOnly" href="#novo-imovel">Novo imóvel</a>
            <a className="adminOnly" href="#descricao-ia">Descrição com IA</a>
            <a className="adminOnly" href="#localidades">Localidades</a>
            <a className="adminOnly" href="#catalogo-config">Tipos e recursos</a>
            <a className="adminOnly" href="#corretores">Corretores</a>
            <a className="adminOnly" href="#desempenho-corretores">Desempenho dos corretores</a>
            <a className="adminOnly" href="#metas-corretores">Metas dos corretores</a>
            <a className="adminOnly" href="#usuarios">Usuários</a>
            <a className="adminOnly" href="#convites">Convites</a>
            <a href="#contatos">Contatos</a>
            <a href="#qualificacao-contatos">Classificação</a>
            <a href="#acompanhamentos">Acompanhamentos</a>
            <a href="#historico-contato">Histórico do contato</a>
            <a className="adminOnly" href="#documentos">Documentos</a>
            <a className="adminOnly" href="#arquivos-documentos">Anexos</a>
            <a className="adminOnly" href="#arquivos">Arquivos</a>
            <a className="adminOnly" href="#meu-plano">Meu plano</a>
            <a className="adminOnly" href="#emails-profissionais">E-mails profissionais</a>
            <a className="adminOnly" href="#pagamento-infinitepay">Pagamento</a>
            <a className="adminOnly" href="#configuracoes">Identidade e aparência</a>
            <a className="adminOnly" href="#dominios">Domínios</a>
            <a className="adminOnly" href="#historico">Histórico</a>
            <a className="adminOnly" href="#exportacoes">Exportações</a>
          </aside>

          <section className="adminContent" id="visao-geral">
            <div className="adminHeading">
              <div><span className="eyebrow">PAINEL</span><h1>Visão geral</h1><p>Imóveis, equipe, contatos, documentos, arquivos e configurações pertencem sempre à imobiliária ativa.</p></div>
              <div className="adminHeadingActions">
                <a className="button adminDownloadAppButton" href="/baixar-app/" aria-label="Baixar aplicativo LENOY Imobiliárias">
                  <span className="adminDownloadPlatforms" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.2 7.1 5.7 4.5a.6.6 0 0 1 1-.6l1.6 2.7a9.8 9.8 0 0 1 7.4 0l1.6-2.7a.6.6 0 1 1 1 .6l-1.5 2.6A6.4 6.4 0 0 1 20 12H4a6.4 6.4 0 0 1 3.2-4.9ZM4 13h16v6.2A1.8 1.8 0 0 1 18.2 21H5.8A1.8 1.8 0 0 1 4 19.2V13Z" /></svg>
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.7 12.9c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.6-2c-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8a4.9 4.9 0 0 0-4.1 2.5c-1.8 3-.5 7.5 1.2 10 .9 1.2 1.9 2.5 3.2 2.4 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.2 3.1-2.4 1-1.4 1.4-2.9 1.4-3-.1 0-3-.9-3-3.9ZM14.2 5.6A4.3 4.3 0 0 0 15.3 2a4.5 4.5 0 0 0-3 1.5 4.1 4.1 0 0 0-1.1 3.5 3.7 3.7 0 0 0 3-1.4Z" /></svg>
                  </span>
                  Baixar app
                </a>
                <a className="button primary adminOnly" href="#novo-imovel">+ Cadastrar imóvel</a>
              </div>
            </div>

            <nav className="adminQuickActions" aria-label="Atalhos do painel">
              <a href="#imoveis"><span>▦</span><div><strong>Imóveis</strong><small>Catálogo e desempenho</small></div></a>
              <a href="#funil-comercial"><span>◎</span><div><strong>CRM</strong><small>Funil e contatos</small></div></a>
              <a href="#agenda-visitas"><span>◷</span><div><strong>Visitas</strong><small>Agenda comercial</small></div></a>
              <a className="adminOnly" href="#oportunidades-ia"><span>✦</span><div><strong>Oportunidades IA</strong><small>Matches e retornos</small></div></a>
              <a className="adminOnly" href="#novo-imovel"><span>＋</span><div><strong>Novo imóvel</strong><small>Cadastrar agora</small></div></a>
              <a href="/baixar-app/"><span>⇩</span><div><strong>Baixar app</strong><small>Android e iPhone</small></div></a>
            </nav>

            <AdminLiveData />
            <AdminOperationalAlerts />
            <AdminCommercialFunnel />
            <AdminLeadResponseMetrics />
            <AdminLeadQualificationBoard />
            <AdminBuyerPreferences />
            <AdminBuyerConsent />
            <AdminBuyerOutreach />
            <AdminBuyerDeliveryMonitor />
            <AdminBuyerOutreachResponses />
            <AdminFollowups />
            <AdminVisitSchedule />
            <AdminLeadTimeline />
            <AdminPropertyPerformance />
            <AdminPropertyLifecycle />
            <div className="adminOnly"><AdminPropertyPriceHistory /></div>
            <div className="adminOnly"><AdminPropertyDocumentChecklist /></div>
            <AdminPropertyQuality />
            <AdminBrokerPerformance />
            <div className="adminOnly"><AdminBrokerGoals /></div>

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
            <div className="adminOnly"><AdminDocumentUsage /></div>
            <div className="adminOnly"><AdminDocumentUploads /></div>
            <AdminStorageOverview />
            <div className="adminOnly"><AdminPlan /></div>
            <div className="adminOnly"><AdminProfessionalEmails /></div>
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
