import type { ReactNode } from "react";
import PlatformClientVisualFix from "../../components/PlatformClientVisualFix";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PlatformClientVisualFix />
    </>
  );
}
