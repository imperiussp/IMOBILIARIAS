"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { getPropertyPhotoUrl } from "../lib/propertyPhotos";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type PropertySummary = { id: string; code: string; title: string };
type City = { id: string; name: string; state_code: string };
type Neighborhood = { id: string; city_id: string; name: string };
type PhotoRow = { property_id: string; storage_path: string; thumbnail_path: string | null; position: number; is_cover: boolean };
type IbgeCity = { nome?: string };

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function AdminUiEnhancer() {
  useEffect(() => {
    if (!supabaseBrowser) return;

    let disposed = false;
    let started = false;
    let bootObserver: MutationObserver | null = null;
    let decorationObserver: MutationObserver | null = null;
    let queued = false;

    async function boot() {
      if (disposed || started || !document.querySelector(".adminPage") || !supabaseBrowser) return;
      started = true;
      bootObserver?.disconnect();

      const agency = await getCurrentAgency();
      if (!agency || disposed || !supabaseBrowser) return;
      const agencyId = agency.agencyId;

      const [propertyResult, cityResult, neighborhoodResult] = await Promise.all([
        supabaseBrowser.from("properties").select("id,code,title").eq("agency_id", agencyId).order("created_at", { ascending: false }),
        supabaseBrowser.from("cities").select("id,name,state_code").order("state_code").order("name"),
        supabaseBrowser.from("neighborhoods").select("id,city_id,name").or(`agency_id.is.null,agency_id.eq.${agencyId}`).order("name"),
      ]);
      if (disposed) return;

      const properties = (propertyResult.data || []) as PropertySummary[];
      const cities = (cityResult.data || []) as City[];
      const neighborhoods = (neighborhoodResult.data || []) as Neighborhood[];
      const propertyIds = properties.map((item) => item.id);
      const photoMap = new Map<string, string>();

      if (propertyIds.length) {
        const photoResult = await supabaseBrowser.from("property_photos")
          .select("property_id,storage_path,thumbnail_path,position,is_cover")
          .in("property_id", propertyIds)
          .order("is_cover", { ascending: false })
          .order("position", { ascending: true });
        const chosen = new Map<string, PhotoRow>();
        ((photoResult.data || []) as PhotoRow[]).forEach((row) => { if (!chosen.has(row.property_id)) chosen.set(row.property_id, row); });
        await Promise.all(Array.from(chosen.entries()).map(async ([propertyId, row]) => {
          const url = await getPropertyPhotoUrl(row.thumbnail_path || row.storage_path, 3600);
          if (url) photoMap.set(propertyId, url);
        }));
      }

      const byId = new Map(properties.map((item) => [item.id, item]));
      const findPropertyInText = (text: string) => {
        const raw = text.toLocaleLowerCase("pt-BR");
        return properties.find((item) => raw.includes(item.code.toLocaleLowerCase("pt-BR")));
      };

      function makeThumb(property: PropertySummary) {
        const img = document.createElement("img");
        const url = photoMap.get(property.id);
        img.src = url || "https://lenoy.com.br/wp-content/uploads/2026/08/hh.png";
        img.alt = property.title;
        img.className = `adminPropertyThumb${url ? "" : " adminPropertyThumbFallback"}`;
        img.loading = "lazy";
        return img;
      }

      function decorateTables() {
        document.querySelectorAll<HTMLTableRowElement>(".adminPage .adminTable tbody tr").forEach((row) => {
          const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));
          if (!cells.length) return;
          const property = findPropertyInText(row.textContent || "");
          if (!property) return;
          const identityCell = cells.find((cell) => (cell.textContent || "").toLocaleLowerCase("pt-BR").includes(property.code.toLocaleLowerCase("pt-BR"))) || cells[0];
          if (!identityCell.dataset.propertyDecorated) {
            identityCell.dataset.propertyDecorated = "1";
            identityCell.classList.add("adminPropertyCell");
            identityCell.prepend(makeThumb(property));
            const strong = identityCell.querySelector("strong");
            if (strong && (strong.textContent || "").includes(property.code)) {
              strong.textContent = property.title;
              const code = document.createElement("small");
              code.className = "adminPropertyCode";
              code.textContent = property.code;
              strong.insertAdjacentElement("afterend", code);
            }
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
          identity.prepend(makeThumb(property));
          const strong = identity.querySelector("strong");
          if (strong && (strong.textContent || "").includes(property.code)) {
            strong.textContent = property.title;
            const code = document.createElement("small");
            code.className = "adminPropertyCode";
            code.textContent = property.code;
            strong.insertAdjacentElement("afterend", code);
          }
        });
      }

      function updateSelectedIdentity(select: HTMLSelectElement, identity: HTMLElement) {
        const property = byId.get(select.value);
        identity.replaceChildren();
        if (!property) { identity.hidden = true; return; }
        identity.hidden = false;
        identity.appendChild(makeThumb(property));
        const copy = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = property.title;
        const small = document.createElement("small");
        small.textContent = property.code;
        copy.append(strong, small);
        identity.appendChild(copy);
      }

      function decoratePropertySelects() {
        document.querySelectorAll<HTMLSelectElement>(".adminPage select").forEach((select) => {
          const propertyOptions = Array.from(select.options).filter((option) => byId.has(option.value));
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

      function clearDefaultZeros() {
        ["bedrooms", "suites", "bathrooms", "parking_spaces"].forEach((name) => {
          document.querySelectorAll<HTMLInputElement>(`.adminPage #novo-imovel input[name="${name}"]`).forEach((input) => {
            if (input.dataset.blankDefaultApplied) return;
            input.dataset.blankDefaultApplied = "1";
            if (input.value === "0") input.value = "";
            input.defaultValue = "";
          });
        });
      }

      function setupNeighborhoodSuggestions(cityId: string) {
        const input = document.querySelector<HTMLInputElement>('.adminPage #novo-imovel input[name="neighborhood"]');
        if (!input) return;
        let list = document.querySelector<HTMLDataListElement>("#admin-neighborhood-suggestions");
        if (!list) {
          list = document.createElement("datalist");
          list.id = "admin-neighborhood-suggestions";
          input.insertAdjacentElement("afterend", list);
        }
        input.setAttribute("list", list.id);
        list.replaceChildren();
        neighborhoods.filter((item) => item.city_id === cityId).forEach((item) => {
          const option = document.createElement("option"); option.value = item.name; list!.appendChild(option);
        });
      }

      function setupCityAutocomplete() {
        const select = document.querySelector<HTMLSelectElement>('.adminPage #novo-imovel select[name="city_id"]');
        if (!select || select.dataset.cityAutocompleteReady) return;
        select.dataset.cityAutocompleteReady = "1";
        select.classList.add("adminCityNativeSelect");
        select.required = false;

        const control = document.createElement("div");
        control.className = "adminCityAutocomplete adminCityAutocompleteOfficial";
        const uf = document.createElement("select");
        uf.className = "adminCityUfSelect";
        uf.setAttribute("aria-label", "Estado");
        uf.innerHTML = '<option value="">UF</option>' + UFS.map((item) => `<option value="${item}">${item}</option>`).join("");
        const input = document.createElement("input");
        input.type = "text"; input.placeholder = "Digite a cidade"; input.autocomplete = "off"; input.setAttribute("aria-label", "Cidade");
        const list = document.createElement("datalist"); list.id = "admin-city-suggestions-official"; input.setAttribute("list", list.id);
        control.append(uf, input, list);
        select.insertAdjacentElement("afterend", control);

        const render = (names: string[]) => {
          list.replaceChildren();
          Array.from(new Set(names)).sort((a,b)=>a.localeCompare(b,"pt-BR")).forEach((name) => {
            const option = document.createElement("option"); option.value = name; list.appendChild(option);
          });
        };

        async function loadOfficialCities(stateCode: string) {
          const local = cities.filter((city) => city.state_code === stateCode).map((city) => city.name);
          render(local);
          if (!stateCode) return;
          try {
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios?orderBy=nome`);
            if (!response.ok) return;
            const data = await response.json() as IbgeCity[];
            render([...local, ...data.map((item) => String(item.nome || "")).filter(Boolean)]);
          } catch { /* mantém cidades locais */ }
        }

        const selected = cities.find((city) => city.id === select.value);
        if (selected) { uf.value = selected.state_code; input.value = selected.name; void loadOfficialCities(selected.state_code); setupNeighborhoodSuggestions(selected.id); }

        const sync = () => {
          const stateCode = uf.value;
          const typed = input.value.trim();
          const exact = cities.find((city) => city.state_code === stateCode && city.name.toLocaleLowerCase("pt-BR") === typed.toLocaleLowerCase("pt-BR"));
          select.value = exact?.id || "";
          if (exact) setupNeighborhoodSuggestions(exact.id);
          select.dispatchEvent(new Event("change", { bubbles: true }));
        };
        uf.addEventListener("change", () => { input.value = ""; select.value = ""; void loadOfficialCities(uf.value); });
        input.addEventListener("input", sync);
        input.addEventListener("change", sync);

        const form = select.closest("form");
        if (!form || form.dataset.cityInterceptorInstalled) return;
        form.dataset.cityInterceptorInstalled = "1";
        form.addEventListener("submit", async (event) => {
          if (form.dataset.citySubmitReady === "1") { delete form.dataset.citySubmitReady; return; }
          sync();
          if (select.value) return;
          const cityName = input.value.trim();
          const stateCode = uf.value;
          if (!cityName || stateCode.length !== 2) {
            event.preventDefault(); event.stopImmediatePropagation();
            input.setCustomValidity("Selecione a UF e informe a cidade."); input.reportValidity(); input.setCustomValidity("");
            return;
          }
          event.preventDefault(); event.stopImmediatePropagation();
          const { data, error } = await supabaseBrowser!.rpc("agency_upsert_city", { p_agency_id: agencyId, p_name: cityName, p_state_code: stateCode });
          if (error) { input.setCustomValidity(error.message); input.reportValidity(); input.setCustomValidity(""); return; }
          const city = Array.isArray(data) ? data[0] as City | undefined : undefined;
          if (!city) return;
          if (!cities.some((item) => item.id === city.id)) cities.push(city);
          let option = Array.from(select.options).find((item) => item.value === city.id);
          if (!option) { option = document.createElement("option"); option.value = city.id; option.textContent = `${city.name} - ${city.state_code}`; select.appendChild(option); }
          select.value = city.id; setupNeighborhoodSuggestions(city.id); select.dispatchEvent(new Event("change", { bubbles: true }));
          form.dataset.citySubmitReady = "1";
          form.requestSubmit();
        }, true);
      }

      function decorate() {
        if (disposed) return;
        decorateTables(); decoratePropertyCards(); decoratePropertySelects(); clearDefaultZeros(); setupCityAutocomplete();
      }

      decorate();
      decorationObserver = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        window.requestAnimationFrame(() => { queued = false; decorate(); });
      });
      decorationObserver.observe(document.body, { childList: true, subtree: true });
    }

    void boot();
    bootObserver = new MutationObserver(() => { void boot(); });
    bootObserver.observe(document.body, { childList: true, subtree: true });

    return () => { disposed = true; bootObserver?.disconnect(); decorationObserver?.disconnect(); };
  }, []);

  return null;
}
