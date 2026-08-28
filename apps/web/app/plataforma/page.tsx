import PlatformAdminGate from "../../components/PlatformAdminGate";
import PlatformBillingOverview from "../../components/PlatformBillingOverview";
import PlatformCommercialDashboard from "../../components/PlatformCommercialDashboard";
import PlatformCommercialMenu from "../../components/PlatformCommercialMenu";
import PlatformPlanManager from "../../components/PlatformPlanManager";
import PlatformSubscriptionManager from "../../components/PlatformSubscriptionManager";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

export default function PlatformAdminPage() {
  return (
    <PlatformAdminGate>
      <main className="adminPage platformAdminPage platformCommercialPage">
        <header className="adminTopbar commercialTopbar">
          <div className="container adminNav commercialAdminNav">
            <a className="brand" href="../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" style={{ width: 82, maxWidth: "22vw", height: "auto", display: "block" }} /></a>
            <div className="commercialHeaderTitle"><strong>Administração LENOY</strong><span>Clientes e pagamentos</span></div>
            <PlatformCommercialMenu />
          </div>
        </header>

        <div className="container platformAdminShell platformCommercialShell">
          <section className="adminContent commercialAdminContent">
            <PlatformCommercialDashboard />
            <section className="commercialToolsGrid" aria-label="Ferramentas comerciais">
              <PlatformSubscriptionManager />
              <PlatformPlanManager />
              <PlatformBillingOverview />
            </section>
          </section>
        </div>
      </main>
    </PlatformAdminGate>
  );
}
