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
      <span className="adminModuleArrow" aria-hidden="true">→</span>
    </a>
  );
}

const adminWorkspaceCss = `
  .adminPage.adminWorkspaceRefresh {
    --workspace-navy: #071725;
    --workspace-navy-2: #0b2237;
    --workspace-gold: #e9b94f;
    --workspace-text: #132238;
    --workspace-muted: #66758a;
    --workspace-line: #e5eaf0;
    --workspace-surface: #ffffff;
    --workspace-bg: #f4f7fb;
    min-height: 100vh;
    background: var(--workspace-bg);
    color: var(--workspace-text);
  }

  .adminPage.adminWorkspaceRefresh .adminTopbar {
    position: sticky;
    top: 0;
    z-index: 80;
    border-bottom: 1px solid rgba(255,255,255,.08);
    background: rgba(7,23,37,.97);
    box-shadow: 0 10px 30px rgba(4,18,34,.08);
    backdrop-filter: blur(16px);
  }

  .adminPage.adminWorkspaceRefresh .adminNav {
    min-height: 72px;
  }

  .adminPage.adminWorkspaceRefresh .adminShell {
    display: grid;
    grid-template-columns: 228px minmax(0,1fr);
    gap: 28px;
    align-items: start;
    padding-top: 28px;
    padding-bottom: 70px;
  }

  .adminPage.adminWorkspaceRefresh .adminSidebar.adminSidebarCompact {
    position: sticky;
    top: 98px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 18px 14px;
    border: 0;
    border-radius: 20px;
    background: linear-gradient(180deg, #071725 0%, #0b2237 100%);
    box-shadow: 0 18px 42px rgba(7,23,37,.16);
  }

  .adminPage.adminWorkspaceRefresh .adminSidebar strong {
    padding: 4px 10px 12px;
    color: rgba(255,255,255,.54);
    font-size: 11px;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .adminPage.adminWorkspaceRefresh .adminSidebar a {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 42px;
    padding: 0 11px;
    border: 1px solid transparent;
    border-radius: 11px;
    color: rgba(255,255,255,.76);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    transition: background .16s ease, color .16s ease, border-color .16s ease, transform .16s ease;
  }

  .adminPage.adminWorkspaceRefresh .adminSidebar a:hover,
  .adminPage.adminWorkspaceRefresh .adminSidebar a.active {
    border-color: rgba(233,185,79,.18);
    background: rgba(233,185,79,.11);
    color: #fff;
    transform: translateX(2px);
  }

  .adminPage.adminWorkspaceRefresh .adminContent {
    min-width: 0;
  }

  .adminPage.adminWorkspaceRefresh .adminHeading {
    gap: 22px;
    margin-bottom: 22px;
    padding: 30px 32px;
    border: 1px solid #dfe6ee;
    border-radius: 22px;
    background:
      radial-gradient(circle at 92% 18%, rgba(233,185,79,.14), transparent 30%),
      linear-gradient(135deg, #ffffff 0%, #f9fbfd 100%);
    box-shadow: 0 14px 34px rgba(27,44,64,.07);
  }

  .adminPage.adminWorkspaceRefresh .adminHeading h1 {
    margin: 5px 0 8px;
    color: var(--workspace-navy);
    font-size: clamp(28px, 3vw, 40px);
    line-height: 1.03;
    letter-spacing: -.035em;
  }

  .adminPage.adminWorkspaceRefresh .adminHeading p {
    max-width: 720px;
    margin: 0;
    color: var(--workspace-muted);
    line-height: 1.55;
  }

  .adminPage.adminWorkspaceRefresh .adminQuickActions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin: -4px 0 24px;
  }

  .adminPage.adminWorkspaceRefresh .adminQuickActions a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid #dce3eb;
    border-radius: 11px;
    background: #fff;
    color: #203249;
    font-size: 13px;
    font-weight: 800;
    text-decoration: none;
    box-shadow: 0 5px 15px rgba(27,44,64,.04);
  }

  .adminPage.adminWorkspaceRefresh .adminQuickActions a:first-child {
    border-color: #e2b247;
    background: #efc45f;
    color: #071725;
  }

  .adminPage.adminWorkspaceRefresh .adminMetrics {
    gap: 14px;
    margin-bottom: 24px;
  }

  .adminPage.adminWorkspaceRefresh .adminMetrics article {
    min-width: 0;
    border: 1px solid #e1e7ee;
    border-radius: 17px;
    background: #fff;
    box-shadow: 0 8px 24px rgba(27,44,64,.055);
  }

  .adminPage.adminWorkspaceRefresh .adminModulesSection {
    margin: 28px 0 34px;
  }

  .adminPage.adminWorkspaceRefresh .adminModulesHeading {
    align-items: end;
    margin-bottom: 16px;
  }

  .adminPage.adminWorkspaceRefresh .adminModulesHeading h2 {
    margin-bottom: 2px;
    color: var(--workspace-navy);
  }

  .adminPage.adminWorkspaceRefresh .adminAccessGroups {
    display: grid;
    gap: 18px;
  }

  .adminPage.adminWorkspaceRefresh .adminAccessGroup {
    scroll-margin-top: 96px;
    padding: 22px;
    border: 1px solid #e1e7ee;
    border-radius: 20px;
    background: rgba(255,255,255,.92);
    box-shadow: 0 10px 28px rgba(27,44,64,.045);
  }

  .adminPage.adminWorkspaceRefresh .adminAccessGroupHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 15px;
  }

  .adminPage.adminWorkspaceRefresh .adminAccessGroupHeader h3 {
    margin: 0 0 4px;
    color: var(--workspace-navy);
    font-size: 17px;
  }

  .adminPage.adminWorkspaceRefresh .adminAccessGroupHeader p {
    margin: 0;
    color: var(--workspace-muted);
    font-size: 13px;
  }

  .adminPage.adminWorkspaceRefresh .adminAccessGroupTag {
    flex: 0 0 auto;
    padding: 6px 9px;
    border-radius: 999px;
    background: #f4f7fa;
    color: #758398;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .adminPage.adminWorkspaceRefresh .adminModuleGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 10px;
  }

  .adminPage.adminWorkspaceRefresh .adminModuleCard {
    position: relative;
    display: grid;
    grid-template-columns: 42px minmax(0,1fr) 22px;
    align-items: center;
    gap: 12px;
    min-width: 0;
    min-height: 84px;
    padding: 13px 13px;
    border: 1px solid #e4e9ef;
    border-radius: 15px;
    background: #fff;
    color: var(--workspace-text);
    text-decoration: none;
    box-shadow: none;
    transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
  }

  .adminPage.adminWorkspaceRefresh .adminModuleCard:hover {
    transform: translateY(-2px);
    border-color: rgba(203,151,41,.42);
    box-shadow: 0 12px 24px rgba(27,44,64,.08);
  }

  .adminPage.adminWorkspaceRefresh .adminModuleIcon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: #f5f7fa;
    color: #956c12;
    font-size: 18px;
    font-weight: 900;
  }

  .adminPage.adminWorkspaceRefresh .adminModuleCopy {
    min-width: 0;
  }

  .adminPage.adminWorkspaceRefresh .adminModuleCopy strong {
    display: block;
    overflow: hidden;
    color: #18283d;
    font-size: 13px;
    line-height: 1.25;
    text-overflow: ellipsis;
  }

  .adminPage.adminWorkspaceRefresh .adminModuleCopy small {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    color: #7a8798;
    font-size: 11px;
    line-height: 1.25;
    text-overflow: ellipsis;
  }

  .adminPage.adminWorkspaceRefresh .adminModuleArrow {
    color: #9aa5b4;
    font-size: 15px;
    transition: transform .16s ease, color .16s ease;
  }

  .adminPage.adminWorkspaceRefresh .adminModuleCard:hover .adminModuleArrow {
    transform: translateX(2px);
    color: #956c12;
  }

  .adminPage.adminWorkspaceRefresh .adminPanel {
    scroll-margin-top: 96px;
    border: 1px solid #e1e7ee;
    border-radius: 19px;
    background: #fff;
    box-shadow: 0 8px 24px rgba(27,44,64,.045);
  }

  .adminPage.adminWorkspaceRefresh .adminPanel + .adminPanel {
    margin-top: 18px;
  }

  .adminPage.adminWorkspaceRefresh .adminPanelHeader h2 {
    color: var(--workspace-navy);
  }

  .adminPage.adminWorkspaceRefresh .adminTableWrap {
    border-color: #e5eaf0;
    border-radius: 14px;
  }

  @media (max-width: 1180px) {
    .adminPage.adminWorkspaceRefresh .adminModuleGrid {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }
  }

  @media (max-width: 980px) {
    .adminPage.adminWorkspaceRefresh .adminShell {
      grid-template-columns: 1fr;
      gap: 16px;
      padding-top: 18px;
    }
    .adminPage.adminWorkspaceRefresh .adminSidebar.adminSidebarCompact {
      position: sticky;
      top: 76px;
      z-index: 45;
      flex-direction: row;
      gap: 5px;
      padding: 9px;
      overflow-x: auto;
      border-radius: 14px;
      scrollbar-width: none;
    }
    .adminPage.adminWorkspaceRefresh .adminSidebar::-webkit-scrollbar { display: none; }
    .adminPage.adminWorkspaceRefresh .adminSidebar strong { display: none; }
    .adminPage.adminWorkspaceRefresh .adminSidebar a {
      flex: 0 0 auto;
      min-height: 38px;
      white-space: nowrap;
    }
    .adminPage.adminWorkspaceRefresh .adminSidebar a:hover,
    .adminPage.adminWorkspaceRefresh .adminSidebar a.active { transform: none; }
  }

  @media (max-width: 700px) {
    .adminPage.adminWorkspaceRefresh .adminHeading {
      padding: 22px 18px;
      border-radius: 18px;
    }
    .adminPage.adminWorkspaceRefresh .adminHeadingActions {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .adminPage.adminWorkspaceRefresh .adminHeadingActions .button {
      width: 100%;
      justify-content: center;
    }
    .adminPage.adminWorkspaceRefresh .adminQuickActions {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .adminPage.adminWorkspaceRefresh .adminQuickActions a {
      justify-content: center;
      padding: 0 10px;
      font-size: 12px;
    }
    .adminPage.adminWorkspaceRefresh .adminAccessGroup {
      padding: 16px 12px;
      border-radius: 16px;
    }
    .adminPage.adminWorkspaceRefresh .adminAccessGroupHeader {
      align-items: flex-start;
    }
    .adminPage.adminWorkspaceRefresh .adminAccessGroupTag { display: none; }
    .adminPage.adminWorkspaceRefresh .adminModuleGrid {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .adminPage.adminWorkspaceRefresh .adminModuleCard {
      grid-template-columns: 36px minmax(0,1fr);
      gap: 9px;
      min-height: 78px;
      padding: 10px;
      border-radius: 13px;
    }
    .adminPage.adminWorkspaceRefresh .adminModuleIcon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      font-size: 16px;
    }
    .adminPage.adminWorkspaceRefresh .adminModuleArrow { display: none; }
    .adminPage.adminWorkspaceRefresh .adminModuleCopy strong {
      white-space: normal;
      font-size: 12px;
    }
    .adminPage.adminWorkspaceRefresh .adminModuleCopy small {
      display: none;
    }
  }

  @media (max-width: 420px) {
    .adminPage.adminWorkspaceRefresh .adminQuickActions { grid-template-columns: 1fr; }
    .adminPage.adminWorkspaceRefresh .adminModuleGrid { grid-template-columns: 1fr; }
    .adminPage.adminWorkspaceRefresh .adminModuleCopy small { display: block; }
  }
`;

