import RegisterForm from "../../components/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="loginPage">
      <div className="loginShell">
        <a className="brand loginBrand" href="../"><span className="brandMark">I</span><span>IMOBILIARIAS</span></a>
        <RegisterForm />
      </div>
    </main>
  );
}
