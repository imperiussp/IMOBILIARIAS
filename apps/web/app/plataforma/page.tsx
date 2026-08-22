import PlatformAdminDashboard from "../../components/PlatformAdminDashboard";
import PlatformAdminGate from "../../components/PlatformAdminGate";
import PlatformBillingOverview from "../../components/PlatformBillingOverview";
import PlatformDocumentTemplateManager from "../../components/PlatformDocumentTemplateManager";
import PlatformHomologationReadiness from "../../components/PlatformHomologationReadiness";
import PlatformOperationsDashboard from "../../components/PlatformOperationsDashboard";
import PlatformPlanManager from "../../components/PlatformPlanManager";
import PlatformReleaseControls from "../../components/PlatformReleaseControls";
import PlatformSubscriptionManager from "../../components/PlatformSubscriptionManager";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

export default function PlatformAdminPage() {
  return (
    <PlatformAdminGate>
      <main className="adminPage platformAdminPage">
        <header className="adminTopbar">
          <div className="container adminNav">
            <a className="brand" href="../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" style={{ width: 88, maxWidth: "24vw", height: "auto", display: "block" }} /></a>
            <div className="adminNavActions"><span>Administração global</span><a className="button secondary small" href="../admin/">Painel de imobiliária</a><a className="button primary small" href="../">Ver plataforma</a></div>
          </div>
        </header>

        <div className="container platformAdminShell">
          <section className="adminContent">
            <div className="adminHeading"><div><span className="eyebrow">ADMINISTRAÇÃO DA PLATAFORMA</span><h1>Visão global do SaaS</h1><p>Imobiliárias, assinaturas, cobrança, domínios, usuários, documentos, volume de imóveis e configuração comercial em um único painel da LENOY IMOBILIÁRIAS.</p></div></div>
            <PlatformReleaseControls />
            <PlatformHomologationReadiness />
            <PlatformAdminDashboard />
            <PlatformOperationsDashboard />
            <PlatformSubscriptionManager />
            <PlatformPlanManager />
            <PlatformDocumentTemplateManager />
            <PlatformBillingOverview />
          </section>
        </div>
      </main>
    </PlatformAdminGate>
  );
}
