import type { ReactNode } from "react";
import MedianOneSignalSync from "../../components/MedianOneSignalSync";

export default function MobileAppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MedianOneSignalSync />
      {children}
    </>
  );
}
