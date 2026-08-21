import LoginForm from "../../components/LoginForm";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <div className="loginShell">
        <a className="brand loginBrand" href="../"><span className="brandMark">I</span><span>IMOBILIARIAS</span></a>
        <LoginForm />
      </div>
    </main>
  );
}
