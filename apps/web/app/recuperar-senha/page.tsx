import PasswordRecoveryForm from "../../components/PasswordRecoveryForm";

const lenoyLogo = "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";

export default function PasswordRecoveryPage() {
  return <main className="loginPage"><div className="loginShell"><a className="brand loginBrand accessBrandV4" href="../"><img src={lenoyLogo} alt="LENOY IMOBILIÁRIAS" /><span><strong>LENOY IMOBILIÁRIAS</strong><small>Plataforma para imobiliárias</small></span></a><PasswordRecoveryForm /></div></main>;
}
