"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Agency = { id: string; name: string; slug: string };

export default function PlatformClientDeleteControl() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [target, setTarget] = useState<Agency | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  const agencyBySlug = useMemo(() => new Map(agencies.map((agency) => [agency.slug, agency])), [agencies]);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/plataforma") return;
    if (!supabaseBrowser || !isSupabaseConfigured) return;

    void (async () => {
      const result = await supabaseBrowser.from("agencies").select("id,name,slug").order("created_at", { ascending: false });
      if (!result.error) setAgencies((result.data || []) as Agency[]);
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/plataforma") return;

    const apply = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".platformCommercialPage .commercialClientCard"));
      cards.forEach((card) => {
        if (card.querySelector(".commercialDeleteClientButton")) return;
        const host = card.querySelector<HTMLElement>(".commercialClientHeader small")?.textContent?.trim() || "";
        const slug = host.split(".")[0]?.trim() || "";
        const agency = agencyBySlug.get(slug);
        if (!agency) return;

        const editButton = card.querySelector<HTMLButtonElement>(".commercialEditClientButton");
        if (!editButton) return;

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "commercialDeleteClientButton";
        deleteButton.textContent = "Excluir usuário";
        deleteButton.addEventListener("click", () => {
          setMessage("");
          setConfirmation("");
          setTarget(agency);
        });
        editButton.insertAdjacentElement("afterend", deleteButton);
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [agencyBySlug]);

  useEffect(() => {
    if (!target) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [target, deleting]);

  async function removeClient() {
    if (!target || !supabaseBrowser || confirmation.trim() !== target.name.trim()) return;
    setDeleting(true);
    setMessage("");

    const result = await supabaseBrowser.functions.invoke("delete-platform-client", {
      body: { agency_id: target.id, confirmation: confirmation.trim() },
    });

    if (result.error) {
      let detail = result.error.message || "Não foi possível excluir o usuário.";
      const context = (result.error as { context?: Response }).context;
      if (context) {
        try {
          const body = await context.clone().json();
          if (body?.error === "current_admin_account_protected" || body?.error === "platform_admin_account_protected") {
            detail = "Este usuário está protegido porque pertence à administração da plataforma.";
          } else if (body?.error === "confirmation_mismatch") {
            detail = "O nome digitado não confere com o cliente.";
          } else if (body?.detail) {
            detail = String(body.detail);
          }
        } catch {}
      }
      setMessage(detail);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setTarget(null);
    window.location.reload();
  }

  return (
    <>
      <style>{`
        .platformCommercialPage .commercialDeleteClientButton {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 190px !important;
          min-height: 40px !important;
          margin: 8px 0 0 auto !important;
          padding: 0 16px !important;
          border: 1px solid #e5b4b0 !important;
          border-radius: 11px !important;
          background: #fff8f7 !important;
          color: #a63f38 !important;
          font-size: 12px !important;
          font-weight: 850 !important;
          cursor: pointer !important;
        }
        .platformCommercialPage .commercialDeleteClientButton:hover {
          border-color: #b84239 !important;
          background: #b84239 !important;
          color: #fff !important;
        }
        .platformDeleteModal {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(5, 17, 29, .72);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .platformDeleteModal__card {
          width: min(92vw, 520px);
          padding: 28px;
          border: 1px solid #e4e9ed;
          border-radius: 20px;
          background: #fff;
          box-shadow: 0 28px 80px rgba(6, 21, 37, .28);
          color: #14293d;
        }
        .platformDeleteModal__eyebrow {
          color: #b84239;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .1em;
        }
        .platformDeleteModal__card h3 {
          margin: 7px 0 10px;
          font-size: 24px;
          line-height: 1.15;
        }
        .platformDeleteModal__card p {
          margin: 0 0 14px;
          color: #657586;
          font-size: 14px;
          line-height: 1.5;
        }
        .platformDeleteModal__warning {
          padding: 12px 14px;
          border: 1px solid #efd0cc;
          border-radius: 11px;
          background: #fff7f6;
          color: #8f3933 !important;
        }
        .platformDeleteModal__card label {
          display: grid;
          gap: 7px;
          margin-top: 18px;
          color: #405467;
          font-size: 12px;
          font-weight: 800;
        }
        .platformDeleteModal__card input {
          width: 100%;
          min-height: 44px;
          box-sizing: border-box;
          padding: 9px 11px;
          border: 1px solid #cdd7df;
          border-radius: 10px;
          background: #fff;
          color: #13293d;
          font-size: 14px;
        }
        .platformDeleteModal__message {
          margin-top: 12px !important;
          color: #a63f38 !important;
          font-weight: 700;
        }
        .platformDeleteModal__actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }
        .platformDeleteModal__actions button {
          min-height: 42px;
          padding: 0 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 850;
          cursor: pointer;
        }
        .platformDeleteModal__cancel {
          border: 1px solid #ccd6de;
          background: #f7f9fa;
          color: #22384d;
        }
        .platformDeleteModal__confirm {
          border: 1px solid #b84239;
          background: #b84239;
          color: #fff;
        }
        .platformDeleteModal__confirm:disabled {
          cursor: not-allowed;
          opacity: .45;
        }
        @media(max-width:720px){
          .platformCommercialPage .commercialDeleteClientButton { width: 100% !important; margin-left: 0 !important; }
          .platformDeleteModal__card { padding: 22px; }
          .platformDeleteModal__actions { flex-direction: column-reverse; }
          .platformDeleteModal__actions button { width: 100%; }
        }
      `}</style>

      {target ? (
        <div className="platformDeleteModal" role="dialog" aria-modal="true" aria-labelledby="platform-delete-title">
          <div className="platformDeleteModal__card">
            <span className="platformDeleteModal__eyebrow">EXCLUSÃO PERMANENTE</span>
            <h3 id="platform-delete-title">Excluir {target.name}?</h3>
            <p className="platformDeleteModal__warning">
              Esta ação remove o cliente da plataforma, seus dados vinculados e os usuários que não pertençam a outra imobiliária. Não pode ser desfeita.
            </p>
            <p>Para confirmar, digite exatamente o nome abaixo:</p>
            <strong>{target.name}</strong>
            <label>
              Confirmação
              <input
                autoFocus
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={deleting}
              />
            </label>
            {message ? <p className="platformDeleteModal__message">{message}</p> : null}
            <div className="platformDeleteModal__actions">
              <button className="platformDeleteModal__cancel" type="button" disabled={deleting} onClick={() => setTarget(null)}>Cancelar</button>
              <button
                className="platformDeleteModal__confirm"
                type="button"
                disabled={deleting || confirmation.trim() !== target.name.trim()}
                onClick={() => void removeClient()}
              >
                {deleting ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
