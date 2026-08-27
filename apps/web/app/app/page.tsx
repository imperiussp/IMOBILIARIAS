import AdminGate from "../../components/AdminGate";
import MedianOneSignalSync from "../../components/MedianOneSignalSync";
import MobilePropertyLabelDock from "../../components/MobilePropertyLabelDock";
import MobileWebAppV2 from "../../components/MobileWebAppV2";
import NotificationLeadDetailMount from "../../components/NotificationLeadDetailMount";

export default function MobileAppPage() {
  return (
    <AdminGate appMode>
      <MedianOneSignalSync />
      <MobileWebAppV2 />
      <NotificationLeadDetailMount />
      <MobilePropertyLabelDock />
    </AdminGate>
  );
}