export default function AdminPage() {
  return (
    <AdminGate>
      <main className="adminPage adminWorkspaceRefresh">
        <style dangerouslySetInnerHTML={{ __html: adminWorkspaceCss }} />

        <header className="adminTopbar">
          <div className="container adminNav">
            <a className="brand" href="../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" style={{ width: 88, maxWidth: "24vw", height: "auto", display: "block" }} /></a>
            <div className="adminNavActions"><AdminAgencySwitcher /><a className="button primary small" href="../">Ver site</a></div>
          </div>
        </header>

        <div className="container adminShell">
          <aside className="adminSidebar adminSidebarCompact" aria-label="Navegação do painel">
            <strong>Central de gestão</strong>
            <a className="active" href="#visao-geral">Visão geral</a>
            <a href="#imoveis">Imóveis</a>
            <a href="#acessos-comercial">Comercial</a>
            <a href="#acessos-imoveis">Operação</a>
            <a href="#acessos-equipe">Equipe</a>
            <a href="#acessos-configuracoes">Configurações</a>
          </aside>

          <section className="adminContent" id="visao-geral">
            <div className="adminHeading">
              <div><span className="eyebrow">PAINEL DA IMOBILIÁRIA</span><h1>Central de gestão</h1><p>Imóveis, contatos, agenda, equipe e configurações organizados por área. As funções existentes continuam disponíveis nos mesmos módulos.</p></div>
              <div className="adminHeadingActions">
                <a className="button adminDownloadAppButton" href="/baixar-app/" aria-label="Baixar aplicativo LENOY Imobiliárias">Baixar app</a>
                <a className="button primary adminOnly" href="#novo-imovel">+ Cadastrar imóvel</a>
              </div>
            </div>

            <nav className="adminQuickActions" aria-label="Ações rápidas">
              <a href="#novo-imovel">＋ Novo imóvel</a>
              <a href="#contatos">✉ Contatos</a>
              <a href="#agenda-visitas">▦ Agenda</a>
              <a href="#funil-comercial">◎ Funil comercial</a>
              <a href="#corretores">♟ Corretores</a>
              <a href="#configuracoes">✎ Personalizar</a>
            </nav>

            <AdminLiveData />

            <section className="adminModulesSection" aria-label="Áreas do painel">
              <div className="adminModulesHeading"><div><span className="eyebrow">FERRAMENTAS</span><h2>Acesse por área</h2></div><small>Menos procura, mais ação.</small></div>

              <div className="adminAccessGroups">
                <section className="adminAccessGroup" id="acessos-comercial">
                  <div className="adminAccessGroupHeader"><div><h3>Comercial e relacionamento</h3><p>Contatos, funil, oportunidades, agenda e acompanhamentos.</p></div><span className="adminAccessGroupTag">Comercial</span></div>
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
                  </nav>
                </section>

                <section className="adminAccessGroup" id="acessos-imoveis">
                  <div className="adminAccessGroupHeader"><div><h3>Imóveis e operação</h3><p>Cadastro, qualidade, desempenho e documentação do catálogo.</p></div><span className="adminAccessGroupTag">Operação</span></div>
                  <nav className="adminModuleGrid">
                    <DashboardCard href="#novo-imovel" title="Novo imóvel" subtitle="Cadastro + descrição com IA" icon="＋" />
                    <DashboardCard href="#desempenho-imoveis" title="Desempenho dos imóveis" subtitle="Acessos e resultados" icon="↗" />
                    <DashboardCard href="#qualidade-imoveis" title="Qualidade dos anúncios" subtitle="Completude e melhorias" icon="★" />
                    <DashboardCard href="#documentacao-imovel" title="Checklist documental" subtitle="Documentos aprovados e pendentes" icon="☑" />
                    <DashboardCard href="#catalogo-config" title="Tipos e características" subtitle="Organização do catálogo" icon="▤" />
                    <DashboardCard href="#documentos" title="Central de documentos" subtitle="Documentos da imobiliária" icon="▣" />
                    <DashboardCard href="#arquivos-documentos" title="Documentos enviados" subtitle="Arquivos e consumo do plano" icon="⇧" />
                    <DashboardCard href="#uso-documentos" title="Uso de documentos" subtitle="Consumo e disponibilidade" icon="◫" />
                  </nav>
                </section>

                <section className="adminAccessGroup" id="acessos-equipe">
                  <div className="adminAccessGroupHeader"><div><h3>Equipe e acessos</h3><p>Corretores, metas, usuários e permissões.</p></div><span className="adminAccessGroupTag">Equipe</span></div>
                  <nav className="adminModuleGrid">
                    <DashboardCard href="#corretores" title="Corretores" subtitle="Equipe de corretores" icon="♟" />
                    <DashboardCard href="#desempenho-corretores" title="Desempenho dos corretores" subtitle="Resultados da equipe" icon="↗" />
                    <DashboardCard href="#metas-corretores" title="Metas dos corretores" subtitle="Objetivos da equipe" icon="◎" />
                    <DashboardCard href="#usuarios" title="Usuários e permissões" subtitle="Acessos da equipe" icon="♙" />
                    <DashboardCard href="#convites" title="Convites de acesso" subtitle="Novos membros" icon="＋" />
                    <DashboardCard href="#emails-profissionais" title="E-mails profissionais" subtitle="Contas do plano" icon="@" />
                  </nav>
                </section>

                <section className="adminAccessGroup" id="acessos-configuracoes">
                  <div className="adminAccessGroupHeader"><div><h3>Conta e personalização</h3><p>Plano, identidade, domínio e segurança dos dados.</p></div><span className="adminAccessGroupTag">Configurações</span></div>
                  <nav className="adminModuleGrid">
                    <DashboardCard href="#meu-plano" title="Meu plano" subtitle="Plano atual, renovação e upgrade" icon="◆" />
                    <DashboardCard href="#configuracoes" title="Personalizar" subtitle="Marca no site e aplicativo" icon="✎" />
                    <DashboardCard href="#dominios" title="Domínios" subtitle="Endereços da imobiliária" icon="⌘" />
                    <DashboardCard href="#exportacoes" title="Exportações e cópia" subtitle="Cópia dos dados" icon="⇩" />
                  </nav>
                </section>
              </div>
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
