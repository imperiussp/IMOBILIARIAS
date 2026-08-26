import AdminGate from "../../components/AdminGate";
import MobileWebAppV2 from "../../components/MobileWebAppV2";

export default function MobileAppPage() {
  return (
    <AdminGate appMode>
      <MobileWebAppV2 />
    </AdminGate>
  );
}
