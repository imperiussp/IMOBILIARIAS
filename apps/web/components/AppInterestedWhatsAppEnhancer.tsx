"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentAgency, type CurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type PropertyRow = { id: string; code: string; title: string };
type ContactRow = { id: string; name: string; phone: string | null; email: string | null };
type InterestRow = { contact_id: string; property_id: string | null };

function normalize(value: string) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR");
}

function whatsappNumber(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 10 ? digits : "";
}

export default function AppInterestedWhatsAppEnhancer() {
  const [agency, setAgency] = useState<CurrentAgency | null>(null);
  const [activeProperty, setActiveProperty] = useState<PropertyRow | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [newSelectedIds, setNewSelectedIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  const propertiesByIdRef = useRef(new Map<string, PropertyRow>());
  const propertiesByCodeRef = useRef(new Map<string, PropertyRow>());
  const contactsRef = useRef(new Map<string, ContactRow>());
  const interestsByPropertyRef = useRef(new Map<string, Set<string>>());
  const observerRef = useRef<MutationObserver | null>(null);
  const disposedRef = useRef(false);
  const surfaceRef = useRef<"admin" | "app" | "">("");

  function countFor(propertyId: string) {
    return interestsByPropertyRef.current.get(propertyId)?.size || 0;
  }

  function resolvePropertyFromRow(row: Element | null) {
    if (!row) return null;
    const explicitId = (row as HTMLElement).dataset.propertyId;
    if (explicitId) {
      const direct = propertiesByIdRef.current.get(explicitId);
      if (direct) return direct;
    }
    const rawCode = row.querySelector<HTMLElement>(".adminPropertyCode")?.textContent
      || row.querySelector<HTMLElement>("td:first-child strong")?.textContent
      || row.querySelector<HTMLElement>("strong")?.textContent
      || "";
    return propertiesByCodeRef.current.get(normalize(rawCode)) || null;
  }

  function openDialog(property: PropertyRow) {
    setActiveProperty(property);
    setSelectedMessageIds(new Set());
    setNewSelectedIds(new Set());
    setContactSearch("");
    setNotice("");
    setQueueIds([]);
    setQueueIndex(0);
  }

  function updateVisibleTriggers() {
    const isAdmin = surfaceRef.current === "admin";
    if (isAdmin) {
      document.querySelectorAll<HTMLTableRowElement>(".adminPage #imoveis .adminTable tbody tr").forEach((row) => {
        const property = resolvePropertyFromRow(row);
        if (!property) return;
        row.dataset.propertyId = property.id;
        const actionCell = row.querySelector<HTMLTableCellElement>("td:last-child");
        if (!actionCell) return;
        let button = actionCell.querySelector<HTMLButtonElement>(".propertyInterestMessageTrigger");
        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.className = "miniButton propertyInterestMessageTrigger";
          button.dataset.propertyInterestTrigger = "1";
          button.dataset.propertyId = property.id;
          actionCell.appendChild(button);
        }
        const count = countFor(property.id);
        button.textContent = count ? `Interessados (${count})` : "Interessados";
      });
    }

    document.querySelectorAll<HTMLTableRowElement>(".mobileAppV2 .livePropertiesOnly #imoveis tr[data-property-id]").forEach((row) => {
      const property = resolvePropertyFromRow(row);
      if (!property) return;
      const button = Array.from(row.querySelectorAll<HTMLButtonElement>(".appPropertyQuickButton"))
        .find((item) => item.textContent?.trim().startsWith("Interessados"));
      if (!button) return;
      button.dataset.propertyId = property.id;
      button.dataset.propertyInterestTrigger = "1";
      const count = countFor(property.id);
      button.textContent = count ? `Interessados (${count})` : "Interessados";
    });
  }

  async function loadData() {
    if (!supabaseBrowser) return;
    const currentAgency = await getCurrentAgency();
    if (!currentAgency || disposedRef.current) return;
    setAgency(currentAgency);

    const [propertyResult, contactResult, interestResult] = await Promise.all([
      supabaseBrowser.from("properties").select("id,code,title").eq("agency_id", currentAgency.agencyId).order("created_at", { ascending: false }),
      supabaseBrowser.from("agency_contacts").select("id,name,phone,email").eq("agency_id", currentAgency.agencyId).order("last_interaction_at", { ascending: false }).limit(1000),
      supabaseBrowser.from("contact_interactions").select("contact_id,property_id").eq("agency_id", currentAgency.agencyId).in("interaction_type", ["property_interest", "property_interest_manual"]).not("property_id", "is", null).limit(5000),
    ]);

    if (disposedRef.current) return;
    if (propertyResult.error || contactResult.error || interestResult.error) {
      setNotice(propertyResult.error?.message || contactResult.error?.message || interestResult.error?.message || "Erro ao carregar interessados.");
      return;
    }

    const properties = (propertyResult.data || []) as PropertyRow[];
    const contacts = (contactResult.data || []) as ContactRow[];
    const interests = (interestResult.data || []) as InterestRow[];

    propertiesByIdRef.current = new Map(properties.map((property) => [property.id, property]));
    propertiesByCodeRef.current = new Map(properties.map((property) => [normalize(property.code), property]));
    contactsRef.current = new Map(contacts.map((contact) => [contact.id, contact]));

    const interestMap = new Map<string, Set<string>>();
    interests.forEach((item) => {
      if (!item.property_id) return;
      const set = interestMap.get(item.property_id) || new Set<string>();
      set.add(item.contact_id);
      interestMap.set(item.property_id, set);
    });
    interestsByPropertyRef.current = interestMap;
    setDataVersion((value) => value + 1);
    window.requestAnimationFrame(updateVisibleTriggers);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isAdmin = window.location.pathname.includes("/admin");
    const isApp = window.location.pathname.includes("/app");
    if (!isAdmin && !isApp) return;
    if (isApp && new URLSearchParams(window.location.search).get("view") !== "imoveis") return;

    surfaceRef.current = isAdmin ? "admin" : "app";
    disposedRef.current = false;
    let queued = false;

    const schedule = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        updateVisibleTriggers();
      });
    };

    const clickCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const button = target.closest<HTMLButtonElement>("[data-property-interest-trigger='1'], .appPropertyQuickButton");
      if (!button) return;
      const isInterestedButton = button.dataset.propertyInterestTrigger === "1" || button.textContent?.trim().startsWith("Interessados");
      if (!isInterestedButton) return;
      const row = button.closest("tr");
      const propertyId = button.dataset.propertyId || (row as HTMLElement | null)?.dataset.propertyId || "";
      const property = propertiesByIdRef.current.get(propertyId) || resolvePropertyFromRow(row);
      if (!property) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openDialog(property);
    };

    document.addEventListener("click", clickCapture, true);
    observerRef.current = new MutationObserver(schedule);
    observerRef.current.observe(document.body, { childList: true, subtree: true });
    void loadData();

    return () => {
      disposedRef.current = true;
      document.removeEventListener("click", clickCapture, true);
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const interestedContacts = useMemo(() => {
    if (!activeProperty) return [] as ContactRow[];
    const ids = interestsByPropertyRef.current.get(activeProperty.id) || new Set<string>();
    return Array.from(ids).map((id) => contactsRef.current.get(id)).filter((item): item is ContactRow => Boolean(item));
  }, [activeProperty, dataVersion]);

  const availableContacts = useMemo(() => {
    if (!activeProperty) return [] as ContactRow[];
    const existing = interestsByPropertyRef.current.get(activeProperty.id) || new Set<string>();
    const term = normalize(contactSearch);
    return Array.from(contactsRef.current.values()).filter((contact) => {
      if (existing.has(contact.id)) return false;
      if (!term) return true;
      return normalize([contact.name, contact.phone || "", contact.email || ""].join(" ")).includes(term);
    });
  }, [activeProperty, contactSearch, dataVersion]);

  function messageText(contact: ContactRow) {
    const property = activeProperty;
    if (!property) return "";
    return `Olá, ${contact.name}. Aqui é da ${agency?.agencyName || "imobiliária"}. Estou entrando em contato sobre seu interesse no imóvel ${property.title} (${property.code}).`;
  }

  function openWhats(contactId: string) {
    const contact = contactsRef.current.get(contactId);
    if (!contact) return false;
    const phone = whatsappNumber(contact.phone);
    if (!phone) {
      setNotice(`${contact.name} não possui WhatsApp cadastrado.`);
      return false;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageText(contact))}`, "_blank", "noopener,noreferrer");
    return true;
  }

  function toggleMessage(contactId: string) {
    setSelectedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  function toggleNew(contactId: string) {
    setNewSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  function toggleAllMessageable() {
    const ids = interestedContacts.filter((contact) => Boolean(whatsappNumber(contact.phone))).map((contact) => contact.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedMessageIds.has(id));
    setSelectedMessageIds(allSelected ? new Set() : new Set(ids));
  }

  function startQueue(ids: string[]) {
    const ready = Array.from(new Set(ids)).filter((id) => {
      const contact = contactsRef.current.get(id);
      return Boolean(contact && whatsappNumber(contact.phone));
    });
    if (!ready.length) {
      setNotice("Nenhum dos interessados selecionados possui WhatsApp cadastrado.");
      return;
    }
    setQueueIds(ready);
    setQueueIndex(0);
    if (openWhats(ready[0])) setQueueIndex(1);
  }

  function openNextQueue() {
    if (queueIndex >= queueIds.length) return;
    if (openWhats(queueIds[queueIndex])) setQueueIndex((value) => value + 1);
  }

  async function saveNewInterests() {
    if (!supabaseBrowser || !agency || !activeProperty || !newSelectedIds.size) return;
    setSaving(true);
    setNotice("");
    const existing = interestsByPropertyRef.current.get(activeProperty.id) || new Set<string>();
    const freshIds = Array.from(newSelectedIds).filter((id) => !existing.has(id));
    if (!freshIds.length) {
      setSaving(false);
      return;
    }
    const now = new Date().toISOString();
    const source = surfaceRef.current === "admin" ? "admin" : "app";
    const rows = freshIds.map((contactId) => ({
      agency_id: agency.agencyId,
      contact_id: contactId,
      property_id: activeProperty.id,
      interaction_type: "property_interest_manual",
      source,
      title: "Marcado como interessado",
      message: `${activeProperty.title} (${activeProperty.code})`,
      external_key: `${source}-property-interest:${activeProperty.id}:${contactId}:${Date.now()}`,
      occurred_at: now,
    }));
    const { error } = await supabaseBrowser.from("contact_interactions").insert(rows);
    if (error) {
      setNotice(error.message);
      setSaving(false);
      return;
    }
    const next = new Set(existing);
    freshIds.forEach((id) => next.add(id));
    interestsByPropertyRef.current.set(activeProperty.id, next);
    setNewSelectedIds(new Set());
    setNotice(`${freshIds.length} interessado(s) adicionado(s) ao imóvel.`);
    setSaving(false);
    setDataVersion((value) => value + 1);
    window.requestAnimationFrame(updateVisibleTriggers);
  }

  if (!activeProperty) return null;

  const messageableIds = interestedContacts.filter((contact) => Boolean(whatsappNumber(contact.phone))).map((contact) => contact.id);
  const queueDone = queueIds.length > 0 && queueIndex >= queueIds.length;

  return <div className="propertyInterestMessagingLayer" role="dialog" aria-modal="true" aria-label={`Interessados em ${activeProperty.title}`}>
    <button className="propertyInterestMessagingBackdrop" type="button" aria-label="Fechar" onClick={() => setActiveProperty(null)} />
    <section className="propertyInterestMessagingDialog">
      <header className="propertyInterestMessagingHead">
        <div><small>INTERESSADOS</small><strong>{activeProperty.title}</strong><span>{activeProperty.code}</span></div>
        <button type="button" aria-label="Fechar" onClick={() => setActiveProperty(null)}>×</button>
      </header>

      <div className="propertyInterestMessagingBody">
        <section className="propertyInterestCurrentSection">
          <div className="propertyInterestSectionTitle">
            <div><strong>Interessados neste imóvel</strong><small>Selecione 1, vários ou todos para conversar pelo WhatsApp.</small></div>
            <button type="button" onClick={toggleAllMessageable}>{messageableIds.length && messageableIds.every((id) => selectedMessageIds.has(id)) ? "Desmarcar todos" : "Selecionar todos"}</button>
          </div>

          <div className="propertyInterestCurrentList">
            {interestedContacts.length ? interestedContacts.map((contact) => {
              const phone = whatsappNumber(contact.phone);
              const checked = selectedMessageIds.has(contact.id);
              return <div className="propertyInterestCurrentRow" key={contact.id}>
                <label className="propertyInterestSelectPerson">
                  <input type="checkbox" checked={checked} disabled={!phone} onChange={() => toggleMessage(contact.id)} />
                  <span><strong>{contact.name || "Contato sem nome"}</strong><small>{[contact.phone, contact.email].filter(Boolean).join(" · ") || "Sem telefone/e-mail"}</small></span>
                </label>
                {phone ? <button type="button" className="propertyInterestWhatsButton" onClick={() => openWhats(contact.id)}>Enviar Whats</button> : <span className="propertyInterestNoWhats">Sem WhatsApp</span>}
              </div>;
            }) : <div className="propertyInterestEmpty">Nenhum interessado vinculado a este imóvel ainda.</div>}
          </div>

          <div className="propertyInterestSendBar">
            <button type="button" className="secondary" disabled={!selectedMessageIds.size} onClick={() => startQueue(Array.from(selectedMessageIds))}>Enviar selecionados ({selectedMessageIds.size})</button>
            <button type="button" className="primary" disabled={!messageableIds.length} onClick={() => startQueue(messageableIds)}>Enviar para todos</button>
          </div>

          {queueIds.length ? <div className="propertyInterestQueue">
            <strong>{queueDone ? "Fila concluída" : `Envio em sequência: ${queueIndex} de ${queueIds.length} aberto(s)`}</strong>
            <small>O WhatsApp só permite abrir uma conversa por vez. Ao voltar para esta tela, abra o próximo interessado.</small>
            {!queueDone ? <button type="button" onClick={openNextQueue}>Abrir próximo WhatsApp</button> : null}
          </div> : null}
        </section>

        <section className="propertyInterestAddSection">
          <div className="propertyInterestSectionTitle"><div><strong>Adicionar interessados</strong><small>Preserva a função de vincular novos contatos ao imóvel.</small></div></div>
          <input className="propertyInterestSearch" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Buscar contato, telefone ou e-mail" />
          <div className="propertyInterestAddList">
            {availableContacts.length ? availableContacts.map((contact) => <label className="propertyInterestAddRow" key={contact.id}>
              <input type="checkbox" checked={newSelectedIds.has(contact.id)} onChange={() => toggleNew(contact.id)} />
              <span><strong>{contact.name}</strong><small>{[contact.phone, contact.email].filter(Boolean).join(" · ") || "Sem telefone/e-mail"}</small></span>
            </label>) : <div className="propertyInterestEmpty">Nenhum outro contato encontrado.</div>}
          </div>
          <button className="propertyInterestAddButton" type="button" disabled={!newSelectedIds.size || saving} onClick={() => void saveNewInterests()}>{saving ? "Salvando..." : `Adicionar interessados (${newSelectedIds.size})`}</button>
        </section>

        {notice ? <div className="propertyInterestNotice" role="status">{notice}</div> : null}
      </div>
    </section>
  </div>;
}
