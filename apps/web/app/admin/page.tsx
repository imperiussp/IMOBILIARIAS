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

const lenoyLogo = "/lenoy-imobiliarias-logo-20260826.png";

type DashboardCardProps = {
  href: string;
  title: string;
  subtitle?: string;
  icon?: string;
  badge?: string | number | null;
};

function DashboardCard({ href, title, subtitle, icon = "•", badge = null }: DashboardCardProps) {
  return (
    <a className="adminModuleCard" href={href}>
      <span className="adminModuleIcon" aria-hidden="true">{icon}</span>
      <span className="adminModuleCopy"><strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}</span>
      {badge !== null && badge !== undefined && badge !== "" ? <span className="adminModuleBadge">{badge}</span> : null}
    </a>
  );
}

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
          <aside className="adminSidebar adminSidebarCompact">
            <strong>Gestão</strong>
            <a className="active" href="#visao-geral">Visão geral</a>
            <a href="#imoveis">Imóveis</a>
            <a href="#desempenho-imoveis">Desempenho</a>
            <a href="#qualidade-imoveis">Qualidade</a>
            <a href="#uso-documentos">Uso de documentos</a>
          </aside>

          <section className="adminContent" id="visao-geral">
            <div className="adminHeading">
              <div><span className="eyebrow">PAINEL</span><h1>Visão geral</h1><p>Acesse cada área somente quando precisar. Informações internas da plataforma ficam ocultas da imobiliária.</p></div>
              <div className="adminHeadingActions">
                <a className="button adminDownloadAppButton" href="/baixar-app/" aria-label="Baixar aplicativo LENOY Imobiliárias">Baixar app</a>
                <a className="button primary adminOnly" href="#novo-imovel">+ Cadastrar imóvel</a>
              </div>
            </div>

            <AdminLiveData />

            <section className="adminModulesSection" aria-label="Áreas do painel">
              <div className="adminModulesHeading"><div><span className="eyebrow">ACESSOS</span><h2>Ferramentas da imobiliária</h2></div><small>Quatro cards por linha no desktop e dois no celular.</small></div>
              <nav className="adminModuleGrid">
                <DashboardCard href="#contatos" title="Contatos recebidos" subtitle="Leads e mensagens" icon="✉" />
                <DashboardCard href="#alertas-operacionais" title="Alertas operacionais" subtitle="Pendências e avisos" icon="!" />
                <DashboardCard href="#funil-comercial" title="Funil comercial" subtitle="Negociações e etapas" icon="◎" />
                <DashboardCard href="#tempo-resposta" title="Tempo de resposta" subtitle="Velocidade de atendimento" icon="◷" />

                <DashboardCard href="#qualificacao-contatos" title="Classificação de contatos" subtitle="Prioridade e perfil" icon="★" />
                <DashboardCard href="#perfil-compra" title="Perfil de compra" subtitle="Preferências dos compradores" icon="⌂" />
                <DashboardCard href="#consentimento-compradores" title="Permissões e consentimentos" subtitle="Consentimento dos compradores" icon="✓" />
                <DashboardCard href="#oportunidades-ia" title="Oportunidades automáticas" subtitle="Matches para compradores" icon="✦" />

                <DashboardCard href="#entregas-oportunidades" title="Entregas automáticas" subtitle="Envios de oportunidades" icon="↗" />
                <DashboardCard href="#respostas-oportunidades" title="Respostas IA" subtitle="Retornos dos compradores" icon="↩" />
                <DashboardCard href="#agenda-visitas" title="Agenda de visitas" subtitle="Visitas e compromissos" icon="▦" />
                <DashboardCard href="#acompanhamentos" title="Acompanhamentos" subtitle="Follow-ups comerciais" icon="↻" />

                <DashboardCard href="#historico-contato" title="Histórico dos contatos" subtitle="Linha do tempo comercial" icon="≡" />
                <DashboardCard href="#documentacao-imovel" title="Checklist documental" subtitle="Documentos aprovados e pendentes" icon="☑" />
                <DashboardCard href="#desempenho-corretores" title="Desempenho dos corretores" subtitle="Resultados da equipe" icon="↗" />
                <DashboardCard href="#metas-corretores" title="Metas dos corretores" subtitle="Objetivos da equipe" icon="◎" />

                <DashboardCard href="#novo-imovel" title="Novo imóvel" subtitle="Cadastro + descrição com IA" icon="＋" />
                <DashboardCard href="#catalogo-config" title="Tipos" subtitle="Tipos e características" icon="▤" />
                <DashboardCard href="#corretores" title="Corretores" subtitle="Equipe de corretores" icon="♟" />
                <DashboardCard href="#usuarios" title="Usuários e permissões" subtitle="Acessos da equipe" icon="♙" />

                <DashboardCard href="#convites" title="Convites de acesso" subtitle="Novos membros" icon="＋" />
                <DashboardCard href="#documentos" title="Central de documentos" subtitle="Documentos da imobiliária" icon="▣" />
                <DashboardCard href="#arquivos-documentos" title="Documentos enviados" subtitle="Arquivos e consumo do plano" icon="⇧" />
                <DashboardCard href="#meu-plano" title="Meu plano" subtitle="Plano atual, renovação e upgrade" icon="◆" />

                <DashboardCard href="#emails-profissionais" title="E-mails profissionais" subtitle="Contas do plano" icon="@" />
                <DashboardCard href="#configuracoes" title="Personalizar" subtitle="Marca no site e aplicativo" icon="✎" />
                <DashboardCard href="#dominios" title="Domínios" subtitle="Endereços da imobiliária" icon="⌘" />
                <DashboardCard href="#exportacoes" title="Exportações e cópia" subtitle="Cópia dos dados" icon="⇩" />
              </nav>
            </section>

            <AdminPropertyPerformance />
            <AdminPropertyQuality />
            <AdminDocumentUsage />

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
            <AdminPropertyDocumentChecklist />
            <AdminBrokerPerformance />
            <AdminBrokerGoals />

            <div className="adminPanel adminOnly" id="novo-imovel">
              <div className="adminPanelHeader"><div><span className="eyebrow">CADASTRO REAL</span><h2>Novo imóvel</h2><p>Cadastre o imóvel e use a descrição com IA no mesmo fluxo.</p></div></div>
              <AdminPropertyForm />
              <AdminAiDescription />
            </div>

            <AdminCatalogSettings />
            <AdminBrokers />
            <AdminUsers />
            <AdminInvitations />
            <AdminDocuments />
            <AdminDocumentUploads />
            <AdminPlan />
            <AdminProfessionalEmails />
            <AdminSiteSettings />
            <AdminDomains />
            <AdminExportTools />

            <div className="adminInternalHidden" aria-hidden="true">
              <AdminLocations />
              <AdminPropertyLifecycle />
              <AdminPropertyPriceHistory />
              <AdminStorageOverview />
              <AdminInfinitePayCheckout />
              <AdminAuditLog />
            </div>
          </section>
        </div>
      </main>
    </AdminGate>
  );
}
