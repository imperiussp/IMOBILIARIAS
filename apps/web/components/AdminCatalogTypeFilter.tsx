"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type PropertyType = { id: string; name: string };
type PropertyRow = { code: string; property_type_id: string | null };

export default function AdminCatalogTypeFilter() {
  useEffect(() => {
    if (!window.location.pathname.includes("/admin") || !isSupabaseConfigured || !supabaseBrowser) return;

    let cancelled = false;
    let retryTimer: number | null = null;
    let selectedType = "";
    let codeToType = new Map<string, string | null>();
    let knownTypes: PropertyType[] = [];
    let installedFilters: HTMLElement | null = null;
    let installedSelect: HTMLSelectElement | null = null;
    let installedClear: HTMLButtonElement | null = null;

    const getRowCode = (row: HTMLTableRowElement) => {
      const explicit = row.querySelector<HTMLElement>(".adminPropertyCode")?.textContent?.trim();
      if (explicit && codeToType.has(explicit)) return explicit;
      const firstCellText = row.querySelector<HTMLTableCellElement>("td:first-child")?.textContent || "";
      for (const code of codeToType.keys()) {
        if (firstCellText.includes(code)) return code;
      }
      return "";
    };

    const applyTypeFilter = () => {
      if (cancelled) return;
      const rows = document.querySelectorAll<HTMLTableRowElement>(".adminPage #imoveis .adminTable tbody tr");
      rows.forEach((row) => {
        if (!selectedType) {
          row.style.removeProperty("display");
          return;
        }
        const code = getRowCode(row);
        if (!code) {
          row.style.removeProperty("display");
          return;
        }
        if (codeToType.get(code) === selectedType) row.style.removeProperty("display");
        else row.style.setProperty("display", "none", "important");
      });
    };

    const handleFiltersChange = () => {
      window.setTimeout(applyTypeFilter, 0);
      window.setTimeout(applyTypeFilter, 80);
    };

    const install = () => {
      if (cancelled || installedSelect) return true;
      const filters = document.querySelector<HTMLElement>(".adminPage #imoveis .adminFilters");
      if (!filters) return false;

      const select = document.createElement("select");
      select.className = "adminTypeFilterSelect";
      select.setAttribute("aria-label", "Filtrar por tipo de imóvel");
      select.innerHTML = '<option value="">Todos os tipos</option>';
      knownTypes.forEach((type) => {
        const option = document.createElement("option");
        option.value = type.id;
        option.textContent = type.name;
        select.appendChild(option);
      });

      const publicationSelect = filters.querySelector<HTMLSelectElement>("select:nth-of-type(3)");
      if (publicationSelect) filters.insertBefore(select, publicationSelect);
      else filters.appendChild(select);

      select.addEventListener("change", () => {
        selectedType = select.value;
        applyTypeFilter();
      });

      const clearButton = Array.from(filters.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim().toLowerCase() === "limpar",
      ) || null;

      clearButton?.addEventListener("click", () => {
        selectedType = "";
        select.value = "";
        handleFiltersChange();
      });

      filters.addEventListener("input", handleFiltersChange);
      filters.addEventListener("change", handleFiltersChange);

      installedFilters = filters;
      installedSelect = select;
      installedClear = clearButton;
      applyTypeFilter();
      return true;
    };

    void (async () => {
      try {
        const agency = await getCurrentAgency();
        if (!agency || cancelled || !supabaseBrowser) return;

        const [typeResult, propertyResult] = await Promise.all([
          supabaseBrowser.from("property_types").select("id,name").eq("active", true).order("name"),
          supabaseBrowser.from("properties").select("code,property_type_id").eq("agency_id", agency.agencyId),
        ]);
        if (cancelled) return;

        knownTypes = (typeResult.data || []) as PropertyType[];
        codeToType = new Map(((propertyResult.data || []) as PropertyRow[]).map((item) => [item.code, item.property_type_id]));

        let attempts = 0;
        const tryInstall = () => {
          attempts += 1;
          if (install() || attempts >= 40 || cancelled) return;
          retryTimer = window.setTimeout(tryInstall, 250);
        };
        tryInstall();
      } catch {
        // Falha no filtro complementar não bloqueia o painel.
      }
    })();

    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      installedFilters?.removeEventListener("input", handleFiltersChange);
      installedFilters?.removeEventListener("change", handleFiltersChange);
      installedSelect?.remove();
      installedClear = null;
    };
  }, []);

  return null;
}
