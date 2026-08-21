import PlatformAdminDashboard from "../../components/PlatformAdminDashboard";
import PlatformAdminGate from "../../components/PlatformAdminGate";
import PlatformPlanManager from "../../components/PlatformPlanManager";

export default function PlatformAdminPage() {
  return (
    <PlatformAdminGate>
      <main className="adminPage platformAdminPage">
        <header className="adminTopbar">
          <div className="container adminNav">
            <a className="brand" href="../"><span className="brandMark">L</span><span>LENOY IMÓVEIS</span></a>
            <div className="adminNavActions"><span>Administração global</span><a className="button secondary small" href="../admin/">Painel de imobiliária</a><a className="button primary small" href="../">Ver plataforma</a></div>
          </div>
        </header>

        <div className="container platformAdminShell">
          <section className="adminContent">
            <div className="adminHeading"><div><span className="eyebrow">ADMINISTRAÇÃO DA PLATAFORMA</span><h1>Visão global do SaaS</h1><p>Imobiliárias, assinaturas, domínios, usuários, volume de imóveis e configuração comercial em um único painel da LENOY.</p></div></div>
            <PlatformAdminDashboard />
            <PlatformPlanManager />
          </section>
        </div>
      </main>
    </PlatformAdminGate>
  );
}
