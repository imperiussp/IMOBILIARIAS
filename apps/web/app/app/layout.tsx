import type { ReactNode } from "react";

export default function MobileAppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        main > header::before {
          content: "";
          display: block;
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          background: url("https://lenoy.com.br/wp-content/uploads/2026/08/hh.png") center / contain no-repeat;
        }
        main > header > div:first-child {
          margin-right: auto;
        }
        @media (max-width: 390px) {
          main > header::before {
            width: 34px;
            height: 34px;
            flex-basis: 34px;
          }
        }
      `}</style>
      {children}
    </>
  );
}
