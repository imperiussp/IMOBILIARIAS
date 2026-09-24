"use client";

// Platform-only administrative lifecycle controls.

import { FormEvent, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Agency = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  whatsapp: string | null;
  status: string;
};

type Plan = {
  id: string;
  name: string;
  code: string;
  active: boolean;
};

type ModalMode = "create" | "edit" | null;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function friendlyError(error: unknown) {
  const base = error as { message?: string; context?: Response };
  return base?.message || "Não foi possível concluir a operação.";
}

export default function PlatformClientAdminActions() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [planId, setPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [agencyStatus, setAgencyStatus] = useState("pending_payment");
  const [subscriptionStatus, setSubscriptionStatus] = useState("none");
  const [implementationStatus, setImplementationStatus] = useState("pending");

  const agencyBySlug = useMemo(() => new Map(agencies.map((agency) => [agency.slug, agency])), [agencies]);

  async function load() {
    if (!supabaseBrowser || !isSupabaseConfigured) return;
    const [agencyResult, planResult] = await Promise.all([
      supabaseBrowser.from("agencies").select("id,name,slug,email,whatsapp,status").order("created_at", { ascending: false }),
      supabaseBrowser.from("subscription_plans").select("id,name,code,active").eq("active", true).order("display_order"),
    ]);
    if (!agencyResult.error) setAgencies((agencyResult.data || []) as Agency[]);
    if (!planResult.error) setPlans(((planResult.data || []) as Plan[]).filter((plan) => plan.code !== "homologacao"));
  }

  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname.replace(/\/+$/, "") !== "/plataforma") return;
    void load();
  }, []);

  useEffect(() => {
    if (!modal) return;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) setModal(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [modal, working]);

  function openCreate() {
    setEditingAgency(null);
    setAgencyName("");
    setSlug("");
    setSlugTouched(false);
    setEmail("");
    setWhatsapp("");
    setPlanId("");
    setBillingCycle("monthly");
    setAgencyStatus("pending_payment");
    setSubscriptionStatus("none");
    setImplementationStatus("pending");
    setMessage("");
    setModal("create");
  }

  function openEdit(agency: Agency) {
    setEditingAgency(agency);
    setAgencyName(agency.name);
    setSlug(agency.slug);
    setSlugTouched(true);
    setEmail(agency.email || "");
    setWhatsapp(agency.whatsapp || "");
    setMessage("");
    setModal("edit");
  }

  useEffect(() => {
    if (modal === "create" && !slugTouched) setSlug(slugify(agencyName));
  }, [agencyName, slugTouched, modal]);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname.replace(/\/+$/, "") !== "/plataforma") return;

    const apply = () => {
      const header = document.querySelector<HTMLElement>(".platformCommercialPage .commercialClientsPanel .adminPanelHeader");
      if (header && !header.querySelector(".platformNewAgencyButton")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "platformNewAgencyButton";
        button.textContent = "+ Nova imobiliária";
        button.addEventListener("click", openCreate);
        header.appendChild(button);
      }

      const cards = Array.from(document.querySelectorAll<HTMLElement>(".platformCommercialPage .commercialClientCard"));
      cards.forEach((card) => {
        if (card.querySelector(".platformClientIdentityButton")) return;
        const host = card.querySelector<HTMLElement>(".commercialClientHeader small")?.textContent?.trim() || "";
        const cardSlug = host.split(".")[0]?.trim() || "";
        const agency = agencyBySlug.get(cardSlug);
        if (!agency) return;

        const editButton = card.querySelector<HTMLButtonElement>(".commercialEditClientButton");
        if (!editButton) return;

        const identityButton = document.createElement("button");
        identityButton.type = "button";
        identityButton.className = "platformClientIdentityButton";
        identityButton.textContent = "Editar cadastro";
        identityButton.addEventListener("click", () => openEdit(agency));
        editButton.insertAdjacentElement("afterend", identityButton);

        const accessButton = document.createElement("button");
        accessButton.type = "button";
        accessButton.className = `platformClientAccessButton ${agency.status === "suspended" || agency.status === "cancelled" ? "isRelease" : "isBlock"}`;
        accessButton.textContent = agency.status === "suspended" || agency.status === "cancelled" ? "Liberar acesso" : "Bloquear acesso";
        accessButton.addEventListener("click", async () => {
          if (!supabaseBrowser) return;
          const targetStatus = agency.status === "suspended" || agency.status === "cancelled" ? "active" : "suspended";
          const ok = window.confirm(targetStatus === "suspended"
            ? `Bloquear o acesso de ${agency.name}?`
            : `Liberar novamente o acesso de ${agency.name}?`);
          if (!ok) return;
          accessButton.disabled = true;
          const result = await supabaseBrowser.rpc("platform_set_agency_status", {
            p_agency_id: agency.id,
            p_status: targetStatus,
          });
          if (result.error) {
            window.alert(result.error.message);
            accessButton.disabled = false;
            return;
          }
          window.location.reload();
        });
        identityButton.insertAdjacentElement("afterend", accessButton);
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [agencyBySlug]);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser) return;
    setWorking(true);
    setMessage("");

    const result = await supabaseBrowser.functions.invoke("manage-platform-client", {
      body: {
        action: "create",
        name: agencyName.trim(),
        email: email.trim(),
        slug: slugify(slug),
        whatsapp: whatsapp.trim(),
        plan_id: planId || null,
        billing_cycle: billingCycle,
        agency_status: agencyStatus,
        subscription_status: subscriptionStatus,
        implementation_status: implementationStatus,
      },
    });

    setWorking(false);
    if (result.error) return setMessage(friendlyError(result.error));
    setMessage("Imobiliária criada. O convite de acesso foi enviado ao e-mail do proprietário.");
    window.setTimeout(() => window.location.reload(), 900);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !editingAgency) return;
    setWorking(true);
    setMessage("");

    const result = await supabaseBrowser.functions.invoke("manage-platform-client", {
      body: {
        action: "update_identity",
        agency_id: editingAgency.id,
        name: agencyName.trim(),
        email: email.trim(),
        slug: slugify(slug),
        whatsapp: whatsapp.trim(),
      },
    });

    setWorking(false);
    if (result.error) return setMessage(friendlyError(result.error));
    setMessage("Cadastro atualizado.");
    window.setTimeout(() => window.location.reload(), 700);
  }

  return (
    <>
      <style>{`
        .platformCommercialPage .platformNewAgencyButton{
          margin-left:auto!important;min-height:42px!important;padding:0 17px!important;border:1px solid #d4a43d!important;border-radius:11px!important;background:#d9aa42!important;color:#11283d!important;font-size:13px!important;font-weight:900!important;cursor:pointer!important;white-space:nowrap!important
        }
        .platformCommercialPage .platformClientIdentityButton,
        .platformCommercialPage .platformClientAccessButton{
          display:flex!important;align-items:center!important;justify-content:center!important;width:190px!important;min-height:40px!important;margin:8px 0 0 auto!important;padding:0 16px!important;border-radius:11px!important;font-size:12px!important;font-weight:850!important;cursor:pointer!important
        }
        .platformCommercialPage .platformClientIdentityButton{border:1px solid #c9d4dd!important;background:#f7f9fb!important;color:#183149!important}
        .platformCommercialPage .platformClientAccessButton.isBlock{border:1px solid #e5c3a3!important;background:#fff9f1!important;color:#9a5b20!important}
        .platformCommercialPage .platformClientAccessButton.isRelease{border:1px solid #aad7bb!important;background:#f2fbf5!important;color:#247247!important}
        .platformClientAdminModal{position:fixed;inset:0;z-index:2147483100;display:grid;place-items:center;padding:20px;background:rgba(5,17,29,.72);backdrop-filter:blur(6px)}
        .platformClientAdminModal__card{width:min(94vw,720px);max-height:92vh;overflow:auto;box-sizing:border-box;padding:28px;border:1px solid #dfe6eb;border-radius:20px;background:#fff;box-shadow:0 28px 80px rgba(6,21,37,.28);color:#14293d}
        .platformClientAdminModal__head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px}
        .platformClientAdminModal__head h3{margin:5px 0 0;font-size:25px}
        .platformClientAdminModal__eyebrow{color:#a77b25;font-size:11px;font-weight:900;letter-spacing:.1em}
        .platformClientAdminModal__close{width:38px;height:38px;border:1px solid #d7e0e7;border-radius:999px;background:#f7f9fa;color:#183149;font-size:22px;cursor:pointer}
        .platformClientAdminModal form{display:grid;gap:14px}
        .platformClientAdminModal__grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .platformClientAdminModal__grid.three{grid-template-columns:repeat(3,1fr)}
        .platformClientAdminModal label{display:grid;gap:7px;color:#405467;font-size:12px;font-weight:800}
        .platformClientAdminModal input,.platformClientAdminModal select{width:100%;min-height:44px;box-sizing:border-box;padding:9px 11px;border:1px solid #cdd7df;border-radius:10px;background:#fff;color:#13293d;font:inherit}
        .platformClientAdminModal__address{margin:-4px 0 4px;color:#71808d;font-size:12px}
        .platformClientAdminModal__actions{display:flex;justify-content:flex-end;gap:10px;margin-top:8px}
        .platformClientAdminModal__actions button{min-height:43px;padding:0 17px;border-radius:10px;font-weight:850;cursor:pointer}
        .platformClientAdminModal__cancel{border:1px solid #ccd6de;background:#f7f9fa;color:#22384d}
        .platformClientAdminModal__save{border:1px solid #d5a33b;background:#d9aa42;color:#10263d}
        .platformClientAdminModal__message{padding:11px 13px;border-radius:10px;background:#f3f7fa;color:#334b60;font-size:13px;font-weight:700}
        @media(max-width:720px){
          .platformCommercialPage .platformNewAgencyButton{width:100%;margin-left:0!important}
          .platformCommercialPage .platformClientIdentityButton,.platformCommercialPage .platformClientAccessButton{width:100%!important;margin-left:0!important}
          .platformClientAdminModal{padding:10px}
          .platformClientAdminModal__card{padding:20px}
          .platformClientAdminModal__grid,.platformClientAdminModal__grid.three{grid-template-columns:1fr}
          .platformClientAdminModal__actions{flex-direction:column-reverse}
          .platformClientAdminModal__actions button{width:100%}
        }
      `}</style>

      {modal ? (
        <div className="platformClientAdminModal" role="dialog" aria-modal="true">
          <div className="platformClientAdminModal__card">
            <div className="platformClientAdminModal__head">
              <div>
                <span className="platformClientAdminModal__eyebrow">{modal === "create" ? "NOVO CLIENTE" : "IDENTIFICAÇÃO DA IMOBILIÁRIA"}</span>
                <h3>{modal === "create" ? "Cadastrar nova imobiliária" : "Editar cadastro"}</h3>
              </div>
              <button className="platformClientAdminModal__close" type="button" disabled={working} onClick={() => setModal(null)}>×</button>
            </div>

            <form onSubmit={modal === "create" ? submitCreate : submitEdit}>
              <div className="platformClientAdminModal__grid">
                <label>Nome da imobiliária<input required maxLength={160} value={agencyName} onChange={(event) => setAgencyName(event.target.value)} /></label>
                <label>E-mail do proprietário<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              </div>
              <div className="platformClientAdminModal__grid">
                <label>Endereço / slug<input required maxLength={48} value={slug} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); }} /></label>
                <label>WhatsApp<input maxLength={40} inputMode="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} /></label>
              </div>
              <div className="platformClientAdminModal__address">{slugify(slug) || "nova-imobiliaria"}.imoveis.lenoy.com.br</div>

              {modal === "create" ? (
                <>
                  <div className="platformClientAdminModal__grid three">
                    <label>Plano<select value={planId} onChange={(event) => setPlanId(event.target.value)}>
                      <option value="">Sem plano</option>
                      {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                    </select></label>
                    <label>Cobrança<select value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as "monthly" | "annual")}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></label>
                    <label>Implantação<select value={implementationStatus} onChange={(event) => setImplementationStatus(event.target.value)}><option value="pending">Pendente</option><option value="paid">Paga</option><option value="waived">Grátis / dispensada</option></select></label>
                  </div>
                  <div className="platformClientAdminModal__grid">
                    <label>Acesso inicial<select value={agencyStatus} onChange={(event) => setAgencyStatus(event.target.value)}><option value="pending_payment">Aguardando pagamento</option><option value="active">Liberado</option><option value="trial">Conta interna / teste</option><option value="suspended">Suspenso</option></select></label>
                    <label>Assinatura<select value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value)}><option value="none">Sem assinatura</option><option value="active">Ativa</option><option value="trial">Conta interna / teste</option><option value="past_due">Pagamento atrasado</option></select></label>
                  </div>
                  <div className="platformClientAdminModal__message">Ao salvar, o proprietário receberá um convite no e-mail informado para acessar a nova imobiliária.</div>
                </>
              ) : (
                <div className="platformClientAdminModal__message">Plano, cobrança, vencimento e status continuam sendo editados pelo botão “Editar cliente” que já existe no card.</div>
              )}

              {message ? <div className="platformClientAdminModal__message">{message}</div> : null}
              <div className="platformClientAdminModal__actions">
                <button className="platformClientAdminModal__cancel" type="button" disabled={working} onClick={() => setModal(null)}>Cancelar</button>
                <button className="platformClientAdminModal__save" type="submit" disabled={working}>{working ? "Salvando..." : modal === "create" ? "Criar imobiliária e enviar convite" : "Salvar cadastro"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
