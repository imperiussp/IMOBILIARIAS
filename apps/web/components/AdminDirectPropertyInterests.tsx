"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type InterestInteraction = {
  id: string;
  contact_id: string;
  property_id: string | null;
  interaction_type: string;
  source: string | null;
  occurred_at: string;
};

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type Property = {
  id: string;
  code: string;
  title: string;
  price: number | null;
};

type DirectInterest = {
  key: string;
  contact: Contact;
  property: Property;
  source: string;
  occurredAt: string;
};

function whatsappNumber(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 10 ? digits : "";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function originLabel(source: string) {
  if (source === "web-property-detail") return "Portal do imóvel";
  if (source === "app") return "Marcado pela equipe";
  return source ? "Contato registrado" : "Interesse direto";
}

export default function AdminDirectPropertyInterests() {
  const [target, setTarget] = useState<Element | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [items, setItems] = useState<DirectInterest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    setLoading(true);
    setMessage("");
    const agency = await getCurrentAgency();
    if (!agency) {
      setLoading(false);
      setMessage("Imobiliária ativa não encontrada.");
      return;
    }
    setAgencyName(agency.agencyName);

    const interactionResult = await supabaseBrowser
      .from("contact_interactions")
      .select("id,contact_id,property_id,interaction_type,source,occurred_at")
      .eq("agency_id", agency.agencyId)
      .in("interaction_type", ["property_interest", "property_interest_manual"])
      .not("property_id", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(1000);

    if (interactionResult.error) {
      setLoading(false);
      setMessage(interactionResult.error.message);
      return;
    }

    const interactions = (interactionResult.data || []) as InterestInteraction[];
    const contactIds = Array.from(new Set(interactions.map((item) => item.contact_id).filter(Boolean)));
    const propertyIds = Array.from(new Set(interactions.map((item) => item.property_id).filter((value): value is string => Boolean(value))));

    const [contactResult, propertyResult] = await Promise.all([
      contactIds.length
        ? supabaseBrowser.from("agency_contacts").select("id,name,phone,email").eq("agency_id", agency.agencyId).in("id", contactIds)
        : Promise.resolve({ data: [], error: null }),
      propertyIds.length
        ? supabaseBrowser.from("properties").select("id,code,title,price").eq("agency_id", agency.agencyId).in("id", propertyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const hardError = contactResult.error || propertyResult.error;
    if (hardError) {
      setLoading(false);
      setMessage(hardError.message);
      return;
    }

    const contacts = new Map(((contactResult.data || []) as Contact[]).map((item) => [item.id, item]));
    const properties = new Map(((propertyResult.data || []) as Property[]).map((item) => [item.id, item]));
    const seen = new Set<string>();
    const direct: DirectInterest[] = [];

    interactions.forEach((interaction) => {
      if (!interaction.property_id) return;
      const key = `${interaction.contact_id}:${interaction.property_id}`;
      if (seen.has(key)) return;
      const contact = contacts.get(interaction.contact_id);
      const property = properties.get(interaction.property_id);
      if (!contact || !property) return;
      seen.add(key);
      direct.push({
        key,
        contact,
        property,
        source: interaction.source || (interaction.interaction_type === "property_interest_manual" ? "app" : "web-property-detail"),
        occurredAt: interaction.occurred_at,
      });
    });

    setItems(direct);
    setLoading(false);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.pathname.includes("/admin")) return;
    let disposed = false;
    let observer: MutationObserver | null = null;

    const resolveTarget = () => {
      const panel = document.querySelector("#oportunidades-ia");
      if (!panel || disposed) return;
      let host = panel.querySelector(".directPropertyInterestPortalHost");
      if (!host) {
        host = document.createElement("div");
        host.className = "directPropertyInterestPortalHost";
        const filters = panel.querySelector(".adminFilters");
        if (filters) panel.insertBefore(host, filters);
        else panel.appendChild(host);
      }
      setTarget(host);
      observer?.disconnect();
      void load();
    };

    resolveTarget();
    observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  const whatsappReady = useMemo(() => items.filter((item) => Boolean(whatsappNumber(item.contact.phone))).length, [items]);

  if (!target) return null;

  return createPortal(
    <section className="directPropertyInterests" aria-label="Interessados em imóveis">
      <div className="adminPanelHeader">
        <div>
          <span className="eyebrow">INTERESSE DIRETO</span>
          <h3>Interessados em imóveis</h3>
          <p>Reúne quem foi marcado pela equipe e quem demonstrou interesse diretamente no portal do imóvel.</p>
        </div>
        <div className="adminPanelTools">
          <span>{loading ? "Carregando..." : `${items.length} vínculo(s) · ${whatsappReady} com WhatsApp`}</span>
          <button type="button" className="miniButton" onClick={() => void load()} disabled={loading}>Atualizar</button>
        </div>
      </div>
      {message ? <div className="formMessage">{message}</div> : null}
      <div className="adminTableWrap">
        <table className="adminTable directInterestTable">
          <thead><tr><th>Interessado</th><th>Imóvel</th><th>Origem</th><th>Quando</th><th>Contato</th></tr></thead>
          <tbody>
            {items.length ? items.map((item) => {
              const phone = whatsappNumber(item.contact.phone);
              const text = `Olá, ${item.contact.name}. Aqui é da ${agencyName || "imobiliária"}. Estou entrando em contato sobre seu interesse no imóvel ${item.property.title} (${item.property.code}).`;
              return <tr key={item.key}>
                <td><strong>{item.contact.name || "Contato sem nome"}</strong><small className="tableSub">{item.contact.phone || item.contact.email || "Sem telefone/e-mail"}</small></td>
                <td><strong>{item.property.title}</strong><small className="tableSub">{item.property.code}</small></td>
                <td><span className="statusPill">{originLabel(item.source)}</span></td>
                <td><small>{formatDate(item.occurredAt)}</small></td>
                <td>{phone ? <a className="miniButton whatsapp" href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a> : <button type="button" className="miniButton muted" disabled>Sem WhatsApp</button>}</td>
              </tr>;
            }) : <tr><td colSpan={5}>{loading ? "Carregando interessados..." : "Nenhum interessado vinculado a imóvel ainda."}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>,
    target,
  );
}
