import type { ReactNode } from "react";
import PlatformClientVisualFix from "../../components/PlatformClientVisualFix";
import PlatformClientDeleteControl from "../../components/PlatformClientDeleteControl";
import PlatformClientAdminActions from "../../components/PlatformClientAdminActions";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PlatformClientVisualFix />
      <PlatformClientDeleteControl />
      <PlatformClientAdminActions />
    </>
  );
}
