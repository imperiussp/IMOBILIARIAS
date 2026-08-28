import PlatformAdminDashboard from "../../../components/PlatformAdminDashboard";
import PlatformAdminGate from "../../../components/PlatformAdminGate";
import PlatformDeploymentCheckpoints from "../../../components/PlatformDeploymentCheckpoints";
import PlatformDeploymentReleases from "../../../components/PlatformDeploymentReleases";
import PlatformDocumentTemplateManager from "../../../components/PlatformDocumentTemplateManager";
import PlatformHomologationReadiness from "../../../components/PlatformHomologationReadiness";
import PlatformOperationsDashboard from "../../../components/PlatformOperationsDashboard";
import PlatformReleaseControls from "../../../components/PlatformReleaseControls";
import PlatformReleaseHistory from "../../../components/PlatformReleaseHistory";
import PlatformReleaseValidations from "../../../components/PlatformReleaseValidations";
import PlatformTechnicalHealth from "../../../components/PlatformTechnicalHealth";
import PlatformTenantSecurityAudit from "../../../components/PlatformTenantSecurityAudit";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

export default function PlatformTechnicalPage() {
  return (
    <PlatformAdminGate>
      <main className="adminPage platformAdminPage platformTechnicalPage">
        <header className="adminTopbar">
          <div className="container adminNav">
            <a className="brand" href="../../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" style={{ width: 88, maxWidth: "24vw", height: "auto", display: "block" }} /></a>
            <div className="adminNavActions"><span>Área técnica</span><a className="button primary small" href="../">Voltar ao comercial</a></div>
          </div>
        </header>

        <div className="container platformAdminShell">
          <section className="adminContent">
            <div className="adminHeading"><div><span className="eyebrow">ADMINISTRAÇÃO TÉCNICA</span><h1>Operação e manutenção da plataforma</h1><p>Diagnósticos, segurança, homologação, releases, deploys e controles técnicos ficam separados do painel comercial.</p></div></div>
            <PlatformReleaseControls />
            <PlatformHomologationReadiness />
            <PlatformTechnicalHealth />
            <PlatformDeploymentCheckpoints />
            <PlatformDeploymentReleases />
            <PlatformTenantSecurityAudit />
            <PlatformReleaseValidations />
            <PlatformReleaseHistory />
            <PlatformAdminDashboard />
            <PlatformOperationsDashboard />
            <PlatformDocumentTemplateManager />
          </section>
        </div>
      </main>
    </PlatformAdminGate>
  );
}
