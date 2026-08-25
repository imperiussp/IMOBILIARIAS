import AdminGate from "../../components/AdminGate";
import MobileWebApp from "../../components/MobileWebApp";

export default function MobileAppPage() {
  return (
    <AdminGate appMode>
      <MobileWebApp />
    </AdminGate>
  );
}
