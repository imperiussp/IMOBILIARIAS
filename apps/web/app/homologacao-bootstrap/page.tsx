import HomologationBootstrapForm from "../../components/HomologationBootstrapForm";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

export default function HomologationBootstrapPage() {
  return (
    <main className="loginPage">
      <div className="loginShell">
        <a className="brand loginBrand" href="../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" style={{ width: 118, maxWidth: "34vw", height: "auto", display: "block" }} /></a>
        <HomologationBootstrapForm />
      </div>
    </main>
  );
}
