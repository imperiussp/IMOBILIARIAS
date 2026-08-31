import type { ReactNode } from "react";

const clientGridCss = `
@media (min-width: 1101px) {
  .platformCommercialPage .commercialClientGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .platformCommercialPage .commercialClientCard.isEditing {
    grid-column: 1 / -1 !important;
  }
}

@media (max-width: 1100px) {
  .platformCommercialPage .commercialClientGrid {
    grid-template-columns: 1fr !important;
  }

  .platformCommercialPage .commercialClientCard.isEditing {
    grid-column: auto !important;
  }
}
`;

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style dangerouslySetInnerHTML={{ __html: clientGridCss }} />
    </>
  );
}
