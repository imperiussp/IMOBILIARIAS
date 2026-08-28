import FreshRegistrationSession from "../../components/FreshRegistrationSession";
import RegistrationEntryGate from "../../components/RegistrationEntryGate";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

export default function RegisterPage() {
  return (
    <main className="loginPage registerPage">
      <FreshRegistrationSession />
      <div className="loginShell registerShell">
        <a className="brand loginBrand accessBrandV4" href="../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" /><span><strong>LENOY IMOBILIÁRIAS</strong><small>Plataforma para imobiliárias</small></span></a>
        <RegistrationEntryGate />
      </div>
    </main>
  );
}
