import PlatformAdminGate from "../../../components/PlatformAdminGate";
import PlatformCouponManager from "../../../components/PlatformCouponManager";

export default function PlatformCouponsPage(){
  return <PlatformAdminGate><main style={{minHeight:"100vh",background:"#f4f6f8"}}><PlatformCouponManager/></main></PlatformAdminGate>;
}
