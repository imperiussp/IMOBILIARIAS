import PlatformAdminGate from "../../components/PlatformAdminGate";
import PlatformBillingOverview from "../../components/PlatformBillingOverview";
import PlatformCommercialDashboard from "../../components/PlatformCommercialDashboard";
import PlatformPlanManager from "../../components/PlatformPlanManager";
import PlatformSubscriptionManager from "../../components/PlatformSubscriptionManager";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

export default function PlatformAdminPage() {
  return (
    <PlatformAdminGate>
      <main className="adminPage platformAdminPage platformCommercialPage">
        <header className="adminTopbar">
          <div className="container adminNav">
            <a className="brand" href="../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" style={{ width: 88, maxWidth: "24vw", height: "auto", display: "block" }} /></a>
            <div className="adminNavActions"><span>Administração comercial</span><a className="button secondary small" href="./tecnico/">Área técnica</a><a className="button secondary small" href="../admin/">Painel de imobiliária</a><a className="button primary small" href="../">Ver plataforma</a></div>
          </div>
        </header>

        <div className="container platformAdminShell platformCommercialShell">
          <section className="adminContent">
            <div className="adminHeading commercialHeading"><div><span className="eyebrow">ADMINISTRAÇÃO COMERCIAL</span><h1>Clientes, planos e pagamentos</h1><p>Aqui ficam somente as informações para administrar vendas: quem se cadastrou, quem pagou, qual plano possui, descontos, vencimentos, inadimplência e histórico financeiro.</p></div></div>
            <PlatformCommercialDashboard />
            <PlatformSubscriptionManager />
            <PlatformPlanManager />
            <PlatformBillingOverview />
          </section>
        </div>
      </main>
    </PlatformAdminGate>
  );
}
