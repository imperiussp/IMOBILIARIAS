"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { getPropertyPhotoUrls } from "../lib/propertyPhotos";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type PropertyRow = { id: string; code: string };
type PhotoRow = { property_id: string; storage_path: string; thumbnail_path: string | null; position: number; is_cover: boolean };
type GalleryItem = { url: string; isCover: boolean; position: number };

export default function AdminCatalogPhotosMount() {
  useEffect(() => {
    const pathname = window.location.pathname;
    const isAdmin = pathname.includes("/admin");
    const isAppProperties = pathname.includes("/app") && new URLSearchParams(window.location.search).get("view") === "imoveis";
    if (!isAdmin && !isAppProperties) return;
    const client = supabaseBrowser;
    if (!client) return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let timer = 0;
    const galleries = new Map<string, GalleryItem[]>();

    function render() {
      if (disposed) return;
      document.querySelectorAll<HTMLTableRowElement>(".adminTable tbody tr").forEach((row) => {
        const cells = row.querySelectorAll<HTMLTableCellElement>("td");
        if (cells.length < 2) return;
        const code = (cells[0].textContent || "").trim();
        const photos = galleries.get(code);
        if (!photos?.length) return;

        const target = cells[1];
        const current = target.querySelector<HTMLElement>("[data-admin-catalog-gallery]");
        if (current?.dataset.photoSignature === photos.map((photo) => photo.url).join("|")) return;
        current?.remove();

        const wrapper = document.createElement("div");
        wrapper.className = "adminCatalogPhotoGallery";
        wrapper.dataset.adminCatalogGallery = code;
        wrapper.dataset.photoSignature = photos.map((photo) => photo.url).join("|");

        const strip = document.createElement("div");
        strip.className = "adminCatalogPhotoStrip";
        for (const [index, photo] of photos.entries()) {
          const image = document.createElement("img");
          image.src = photo.url;
          image.alt = `Foto ${index + 1} do imóvel ${code}`;
          image.loading = "lazy";
          if (photo.isCover) image.dataset.cover = "true";
          strip.appendChild(image);
        }

        const count = document.createElement("small");
        count.className = "adminCatalogPhotoCount";
        count.textContent = `${photos.length} foto${photos.length === 1 ? "" : "s"}`;
        wrapper.append(strip, count);
        target.prepend(wrapper);
      });
    }

    async function load() {
      const agency = await getCurrentAgency();
      if (!agency || disposed) return;

      const propertyResult = await client
        .from("properties")
        .select("id,code")
        .eq("agency_id", agency.agencyId)
        .order("created_at", { ascending: false });
      if (propertyResult.error || disposed) return;

      const properties = (propertyResult.data || []) as PropertyRow[];
      const ids = properties.map((property) => property.id);
      if (!ids.length) return;

      const photoResult = await client
        .from("property_photos")
        .select("property_id,storage_path,thumbnail_path,position,is_cover")
        .in("property_id", ids)
        .order("position", { ascending: true });
      if (photoResult.error || disposed) return;

      const rows = (photoResult.data || []) as PhotoRow[];
      const paths = rows.map((photo) => photo.thumbnail_path || photo.storage_path);
      const urls = await getPropertyPhotoUrls(paths, 3600);
      if (disposed) return;

      const codeById = new Map(properties.map((property) => [property.id, property.code]));
      galleries.clear();
      rows.forEach((photo, index) => {
        const code = codeById.get(photo.property_id);
        const url = urls[index];
        if (!code || !url) return;
        const list = galleries.get(code) || [];
        list.push({ url, isCover: Boolean(photo.is_cover), position: photo.position });
        galleries.set(code, list);
      });
      galleries.forEach((items) => items.sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.position - b.position));
      render();
    }

    void load();
    observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(render, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer?.disconnect();
      window.clearTimeout(timer);
      document.querySelectorAll("[data-admin-catalog-gallery]").forEach((node) => node.remove());
    };
  }, []);

  return null;
}
