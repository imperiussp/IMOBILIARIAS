import PlatformAdminGate from "../../components/PlatformAdminGate";
import PlatformBillingOverview from "../../components/PlatformBillingOverview";
import PlatformCommercialDashboard from "../../components/PlatformCommercialDashboard";
import PlatformCommercialMenu from "../../components/PlatformCommercialMenu";
import PlatformPlanManager from "../../components/PlatformPlanManager";
import PlatformSubscriptionManager from "../../components/PlatformSubscriptionManager";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

const platformRedesignCss = `
.platformCommercialPage{
  min-height:100vh!important;
  background:#f4f6f8!important;
  color:#15293d!important;
}
.platformCommercialPage .commercialTopbar{
  position:sticky!important;
  top:0!important;
  z-index:100!important;
  min-height:76px!important;
  background:#0b2946!important;
  border:0!important;
  border-bottom:1px solid rgba(255,255,255,.1)!important;
  box-shadow:0 8px 24px rgba(9,31,52,.12)!important;
}
.platformCommercialPage .commercialAdminNav{
  width:min(1540px,calc(100% - 40px))!important;
  max-width:1540px!important;
  min-height:76px!important;
  margin:0 auto!important;
  padding:8px 0!important;
  display:grid!important;
  grid-template-columns:auto 1fr auto!important;
  align-items:center!important;
  gap:16px!important;
}
.platformCommercialPage .commercialAdminNav .brand{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  width:58px!important;
  min-width:58px!important;
  height:58px!important;
}
.platformCommercialPage .commercialAdminNav .brand img{
  width:58px!important;
  max-width:58px!important;
  max-height:58px!important;
  object-fit:contain!important;
}
.platformCommercialPage .commercialHeaderTitle{
  display:flex!important;
  flex-direction:column!important;
  gap:3px!important;
  color:#fff!important;
}
.platformCommercialPage .commercialHeaderTitle strong{
  font-size:18px!important;
  line-height:1.15!important;
  letter-spacing:-.01em!important;
}
.platformCommercialPage .commercialHeaderTitle span{
  font-size:12px!important;
  color:#b9c9d7!important;
}
.platformCommercialPage .commercialMenuButton{
  min-height:44px!important;
  padding:0 16px!important;
  border-radius:12px!important;
  font-size:13px!important;
}
.platformCommercialPage .commercialMenuPanel{
  top:86px!important;
  right:20px!important;
  width:min(1000px,calc(100vw - 40px))!important;
  padding:18px!important;
  border-radius:18px!important;
  box-shadow:0 28px 70px rgba(7,23,43,.24)!important;
}
.platformCommercialPage .commercialMenuGrid{
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:12px!important;
}
.platformCommercialPage .commercialMenuCard{
  min-height:122px!important;
  padding:16px!important;
  border-radius:14px!important;
}
.platformCommercialPage .commercialMenuIcon{
  width:36px!important;
  height:36px!important;
  border-radius:10px!important;
  font-size:15px!important;
}
.platformCommercialPage .commercialMenuCard strong{
  font-size:14px!important;
}
.platformCommercialPage .commercialMenuCard small{
  font-size:12px!important;
  line-height:1.35!important;
}
.platformCommercialPage .platformCommercialShell{
  box-sizing:border-box!important;
  width:min(1540px,calc(100% - 40px))!important;
  max-width:1540px!important;
  margin:0 auto!important;
  padding:30px 0 56px!important;
}
.platformCommercialPage .commercialAdminContent{
  width:100%!important;
  max-width:none!important;
  margin:0!important;
  padding:0!important;
}
.platformCommercialPage .commercialPageIntro{
  display:flex!important;
  align-items:flex-end!important;
  justify-content:space-between!important;
  gap:24px!important;
  margin:0 0 24px!important;
  padding:4px 2px!important;
}
.platformCommercialPage .commercialPageIntroCopy{
  max-width:760px!important;
}
.platformCommercialPage .commercialPageIntro .eyebrow{
  display:block!important;
  margin-bottom:7px!important;
  color:#a77b25!important;
  font-size:11px!important;
  font-weight:900!important;
  letter-spacing:.12em!important;
}
.platformCommercialPage .commercialPageIntro h1{
  margin:0!important;
  color:#10263d!important;
  font-size:32px!important;
  line-height:1.08!important;
  letter-spacing:-.035em!important;
}
.platformCommercialPage .commercialPageIntro p{
  max-width:700px!important;
  margin:9px 0 0!important;
  color:#637384!important;
  font-size:15px!important;
  line-height:1.5!important;
}
.platformCommercialPage .commercialPageIntroBadge{
  display:inline-flex!important;
  align-items:center!important;
  gap:8px!important;
  min-height:38px!important;
  padding:0 14px!important;
  border:1px solid #d9e1e7!important;
  border-radius:999px!important;
  background:#fff!important;
  color:#43596e!important;
  font-size:12px!important;
  font-weight:800!important;
  white-space:nowrap!important;
  box-shadow:0 5px 16px rgba(16,36,58,.04)!important;
}
.platformCommercialPage .commercialPageIntroBadge:before{
  content:''!important;
  width:8px!important;
  height:8px!important;
  border-radius:999px!important;
  background:#2d9b65!important;
  box-shadow:0 0 0 4px #e6f5ed!important;
}
.platformCommercialPage .commercialSummary{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:14px!important;
  margin:0 0 24px!important;
}
.platformCommercialPage .commercialSummary article,
.platformCommercialPage .commercialPaymentMetrics article{
  position:relative!important;
  box-sizing:border-box!important;
  min-width:0!important;
  min-height:112px!important;
  padding:18px 20px!important;
  overflow:hidden!important;
  border:1px solid #e0e6eb!important;
  border-radius:17px!important;
  background:#fff!important;
  box-shadow:0 8px 24px rgba(16,36,58,.055)!important;
}
.platformCommercialPage .commercialSummary article:before{
  content:''!important;
  position:absolute!important;
  top:0!important;
  left:0!important;
  width:4px!important;
  height:100%!important;
  background:#143c61!important;
  opacity:.9!important;
}
.platformCommercialPage .commercialSummary article.attention,
.platformCommercialPage .commercialPaymentMetrics article.attention{
  border-color:#ead29d!important;
  background:#fffdf8!important;
}
.platformCommercialPage .commercialSummary article.attention:before{background:#d5a33b!important}
.platformCommercialPage .commercialSummary article.danger,
.platformCommercialPage .commercialPaymentMetrics article.danger{
  border-color:#e8b8b2!important;
  background:#fffafa!important;
}
.platformCommercialPage .commercialSummary article.danger:before{background:#c85b50!important}
.platformCommercialPage .commercialSummary span,
.platformCommercialPage .commercialPaymentMetrics span{
  display:block!important;
  color:#6f7f8d!important;
  font-size:11px!important;
  font-weight:900!important;
  letter-spacing:.07em!important;
  text-transform:uppercase!important;
}
.platformCommercialPage .commercialSummary strong,
.platformCommercialPage .commercialPaymentMetrics strong{
  display:block!important;
  margin-top:8px!important;
  color:#10263d!important;
  font-size:29px!important;
  line-height:1!important;
  letter-spacing:-.035em!important;
}
.platformCommercialPage .commercialSummary small,
.platformCommercialPage .commercialPaymentMetrics small{
  display:block!important;
  margin-top:7px!important;
  color:#83909b!important;
  font-size:12px!important;
  line-height:1.3!important;
}
.platformCommercialPage .commercialClientsPanel{
  width:100%!important;
  margin:0 0 24px!important;
  padding:26px!important;
  border:1px solid #e0e6eb!important;
  border-radius:22px!important;
  background:#fff!important;
  box-shadow:0 10px 32px rgba(16,36,58,.06)!important;
}
.platformCommercialPage .commercialClientsPanel .adminPanelHeader{
  display:flex!important;
  align-items:flex-start!important;
  justify-content:space-between!important;
  gap:20px!important;
  margin:0 0 22px!important;
  padding:0 0 20px!important;
  border-bottom:1px solid #edf1f4!important;
}
.platformCommercialPage .commercialClientsPanel .eyebrow{
  color:#a77b25!important;
  font-size:11px!important;
  font-weight:900!important;
  letter-spacing:.12em!important;
}
.platformCommercialPage .commercialClientsPanel .adminPanelHeader h2{
  margin:5px 0 0!important;
  color:#10263d!important;
  font-size:28px!important;
  line-height:1.1!important;
  letter-spacing:-.025em!important;
}
.platformCommercialPage .commercialClientsPanel .adminPanelHeader p{
  max-width:760px!important;
  margin:8px 0 0!important;
  color:#6b7a88!important;
  font-size:14px!important;
  line-height:1.5!important;
}
.platformCommercialPage .commercialClientsPanel .statusPill{
  min-height:34px!important;
  padding:7px 12px!important;
  border-radius:999px!important;
  background:#eef6f1!important;
  color:#2f6e4c!important;
  font-size:12px!important;
  font-weight:850!important;
}
.platformCommercialPage .commercialClientGrid{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:16px!important;
  width:100%!important;
}
.platformCommercialPage .commercialClientCard{
  box-sizing:border-box!important;
  width:100%!important;
  min-width:0!important;
  padding:20px!important;
  border:1px solid #dfe5ea!important;
  border-radius:18px!important;
  background:#fff!important;
  box-shadow:0 5px 18px rgba(14,34,53,.035)!important;
  transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease!important;
}
.platformCommercialPage .commercialClientCard:hover{
  border-color:#cbd6df!important;
  box-shadow:0 10px 26px rgba(14,34,53,.07)!important;
}
.platformCommercialPage .commercialClientCard.isEditing{
  grid-column:auto!important;
  border-color:#d1ad61!important;
  box-shadow:0 14px 34px rgba(14,34,53,.09)!important;
}
.platformCommercialPage .commercialClientHeader{
  display:flex!important;
  align-items:flex-start!important;
  justify-content:space-between!important;
  gap:18px!important;
  padding:0 0 16px!important;
  border-bottom:1px solid #edf1f4!important;
}
.platformCommercialPage .commercialClientHeader>div{
  display:grid!important;
  gap:4px!important;
  min-width:0!important;
}
.platformCommercialPage .commercialClientHeader strong{
  color:#10263d!important;
  font-size:19px!important;
  line-height:1.2!important;
  letter-spacing:-.015em!important;
}
.platformCommercialPage .commercialClientHeader span:not(.commercialStatus){
  color:#5f7181!important;
  font-size:13px!important;
}
.platformCommercialPage .commercialClientHeader small{
  color:#909aa3!important;
  font-size:11px!important;
}
.platformCommercialPage .commercialStatus{
  min-height:30px!important;
  padding:5px 10px!important;
  border-radius:999px!important;
  font-size:11px!important;
  font-weight:850!important;
}
.platformCommercialPage .commercialClientFacts{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:10px!important;
  margin:16px 0!important;
}
.platformCommercialPage .commercialClientFacts>span{
  min-width:0!important;
  min-height:68px!important;
  padding:12px 13px!important;
  border:1px solid #edf1f4!important;
  border-radius:12px!important;
  background:#f8fafb!important;
}
.platformCommercialPage .commercialClientFacts small{
  display:block!important;
  color:#7c8995!important;
  font-size:10px!important;
  font-weight:850!important;
  letter-spacing:.045em!important;
  text-transform:uppercase!important;
}
.platformCommercialPage .commercialClientFacts b{
  display:block!important;
  margin-top:6px!important;
  color:#21384d!important;
  font-size:13px!important;
  line-height:1.3!important;
  overflow-wrap:anywhere!important;
}
.platformCommercialPage .commercialEditClientButton{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  width:190px!important;
  min-height:44px!important;
  margin-left:auto!important;
  padding:0 16px!important;
  border:1px solid #cfd9e1!important;
  border-radius:11px!important;
  background:#f7f9fb!important;
  color:#183149!important;
  font-size:13px!important;
  font-weight:850!important;
  cursor:pointer!important;
}
.platformCommercialPage .commercialEditClientButton:hover,
.platformCommercialPage .commercialClientCard.isEditing .commercialEditClientButton{
  border-color:#102a45!important;
  background:#102a45!important;
  color:#fff!important;
}
.platformCommercialPage .commercialClientEditor{
  margin-top:18px!important;
  padding:22px!important;
  border:1px solid #e4e9ed!important;
  border-radius:15px!important;
  background:#f8fafb!important;
}
.platformCommercialPage .commercialEditorGrid{
  gap:14px!important;
  margin-bottom:14px!important;
}
.platformCommercialPage .commercialClientEditor label,
.platformCommercialPage .planEditorChooser label{
  gap:7px!important;
  color:#506275!important;
  font-size:12px!important;
  font-weight:800!important;
}
.platformCommercialPage .commercialClientEditor input,
.platformCommercialPage .commercialClientEditor select,
.platformCommercialPage .planEditorChooser select{
  min-height:44px!important;
  padding:9px 11px!important;
  border:1px solid #ced8e0!important;
  border-radius:10px!important;
  background:#fff!important;
  color:#152b40!important;
  font-size:13px!important;
}
.platformCommercialPage .commercialDiscountInline{
  gap:14px!important;
  margin:16px 0!important;
  padding:16px!important;
  border-radius:14px!important;
}
.platformCommercialPage .commercialDiscountInline>div strong{
  font-size:14px!important;
}
.platformCommercialPage .commercialDiscountInline>div small{
  font-size:11px!important;
}
.platformCommercialPage .commercialBillingSnapshot{
  margin:15px 0!important;
  padding:16px!important;
  border-radius:14px!important;
}
.platformCommercialPage .commercialBillingSnapshot>strong{
  font-size:13px!important;
}
.platformCommercialPage .commercialBillingSnapshotGrid{
  gap:10px!important;
}
.platformCommercialPage .commercialBillingSnapshotGrid small{
  font-size:9px!important;
}
.platformCommercialPage .commercialBillingSnapshotGrid b{
  margin-top:5px!important;
  font-size:12px!important;
}
.platformCommercialPage .commercialEditorActions .button{
  min-height:44px!important;
  padding:0 18px!important;
  border-radius:10px!important;
  font-size:13px!important;
}
.platformCommercialPage .commercialToolsGrid{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:14px!important;
  width:100%!important;
}
.platformCommercialPage .commercialToolCard{
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  border:1px solid #dfe5ea!important;
  border-radius:18px!important;
  background:#fff!important;
  box-shadow:0 8px 24px rgba(14,34,53,.045)!important;
}
.platformCommercialPage .commercialToolCard[open]{
  grid-column:1/-1!important;
}
.platformCommercialPage .commercialToolSummary{
  min-height:132px!important;
  padding:20px!important;
  gap:7px!important;
}
.platformCommercialPage .commercialToolSummary:after{
  right:18px!important;
  top:18px!important;
  width:30px!important;
  height:30px!important;
  border-radius:9px!important;
}
.platformCommercialPage .commercialToolSummary>span{
  color:#a47a2d!important;
  font-size:10px!important;
}
.platformCommercialPage .commercialToolSummary>strong{
  color:#10263d!important;
  font-size:17px!important;
}
.platformCommercialPage .commercialToolSummary>small{
  max-width:85%!important;
  color:#778795!important;
  font-size:12px!important;
  line-height:1.4!important;
}
.platformCommercialPage .commercialToolBody{
  padding:0 22px 22px!important;
}
.platformCommercialPage .commercialToolBody label{
  font-size:12px!important;
}
.platformCommercialPage .commercialToolBody input,
.platformCommercialPage .commercialToolBody select{
  min-height:42px!important;
  font-size:13px!important;
}
.platformCommercialPage .commercialPaymentMetrics{
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:12px!important;
}
.platformCommercialPage .commercialTable th{
  padding:12px!important;
  font-size:10px!important;
}
.platformCommercialPage .commercialTable td{
  padding:12px!important;
  font-size:12px!important;
}
.platformCommercialPage .commercialTable .tableSub{
  font-size:10px!important;
}
@media(max-width:1100px){
  .platformCommercialPage .commercialSummary{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .platformCommercialPage .commercialClientFacts{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .platformCommercialPage .commercialToolsGrid{grid-template-columns:1fr!important}
  .platformCommercialPage .commercialToolCard[open]{grid-column:auto!important}
  .platformCommercialPage .commercialMenuGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media(max-width:720px){
  .platformCommercialPage .commercialAdminNav,
  .platformCommercialPage .platformCommercialShell{width:calc(100% - 24px)!important}
  .platformCommercialPage .commercialAdminNav{grid-template-columns:auto 1fr auto!important;gap:10px!important}
  .platformCommercialPage .commercialAdminNav .brand{width:46px!important;min-width:46px!important;height:46px!important}
  .platformCommercialPage .commercialAdminNav .brand img{width:46px!important;max-width:46px!important;max-height:46px!important}
  .platformCommercialPage .commercialHeaderTitle strong{font-size:15px!important}
  .platformCommercialPage .commercialHeaderTitle span{font-size:10px!important}
  .platformCommercialPage .commercialMenuButton{width:44px!important;padding:0!important;font-size:0!important}
  .platformCommercialPage .commercialMenuButton .commercialHamburger{margin:0!important}
  .platformCommercialPage .commercialPageIntro{align-items:flex-start!important;flex-direction:column!important;gap:12px!important}
  .platformCommercialPage .commercialPageIntro h1{font-size:27px!important}
  .platformCommercialPage .commercialPageIntro p{font-size:14px!important}
  .platformCommercialPage .commercialSummary{grid-template-columns:1fr!important}
  .platformCommercialPage .commercialClientsPanel{padding:18px!important;border-radius:17px!important}
  .platformCommercialPage .commercialClientsPanel .adminPanelHeader{flex-direction:column!important}
  .platformCommercialPage .commercialClientsPanel .adminPanelHeader h2{font-size:23px!important}
  .platformCommercialPage .commercialClientCard{padding:16px!important}
  .platformCommercialPage .commercialClientHeader{flex-direction:column!important}
  .platformCommercialPage .commercialClientFacts{grid-template-columns:1fr!important}
  .platformCommercialPage .commercialEditClientButton{width:100%!important;margin:0!important}
  .platformCommercialPage .commercialClientEditor{padding:15px!important}
  .platformCommercialPage .commercialEditorGrid.two,
  .platformCommercialPage .commercialEditorGrid.three,
  .platformCommercialPage .commercialDiscountInline,
  .platformCommercialPage .commercialBillingSnapshotGrid,
  .platformCommercialPage .commercialPaymentMetrics{grid-template-columns:1fr!important}
  .platformCommercialPage .commercialMenuPanel{right:12px!important;width:calc(100vw - 24px)!important}
  .platformCommercialPage .commercialMenuGrid{grid-template-columns:1fr!important}
}
`;

export default function PlatformAdminPage() {
  return (
    <PlatformAdminGate>
      <main className="adminPage platformAdminPage platformCommercialPage">
        <style dangerouslySetInnerHTML={{ __html: platformRedesignCss }} />
        <header className="adminTopbar commercialTopbar">
          <div className="container adminNav commercialAdminNav">
            <a className="brand" href="../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" /></a>
            <div className="commercialHeaderTitle"><strong>Administração LENOY</strong><span>Clientes, assinaturas e financeiro</span></div>
            <PlatformCommercialMenu />
          </div>
        </header>

        <div className="container platformAdminShell platformCommercialShell">
          <section className="adminContent commercialAdminContent">
            <section className="commercialPageIntro" aria-label="Visão geral da administração">
              <div className="commercialPageIntroCopy">
                <span className="eyebrow">CENTRAL ADMINISTRATIVA</span>
                <h1>Gestão da plataforma</h1>
                <p>Clientes, acessos, planos e cobranças em uma visão mais clara, com informações maiores e ações fáceis de localizar.</p>
              </div>
              <span className="commercialPageIntroBadge">Sistema operacional</span>
            </section>

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
