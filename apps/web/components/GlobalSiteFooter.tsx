"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const CONTACT_EMAIL = "contato@lenoy.com.br";
const WHATSAPP_URL = "https://wa.me/5513997457207?text=Estou%20entrando%20em%20contato%20sobre%20a%20plataforma%20imobili%C3%A1ria.";
const INTERNAL_PREFIXES = ["/admin", "/app", "/plataforma"];

export default function GlobalSiteFooter() {
  const pathname = usePathname();
  const [contactOpen, setContactOpen] = useState(false);

  const isInternalArea = INTERNAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  useEffect(() => {
    if (!contactOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContactOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contactOpen]);

  if (isInternalArea) return null;

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nome = String(formData.get("nome") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const telefone = String(formData.get("telefone") || "").trim();
    const mensagem = String(formData.get("mensagem") || "").trim();

    if (!nome || !email || !telefone || !mensagem) return;

    const subject = `Contato sobre a plataforma imobiliária - ${nome}`;
    const body = [
      "Olá, equipe LENOY.",
      "",
      "Estou entrando em contato sobre a plataforma imobiliária.",
      "",
      `Nome: ${nome}`,
      `E-mail: ${email}`,
      `Telefone: ${telefone}`,
      "",
      "Mensagem:",
      mensagem,
      "",
      `Página de origem: ${window.location.href}`,
    ].join("\n");

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <>
      <style>{`
        .lenoyGlobalFooter {
          position: relative;
          z-index: 10;
          background: #07182d;
          color: rgba(255,255,255,.72);
          border-top: 1px solid rgba(216,173,85,.28);
        }
        .lenoyGlobalFooter__inner {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          min-height: 122px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
          padding: 28px 0;
        }
        .lenoyGlobalFooter__brand {
          min-width: 0;
        }
        .lenoyGlobalFooter__brand strong {
          display: block;
          color: #fff;
          font-size: 17px;
          letter-spacing: .08em;
        }
        .lenoyGlobalFooter__brand span {
          display: block;
          margin-top: 5px;
          color: #d8ad55;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .18em;
          text-transform: uppercase;
        }
        .lenoyGlobalFooter__brand small {
          display: block;
          margin-top: 9px;
          color: rgba(255,255,255,.52);
          font-size: 12px;
        }
        .lenoyGlobalFooter__actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 10px;
        }
        .lenoyGlobalFooter__email,
        .lenoyGlobalFooter__whatsapp {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 17px;
          border-radius: 11px;
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
          transition: transform .18s ease, border-color .18s ease, background .18s ease;
        }
        .lenoyGlobalFooter__email {
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: #fff;
        }
        .lenoyGlobalFooter__whatsapp {
          border: 1px solid #25d366;
          background: #25d366;
          color: #062412;
        }
        .lenoyGlobalFooter__email:hover,
        .lenoyGlobalFooter__whatsapp:hover {
          transform: translateY(-1px);
        }
        .lenoyContactModal {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          display: grid;
          place-items: center;
          padding: 20px;
        }
        .lenoyContactModal__backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(2,10,19,.78);
          backdrop-filter: blur(7px);
          cursor: pointer;
        }
        .lenoyContactModal__panel {
          position: relative;
          z-index: 1;
          width: min(94vw, 560px);
          max-height: 92vh;
          overflow-y: auto;
          border: 1px solid rgba(216,173,85,.24);
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 28px 90px rgba(0,0,0,.42);
          padding: 32px;
        }
        .lenoyContactModal__close {
          position: absolute;
          top: 13px;
          right: 13px;
          width: 38px;
          height: 38px;
          border: 1px solid #dfe5ea;
          border-radius: 999px;
          background: #f7f9fa;
          color: #102338;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
        }
        .lenoyContactModal__eyebrow {
          display: inline-block;
          margin-bottom: 11px;
          color: #b1812e;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .lenoyContactModal h2 {
          margin: 0;
          padding-right: 42px;
          color: #07182d;
          font-size: 29px;
          line-height: 1.12;
          letter-spacing: -.02em;
        }
        .lenoyContactModal__intro {
          margin: 12px 0 24px;
          color: #667481;
          font-size: 14px;
          line-height: 1.6;
        }
        .lenoyContactModal form {
          display: grid;
          gap: 15px;
        }
        .lenoyContactModal label {
          display: grid;
          gap: 7px;
          color: #273b4e;
          font-size: 12px;
          font-weight: 800;
        }
        .lenoyContactModal input,
        .lenoyContactModal textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d9e0e6;
          border-radius: 11px;
          background: #fff;
          color: #102338;
          padding: 12px 13px;
          font: inherit;
          font-size: 14px;
          outline: none;
        }
        .lenoyContactModal input:focus,
        .lenoyContactModal textarea:focus {
          border-color: #c39642;
          box-shadow: 0 0 0 3px rgba(195,150,66,.11);
        }
        .lenoyContactModal textarea {
          min-height: 125px;
          resize: vertical;
        }
        .lenoyContactModal__submit {
          min-height: 48px;
          margin-top: 2px;
          border: 1px solid #d8ad55;
          border-radius: 11px;
          background: #d8ad55;
          color: #07182d;
          font: inherit;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }
        .lenoyContactModal__note {
          margin: 10px 0 0;
          color: #7c8791;
          font-size: 11px;
          line-height: 1.5;
          text-align: center;
        }
        @media (max-width: 700px) {
          .lenoyGlobalFooter__inner {
            width: min(100% - 28px, 1180px);
            align-items: stretch;
            flex-direction: column;
            gap: 20px;
            padding: 26px 0 30px;
          }
          .lenoyGlobalFooter__brand {
            text-align: center;
          }
          .lenoyGlobalFooter__actions {
            display: grid;
            grid-template-columns: 1fr;
          }
          .lenoyGlobalFooter__email,
          .lenoyGlobalFooter__whatsapp {
            width: 100%;
            box-sizing: border-box;
          }
          .lenoyContactModal {
            padding: 12px;
          }
          .lenoyContactModal__panel {
            width: 100%;
            border-radius: 18px;
            padding: 27px 19px 22px;
          }
          .lenoyContactModal h2 {
            font-size: 25px;
          }
        }
      `}</style>

      <footer className="lenoyGlobalFooter" aria-label="Rodapé LENOY Imobiliárias">
        <div className="lenoyGlobalFooter__inner">
          <div className="lenoyGlobalFooter__brand">
            <strong>LENOY IMOBILIÁRIAS</strong>
            <span>Tecnologia para o mercado imobiliário</span>
            <small>© {new Date().getFullYear()} LENOY. Todos os direitos reservados.</small>
          </div>

          <div className="lenoyGlobalFooter__actions">
            <button
              type="button"
              className="lenoyGlobalFooter__email"
              onClick={() => setContactOpen(true)}
              aria-haspopup="dialog"
            >
              ✉ {CONTACT_EMAIL}
            </button>
            <a
              className="lenoyGlobalFooter__whatsapp"
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </footer>

      {contactOpen ? (
        <div className="lenoyContactModal" role="dialog" aria-modal="true" aria-labelledby="lenoy-contact-title">
          <button
            type="button"
            className="lenoyContactModal__backdrop"
            aria-label="Fechar contato"
            onClick={() => setContactOpen(false)}
          />

          <div className="lenoyContactModal__panel">
            <button
              type="button"
              className="lenoyContactModal__close"
              aria-label="Fechar"
              onClick={() => setContactOpen(false)}
            >
              ×
            </button>

            <span className="lenoyContactModal__eyebrow">Fale com a LENOY</span>
            <h2 id="lenoy-contact-title">Envie sua mensagem</h2>
            <p className="lenoyContactModal__intro">
              Preencha seus dados e a mensagem será preparada para envio a {CONTACT_EMAIL}.
            </p>

            <form onSubmit={submitContact}>
              <label>
                Nome
                <input name="nome" type="text" required maxLength={160} autoComplete="name" />
              </label>
              <label>
                E-mail
                <input name="email" type="email" required maxLength={254} autoComplete="email" />
              </label>
              <label>
                Telefone
                <input name="telefone" type="tel" required maxLength={40} autoComplete="tel" />
              </label>
              <label>
                Mensagem
                <textarea name="mensagem" required maxLength={4000} />
              </label>

              <button className="lenoyContactModal__submit" type="submit">
                Enviar para {CONTACT_EMAIL}
              </button>
            </form>
            <p className="lenoyContactModal__note">
              O envio utiliza o aplicativo de e-mail configurado no dispositivo, mantendo compatibilidade com o pacote estático do site.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
