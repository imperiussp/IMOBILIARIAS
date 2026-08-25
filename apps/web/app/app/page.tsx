import AdminGate from "../../components/AdminGate";
import MobileAgencyBranding from "../../components/MobileAgencyBranding";
import MobileWebApp from "../../components/MobileWebApp";

export default function MobileAppPage() {
  return (
    <AdminGate appMode>
      <MobileAgencyBranding />
      <MobileWebApp />
    </AdminGate>
  );
}
