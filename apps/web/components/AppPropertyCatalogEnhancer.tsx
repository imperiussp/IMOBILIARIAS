"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentAgency, type CurrentAgency } from "../lib/currentAgency";
import { getPropertyPhotoUrl } from "../lib/propertyPhotos";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type AppProperty = {
  id: string;
  code: string;
  title: string;
  publication_state: "draft" | "published" | null;
  status: "available" | "reserved" | "rented" | "sold" | "inactive";
};

type PhotoRow = {
  property_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  position: number;
  is_cover: boolean;
};

type OwnerRow = {
  published_property_id: string | null;
  owner_name: string | null;
  phone: string | null;
};

type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  contact_type: string;
  status: string;
};

type InterestRow = {
  contact_id: string;
  property_id: string | null;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function whatsappNumber(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 10 ? digits : "";
}

function makePublicPropertyUrl(agencySlug: string, propertyId: string) {
  if (!agencySlug || !propertyId) return "";
  return `https://${agencySlug}.imoveis.lenoy.com.br/imovel/?id=${encodeURIComponent(propertyId)}`;
}

export default function AppPropertyCatalogEnhancer() {
  const [agency, setAgency] = useState<CurrentAgency | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [pickerProperty, setPickerProperty] = useState<AppProperty | null>(null);
  const [existingInterestIds, setExistingInterestIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState("");
  const [savingInterests, setSavingInterests] = useState(false);
  const [pickerMessage, setPickerMessage] = useState("");
  const [toast, setToast] = useState("");

  const propertyByCodeRef = useRef(new Map<string, AppProperty>());
  const photoByPropertyRef = useRef(new Map<string, string>());
  const ownerByPropertyRef = useRef(new Map<string, OwnerRow>());
  const interestsByPropertyRef = useRef(new Map<string, Set<string>>());
  const agencyRef = useRef<CurrentAgency | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!supabaseBrowser) return;
    if (!window.location.pathname.includes("/app")) return;
    const view = new URLSearchParams(window.location.search).get("view");
    if (view !== "imoveis") return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let queued = false;

    function openInterestedPicker(property: AppProperty) {
      const existing = interestsByPropertyRef.current.get(property.id) || new Set<string>();
      setExistingInterestIds(new Set(existing));
      setSelectedIds(new Set());
      setContactSearch("");
      setPickerMessage("");
      setPickerProperty(property);
    }

    async function shareProperty(property: AppProperty) {
      const currentAgency = agencyRef.current;
      if (!currentAgency) return;
      const url = makePublicPropertyUrl(currentAgency.agencySlug, property.id);
      if (!url || property.publication_state !== "published" || property.status === "inactive") {
        setToast("Publique o imóvel para compartilhar o anúncio.");
        return;
      }
      const text = `${property.title} (${property.code})`;
      try {
        if (navigator.share) {
          await navigator.share({ title: property.title, text, url });
          return;
        }
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          setToast("Link do imóvel copiado.");
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
      window.prompt("Copie o link do imóvel:", url);
    }

    function buildHero(property: AppProperty) {
      const hero = document.createElement("div");
      hero.className = "appPropertyHero";

      const media = document.createElement("div");
      media.className = "appPropertyHeroMedia";
      const photoUrl = photoByPropertyRef.current.get(property.id) || "";
      if (photoUrl) {
        const img = document.createElement("img");
        img.src = photoUrl;
        img.alt = property.title;
        img.loading = "lazy";
        media.appendChild(img);
      } else {
        const empty = document.createElement("span");
        empty.className = "appPropertyNoPhoto";
        empty.textContent = "Sem foto";
        media.appendChild(empty);
      }

      const copy = document.createElement("div");
      copy.className = "appPropertyHeroCopy";
      const title = document.createElement("strong");
      title.className = "appPropertyTitle";
      title.textContent = property.title;
      const code = document.createElement("small");
      code.className = "appPropertyCode";
      code.textContent = property.code;
      copy.append(title, code);
      if (property.publication_state === "draft") {
        const draft = document.createElement("span");
        draft.className = "appPropertyDraftBadge";
        draft.textContent = "Rascunho";
        copy.appendChild(draft);
      }

      hero.append(media, copy);
      return hero;
    }

    function createQuickActions(property: AppProperty) {
      const wrapper = document.createElement("div");
      wrapper.className = "appPropertyQuickActions";

      const owner = ownerByPropertyRef.current.get(property.id);
      const phone = whatsappNumber(owner?.phone);
      if (phone) {
        const whatsapp = document.createElement("a");
        whatsapp.className = "appPropertyQuickButton appPropertyWhatsApp";
        const currentAgency = agencyRef.current;
        const greeting = owner?.owner_name ? `Olá, ${owner.owner_name}. ` : "Olá. ";
        const message = `${greeting}Aqui é da ${currentAgency?.agencyName || "imobiliária"}. Estou entrando em contato sobre o imóvel ${property.title} (${property.code}).`;
        whatsapp.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        whatsapp.target = "_blank";
        whatsapp.rel = "noreferrer";
        whatsapp.textContent = "WhatsApp";
        wrapper.appendChild(whatsapp);
      } else {
        const whatsapp = document.createElement("button");
        whatsapp.type = "button";
        whatsapp.className = "appPropertyQuickButton appPropertyWhatsApp";
        whatsapp.disabled = true;
        whatsapp.title = "Este imóvel não possui telefone de proprietário vinculado.";
        whatsapp.textContent = "Sem WhatsApp";
        wrapper.appendChild(whatsapp);
      }

      const share = document.createElement("button");
      share.type = "button";
      share.className = "appPropertyQuickButton";
      share.textContent = "Compartilhar";
      share.addEventListener("click", () => void shareProperty(property));
      wrapper.appendChild(share);

      const interested = document.createElement("button");
      interested.type = "button";
      interested.className = "appPropertyQuickButton";
      const count = interestsByPropertyRef.current.get(property.id)?.size || 0;
      interested.textContent = count ? `Interessados (${count})` : "Interessados";
      interested.addEventListener("click", () => openInterestedPicker(property));
      wrapper.appendChild(interested);

      return wrapper;
    }

    function enhanceRows() {
      if (disposed) return;
      document.querySelectorAll<HTMLTableRowElement>(".mobileAppV2 .livePropertiesOnly #imoveis .adminTable tbody tr").forEach((row) => {
        if (row.dataset.appPropertyEnhanced === "1") return;
        const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>(":scope > td"));
        if (cells.length < 7) return;
        const rawCode = cells[0]?.querySelector("strong")?.textContent || cells[0]?.textContent || "";
        const property = propertyByCodeRef.current.get(normalize(rawCode));
        if (!property) return;

        row.dataset.appPropertyEnhanced = "1";
        row.dataset.propertyId = property.id;
        row.classList.add("appPropertyCardRow");

        cells[0].classList.add("appPropertyIdentityCell");
        cells[1].classList.add("appPropertyLegacyTitleCell");
        cells[2].classList.add("appPropertyLocationCell");
        cells[3].classList.add("appPropertyPurposeCell");
        cells[4].classList.add("appPropertyValueCell");
        cells[5].classList.add("appPropertyStatusCell");
        cells[6].classList.add("appPropertyActionsCell");
        cells[0].prepend(buildHero(property));

        const existingActions = cells[6].querySelector<HTMLElement>(".tableActions");
        if (existingActions) existingActions.classList.add("appPropertyExistingActions");
        cells[6].appendChild(createQuickActions(property));
      });
    }

    function scheduleEnhance() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        enhanceRows();
      });
    }

    void (async () => {
      const currentAgency = await getCurrentAgency();
      if (!currentAgency || disposed || !supabaseBrowser) return;
      agencyRef.current = currentAgency;
      setAgency(currentAgency);

      const propertyResult = await supabaseBrowser
        .from("properties")
        .select("id,code,title,publication_state,status")
        .eq("agency_id", currentAgency.agencyId)
        .order("created_at", { ascending: false });
      if (disposed || propertyResult.error) return;

      const properties = (propertyResult.data || []) as AppProperty[];
      const propertyIds = properties.map((property) => property.id);
      propertyByCodeRef.current = new Map(properties.map((property) => [normalize(property.code), property]));

      const [photoResult, ownerResult, contactResult, interestResult] = await Promise.all([
        propertyIds.length
          ? supabaseBrowser.from("property_photos").select("property_id,storage_path,thumbnail_path,position,is_cover").in("property_id", propertyIds).order("is_cover", { ascending: false }).order("position", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        propertyIds.length
          ? supabaseBrowser.from("owner_property_submissions").select("published_property_id,owner_name,phone,published_at").eq("agency_id", currentAgency.agencyId).in("published_property_id", propertyIds).order("published_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabaseBrowser.from("agency_contacts").select("id,name,phone,email,contact_type,status,last_interaction_at").eq("agency_id", currentAgency.agencyId).order("last_interaction_at", { ascending: false }).limit(500),
        propertyIds.length
          ? supabaseBrowser.from("contact_interactions").select("contact_id,property_id").eq("agency_id", currentAgency.agencyId).in("interaction_type", ["property_interest_manual", "property_interest"]).in("property_id", propertyIds).limit(5000)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (disposed) return;

      const chosenPhotos = new Map<string, PhotoRow>();
      ((photoResult.data || []) as PhotoRow[]).forEach((row) => {
        if (!chosenPhotos.has(row.property_id)) chosenPhotos.set(row.property_id, row);
      });
      const signedEntries = await Promise.all(Array.from(chosenPhotos.entries()).map(async ([propertyId, row]) => {
        const url = await getPropertyPhotoUrl(row.thumbnail_path || row.storage_path, 3600);
        return [propertyId, url] as const;
      }));
      if (disposed) return;
      photoByPropertyRef.current = new Map(signedEntries.filter(([, url]) => Boolean(url)));

      const owners = new Map<string, OwnerRow>();
      ((ownerResult.data || []) as OwnerRow[]).forEach((row) => {
        if (row.published_property_id && !owners.has(row.published_property_id)) owners.set(row.published_property_id, row);
      });
      ownerByPropertyRef.current = owners;

      setContacts(((contactResult.data || []) as ContactRow[]).filter((contact) => Boolean(contact.name)));

      const interestMap = new Map<string, Set<string>>();
      ((interestResult.data || []) as InterestRow[]).forEach((row) => {
        if (!row.property_id) return;
        const set = interestMap.get(row.property_id) || new Set<string>();
        set.add(row.contact_id);
        interestMap.set(row.property_id, set);
      });
      interestsByPropertyRef.current = interestMap;

      enhanceRows();
      observer = new MutationObserver(scheduleEnhance);
      observer.observe(document.body, { childList: true, subtree: true });
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  const visibleContacts = useMemo(() => {
    const term = normalize(contactSearch);
    if (!term) return contacts;
    return contacts.filter((contact) => normalize([contact.name, contact.phone || "", contact.email || ""].join(" ")).includes(term));
  }, [contacts, contactSearch]);

  function toggleContact(contactId: string) {
    if (existingInterestIds.has(contactId)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  function toggleAllVisible() {
    const selectable = visibleContacts.filter((contact) => !existingInterestIds.has(contact.id)).map((contact) => contact.id);
    const allSelected = selectable.length > 0 && selectable.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      selectable.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  async function saveInterests() {
    if (!supabaseBrowser || !agency || !pickerProperty || !selectedIds.size) return;
    setSavingInterests(true);
    setPickerMessage("");
    const freshIds = Array.from(selectedIds).filter((id) => !existingInterestIds.has(id));
    if (!freshIds.length) {
      setSavingInterests(false);
      return;
    }

    const now = new Date().toISOString();
    const rows = freshIds.map((contactId) => ({
      agency_id: agency.agencyId,
      contact_id: contactId,
      property_id: pickerProperty.id,
      interaction_type: "property_interest_manual",
      source: "app",
      title: "Marcado como interessado",
      message: `${pickerProperty.title} (${pickerProperty.code})`,
      external_key: `app-property-interest:${pickerProperty.id}:${contactId}`,
      occurred_at: now,
    }));
    const { error } = await supabaseBrowser.from("contact_interactions").insert(rows);
    if (error) {
      setPickerMessage(error.message);
      setSavingInterests(false);
      return;
    }

    const nextExisting = new Set(existingInterestIds);
    freshIds.forEach((id) => nextExisting.add(id));
    setExistingInterestIds(nextExisting);
    setSelectedIds(new Set());
    interestsByPropertyRef.current.set(pickerProperty.id, new Set(nextExisting));
    setPickerMessage(`${freshIds.length} contato(s) adicionado(s) como interessado(s).`);
    setSavingInterests(false);

    document.querySelectorAll<HTMLTableRowElement>(`.mobileAppV2 .livePropertiesOnly #imoveis tr[data-property-id="${pickerProperty.id}"]`).forEach((row) => {
      const button = Array.from(row.querySelectorAll<HTMLButtonElement>(".appPropertyQuickActions button")).find((item) => item.textContent?.startsWith("Interessados"));
      if (button) button.textContent = `Interessados (${nextExisting.size})`;
    });
  }

  if (!pickerProperty && !toast) return null;

  return <>
    {toast ? <div className="appPropertyToast" role="status">{toast}</div> : null}
    {pickerProperty ? <div className="appInterestedLayer" role="dialog" aria-modal="true" aria-label={`Interessados em ${pickerProperty.title}`}>
      <button className="appInterestedBackdrop" type="button" aria-label="Fechar" onClick={() => setPickerProperty(null)} />
      <section className="appInterestedDialog">
        <header className="appInterestedHead">
          <div><small>INTERESSADOS</small><strong>{pickerProperty.title}</strong><span>{pickerProperty.code}</span></div>
          <button type="button" aria-label="Fechar" onClick={() => setPickerProperty(null)}>×</button>
        </header>
        <div className="appInterestedTools">
          <input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Buscar contato, telefone ou e-mail" />
          <button type="button" onClick={toggleAllVisible}>Selecionar todos</button>
        </div>
        {pickerMessage ? <div className="appInterestedMessage">{pickerMessage}</div> : null}
        <div className="appInterestedList">
          {visibleContacts.length ? visibleContacts.map((contact) => {
            const already = existingInterestIds.has(contact.id);
            const checked = already || selectedIds.has(contact.id);
            return <label key={contact.id} className={`appInterestedContact${already ? " already" : ""}`}>
              <input type="checkbox" checked={checked} disabled={already} onChange={() => toggleContact(contact.id)} />
              <span><strong>{contact.name}</strong><small>{[contact.phone, contact.email].filter(Boolean).join(" · ") || "Sem telefone/e-mail"}</small></span>
              {already ? <em>Já interessado</em> : null}
            </label>;
          }) : <div className="appInterestedEmpty">Nenhum contato encontrado.</div>}
        </div>
        <footer className="appInterestedFooter">
          <button type="button" className="secondary" onClick={() => setPickerProperty(null)}>Fechar</button>
          <button type="button" className="primary" disabled={!selectedIds.size || savingInterests} onClick={() => void saveInterests()}>{savingInterests ? "Salvando..." : `Adicionar interessados (${selectedIds.size})`}</button>
        </footer>
      </section>
    </div> : null}
  </>;
}