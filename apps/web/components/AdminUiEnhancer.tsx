"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { getPropertyPhotoUrl } from "../lib/propertyPhotos";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type PropertySummary = { id: string; code: string; title: string };
type City = { id: string; name: string; state_code: string };
type PhotoRow = { property_id: string; storage_path: string; thumbnail_path: string | null; position: number; is_cover: boolean };

export default function AdminUiEnhancer() {
  useEffect(() => {
    if (!supabaseBrowser || !document.querySelector(".adminPage")) return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let queued = false;

    void (async () => {
      const agency = await getCurrentAgency();
      if (!agency || disposed || !supabaseBrowser) return;
      const agencyId = agency.agencyId;

      const [propertyResult, cityResult] = await Promise.all([
        supabaseBrowser.from("properties").select("id,code,title").eq("agency_id", agencyId).order("created_at", { ascending: false }),
        supabaseBrowser.from("cities").select("id,name,state_code").order("name"),
      ]);
      if (disposed) return;

      const properties = (propertyResult.data || []) as PropertySummary[];
      const cities = (cityResult.data || []) as City[];
      const propertyIds = properties.map((item) => item.id);
      const photoMap = new Map<string, string>();

      if (propertyIds.length) {
        const photoResult = await supabaseBrowser
          .from("property_photos")
          .select("property_id,storage_path,thumbnail_path,position,is_cover")
          .in("property_id", propertyIds)
          .order("is_cover", { ascending: false })
          .order("position", { ascending: true });
        const rows = (photoResult.data || []) as PhotoRow[];
        const chosen = new Map<string, PhotoRow>();
        rows.forEach((row) => { if (!chosen.has(row.property_id)) chosen.set(row.property_id, row); });
        await Promise.all(Array.from(chosen.entries()).map(async ([propertyId, row]) => {
          const url = await getPropertyPhotoUrl(row.thumbnail_path || row.storage_path, 3600);
          if (url) photoMap.set(propertyId, url);
        }));
      }

      const byId = new Map(properties.map((item) => [item.id, item]));

      function findPropertyInText(text: string) {
        const raw = text.toLowerCase();
        return properties.find((item) => raw.includes(item.code.toLowerCase()));
      }

      function makeThumb(property: PropertySummary) {
        const url = photoMap.get(property.id);
        if (!url) return null;
        const img = document.createElement("img");
        img.src = url;
        img.alt = property.title;
        img.className = "adminPropertyThumb";
        img.loading = "lazy";
        return img;
      }

      function decorateTables() {
        document.querySelectorAll<HTMLTableRowElement>(".adminPage .adminTable tbody tr").forEach((row) => {
          const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));
          if (!cells.length) return;
          const property = findPropertyInText(row.textContent || "");
          if (!property) return;
          const identityCell = cells.find((cell) => (cell.textContent || "").toLowerCase().includes(property.code.toLowerCase())) || cells[0];
          if (!identityCell.dataset.propertyDecorated) {
            identityCell.dataset.propertyDecorated = "1";
            identityCell.classList.add("adminPropertyCell");
            const thumb = makeThumb(property);
            if (thumb) identityCell.prepend(thumb);
          }
          if (row.closest("#imoveis")) {
            const actions = cells[cells.length - 1];
            actions.classList.add("adminPropertyActionsCell");
            actions.querySelectorAll<HTMLElement>("div,nav").forEach((node) => node.classList.add("adminPropertyActionsRow"));
          }
        });
      }

      function decoratePropertyCards() {
        document.querySelectorAll<HTMLElement>(".adminPage .accessRow").forEach((row) => {
          if (row.dataset.propertyDecorated) return;
          const property = findPropertyInText(row.textContent || "");
          if (!property) return;
          const identity = row.querySelector<HTMLElement>(".accessIdentity");
          if (!identity) return;
          row.dataset.propertyDecorated = "1";
          identity.classList.add("adminPropertyCardIdentity");
          const thumb = makeThumb(property);
          if (thumb) identity.prepend(thumb);
          const strong = identity.querySelector("strong");
          if (strong && (strong.textContent || "").toLowerCase().includes(property.code.toLowerCase())) {
            strong.textContent = property.title;
            let code = identity.querySelector<HTMLElement>(".adminPropertyCode");
            if (!code) {
              code = document.createElement("small");
              code.className = "adminPropertyCode";
              strong.insertAdjacentElement("afterend", code);
            }
            code.textContent = property.code;
          }
        });
      }

      function decoratePropertySelects() {
        document.querySelectorAll<HTMLSelectElement>(".adminPage select").forEach((select) => {
          const options = Array.from(select.options);
          const propertyOptions = options.filter((option) => byId.has(option.value));
          if (!propertyOptions.length) return;

          propertyOptions.forEach((option) => {
            const property = byId.get(option.value);
            if (property) option.textContent = property.title;
          });

          const parent = select.parentElement;
          if (!parent) return;
          let identity = parent.querySelector<HTMLElement>(":scope > .adminSelectedPropertyIdentity");
          if (!identity) {
            identity = document.createElement("div");
            identity.className = "adminSelectedPropertyIdentity";
            select.insertAdjacentElement("afterend", identity);
            select.addEventListener("change", () => updateSelectedIdentity(select, identity!));
          }
          updateSelectedIdentity(select, identity);
        });
      }

      function updateSelectedIdentity(select: HTMLSelectElement, identity: HTMLElement) {
        const property = byId.get(select.value);
        identity.replaceChildren();
        if (!property) {
          identity.hidden = true;
          return;
        }
        identity.hidden = false;
        const thumb = makeThumb(property);
        if (thumb) identity.appendChild(thumb);
        const copy = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = property.title;
        const small = document.createElement("small");
        small.textContent = property.code;
        copy.append(strong, small);
        identity.appendChild(copy);
      }

      function clearDefaultZeros() {
        ["bedrooms", "suites", "bathrooms", "parking_spaces"].forEach((name) => {
          document.querySelectorAll<HTMLInputElement>(`.adminPage #novo-imovel input[name="${name}"]`).forEach((input) => {
            if (input.dataset.blankDefaultApplied) return;
            input.dataset.blankDefaultApplied = "1";
            if (input.value === "0") input.value = "";
          });
        });
      }

      function setupCityAutocomplete() {
        const select = document.querySelector<HTMLSelectElement>('.adminPage #novo-imovel select[name="city_id"]');
        if (!select || select.dataset.cityAutocompleteReady) return;
        select.dataset.cityAutocompleteReady = "1";
        select.classList.add("adminCityNativeSelect");
        select.required = false;

        const control = document.createElement("div");
        control.className = "adminCityAutocomplete";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Digite a cidade";
        input.autocomplete = "off";
        input.setAttribute("list", "admin-city-suggestions");
        input.setAttribute("aria-label", "Cidade");
        const uf = document.createElement("input");
        uf.type = "text";
        uf.placeholder = "UF";
        uf.maxLength = 2;
        uf.className = "adminCityUf";
        uf.setAttribute("aria-label", "UF");
        const list = document.createElement("datalist");
        list.id = "admin-city-suggestions";

        const renderCities = () => {
          list.replaceChildren();
          cities.forEach((city) => {
            const option = document.createElement("option");
            option.value = `${city.name} - ${city.state_code}`;
            list.appendChild(option);
          });
        };
        renderCities();
        control.append(input, uf, list);
        select.insertAdjacentElement("afterend", control);

        const selected = cities.find((city) => city.id === select.value);
        if (selected) {
          input.value = `${selected.name} - ${selected.state_code}`;
          uf.value = selected.state_code;
        }

        const syncSelection = () => {
          const typed = input.value.trim();
          const exact = cities.find((city) =>
            `${city.name} - ${city.state_code}`.toLocaleLowerCase("pt-BR") === typed.toLocaleLowerCase("pt-BR") ||
            city.name.toLocaleLowerCase("pt-BR") === typed.toLocaleLowerCase("pt-BR")
          );
          if (exact) {
            select.value = exact.id;
            uf.value = exact.state_code;
          } else {
            select.value = "";
          }
          select.dispatchEvent(new Event("change", { bubbles: true }));
        };
        input.addEventListener("input", syncSelection);
        input.addEventListener("change", syncSelection);
        uf.addEventListener("input", () => { uf.value = uf.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2); });

        const form = select.closest("form");
        if (!form || form.dataset.cityInterceptorInstalled) return;
        form.dataset.cityInterceptorInstalled = "1";
        form.addEventListener("submit", async (event) => {
          if (form.dataset.citySubmitReady === "1") {
            delete form.dataset.citySubmitReady;
            return;
          }
          syncSelection();
          if (select.value) return;
          const typed = input.value.trim();
          if (!typed) {
            event.preventDefault();
            event.stopImmediatePropagation();
            input.setCustomValidity("Informe a cidade.");
            input.reportValidity();
            input.setCustomValidity("");
            return;
          }

          event.preventDefault();
          event.stopImmediatePropagation();
          const parsed = typed.match(/^(.*?)(?:\s+-\s+([A-Za-z]{2}))?$/);
          const cityName = (parsed?.[1] || typed).trim();
          const stateCode = (parsed?.[2] || uf.value).trim().toUpperCase();
          if (stateCode.length !== 2) {
            uf.setCustomValidity("Informe a UF com 2 letras para cadastrar uma cidade nova.");
            uf.reportValidity();
            uf.setCustomValidity("");
            return;
          }

          const { data, error } = await supabaseBrowser!.rpc("agency_upsert_city", {
            p_agency_id: agencyId,
            p_name: cityName,
            p_state_code: stateCode,
          });
          if (error) {
            input.setCustomValidity(error.message);
            input.reportValidity();
            input.setCustomValidity("");
            return;
          }
          const city = Array.isArray(data) ? data[0] as City | undefined : undefined;
          if (!city) return;
          if (!cities.some((item) => item.id === city.id)) cities.push(city);
          renderCities();
          let option = Array.from(select.options).find((item) => item.value === city.id);
          if (!option) {
            option = document.createElement("option");
            option.value = city.id;
            option.textContent = `${city.name} - ${city.state_code}`;
            select.appendChild(option);
          }
          select.value = city.id;
          input.value = `${city.name} - ${city.state_code}`;
          uf.value = city.state_code;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          form.dataset.citySubmitReady = "1";
          form.requestSubmit();
        }, true);
      }

      function decorate() {
        if (disposed) return;
        decorateTables();
        decoratePropertyCards();
        decoratePropertySelects();
        clearDefaultZeros();
        setupCityAutocomplete();
      }

      decorate();
      observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        window.requestAnimationFrame(() => {
          queued = false;
          decorate();
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
