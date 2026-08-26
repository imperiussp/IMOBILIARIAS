"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type PropertyType = { id: string; name: string };
type PropertyRow = { code: string; property_type_id: string | null };

export default function AdminCatalogTypeFilter() {
  useEffect(() => {
    if (!window.location.pathname.includes("/admin") || !isSupabaseConfigured || !supabaseBrowser) return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let selectedType = "";
    let propertiesByCode = new Map<string, string | null>();
    let types: PropertyType[] = [];

    const rowCode = (row: HTMLTableRowElement) => {
      const decorated = row.querySelector<HTMLElement>(".adminPropertyCode")?.textContent?.trim();
      if (decorated) return decorated;
      return row.querySelector<HTMLTableCellElement>("td:first-child")?.textContent?.trim().split(/\s+/).pop() || "";
    };

    const apply = () => {
      if (disposed) return;
      const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>(".adminPage #imoveis .adminTable tbody tr"));
      let visible = 0;
      rows.forEach((row) => {
        const code = rowCode(row);
        const matches = !selectedType || propertiesByCode.get(code) === selectedType;
        if (matches) {
          row.style.removeProperty("display");
          visible += 1;
        } else {
          row.style.setProperty("display", "none", "important");
        }
      });
      const count = document.querySelector<HTMLElement>(".adminPage #imoveis .adminPanelTools span");
      if (count && selectedType && !count.textContent?.includes("Carregando")) count.textContent = `${visible} exibido(s)`;
    };

    const installSelect = () => {
      const filters = document.querySelector<HTMLElement>(".adminPage #imoveis .adminFilters");
      if (!filters || filters.querySelector(".adminTypeFilterSelect")) return;

      const select = document.createElement("select");
      select.className = "adminTypeFilterSelect";
      select.setAttribute("aria-label", "Filtrar por tipo de imóvel");
      const all = document.createElement("option");
      all.value = "";
      all.textContent = "Todos os tipos";
      select.appendChild(all);
      types.forEach((type) => {
        const option = document.createElement("option");
        option.value = type.id;
        option.textContent = type.name;
        select.appendChild(option);
      });
      const publicationSelect = filters.querySelector("select:nth-of-type(3)");
      if (publicationSelect) filters.insertBefore(select, publicationSelect);
      else filters.appendChild(select);

      select.addEventListener("change", () => {
        selectedType = select.value;
        apply();
      });

      const clearButton = Array.from(filters.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim().toLowerCase() === "limpar");
      clearButton?.addEventListener("click", () => {
        selectedType = "";
        select.value = "";
        window.requestAnimationFrame(apply);
      });
    };

    void (async () => {
      try {
        const agency = await getCurrentAgency();
        if (!agency || disposed || !supabaseBrowser) return;
        const [typeResult, propertyResult] = await Promise.all([
          supabaseBrowser.from("property_types").select("id,name").eq("active", true).order("name"),
          supabaseBrowser.from("properties").select("code,property_type_id").eq("agency_id", agency.agencyId),
        ]);
        if (disposed) return;
        types = (typeResult.data || []) as PropertyType[];
        propertiesByCode = new Map(((propertyResult.data || []) as PropertyRow[]).map((item) => [item.code, item.property_type_id]));
        installSelect();
        apply();
        observer = new MutationObserver(() => {
          installSelect();
          apply();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      } catch {
        // O filtro complementar não deve interferir no restante do painel em caso de falha.
      }
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
