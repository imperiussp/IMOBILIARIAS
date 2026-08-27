"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { getPropertyPhotoUrls } from "../lib/propertyPhotos";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type PropertyRow = { id: string; code: string };
type PhotoRow = { property_id: string; storage_path: string; thumbnail_path: string | null; position: number; is_cover: boolean };
type GalleryItem = { url: string; fullUrl: string; isCover: boolean; position: number };

export default function AdminCatalogPhotosMount() {
  useEffect(() => {
    const pathname = window.location.pathname;
    const isAdmin = pathname.includes("/admin");
    const isAppProperties = pathname.includes("/app") && new URLSearchParams(window.location.search).get("view") === "imoveis";
    if (!isAdmin && !isAppProperties) return;
    if (!supabaseBrowser) return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let timer = 0;
    let viewer: HTMLElement | null = null;
    let viewerCode = "";
    let viewerIndex = 0;
    let swipeStartX: number | null = null;
    const galleries = new Map<string, GalleryItem[]>();

    const currentPhotos = () => galleries.get(viewerCode) || [];

    function closeViewer() {
      if (document.fullscreenElement === viewer && document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
      viewer?.remove();
      viewer = null;
      viewerCode = "";
      viewerIndex = 0;
      swipeStartX = null;
      document.documentElement.classList.remove("adminCatalogViewerOpen");
    }

    function updateViewer() {
      if (!viewer) return;
      const photos = currentPhotos();
      if (!photos.length) return closeViewer();
      viewerIndex = (viewerIndex + photos.length) % photos.length;
      const photo = photos[viewerIndex];
      const main = viewer.querySelector<HTMLImageElement>(".adminCatalogPhotoViewerImage");
      const counter = viewer.querySelector<HTMLElement>(".adminCatalogPhotoViewerCounter");
      if (main) {
        main.src = photo.fullUrl || photo.url;
        main.alt = `Foto ${viewerIndex + 1} do imóvel ${viewerCode}`;
      }
      if (counter) counter.textContent = `${viewerIndex + 1} de ${photos.length}`;
      viewer.querySelectorAll<HTMLButtonElement>(".adminCatalogPhotoViewerThumbs button").forEach((button, index) => {
        button.classList.toggle("active", index === viewerIndex);
        if (index === viewerIndex) button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      });
    }

    function moveViewer(step: number) {
      const photos = currentPhotos();
      if (photos.length < 2) return;
      viewerIndex = (viewerIndex + step + photos.length) % photos.length;
      updateViewer();
    }

    async function toggleFullscreen() {
      if (!viewer) return;
      if (document.fullscreenElement === viewer) {
        if (document.exitFullscreen) await document.exitFullscreen().catch(() => undefined);
        return;
      }
      if (viewer.classList.contains("isFullscreenFallback")) {
        viewer.classList.remove("isFullscreenFallback");
        return;
      }
      try {
        if (viewer.requestFullscreen) {
          await viewer.requestFullscreen();
          return;
        }
      } catch {
        // Em navegadores móveis que não liberam Fullscreen API para DIV, usa o mesmo layout em viewport total.
      }
      viewer.classList.add("isFullscreenFallback");
    }

    function openViewer(code: string, index: number) {
      const photos = galleries.get(code);
      if (!photos?.length) return;
      closeViewer();
      viewerCode = code;
      viewerIndex = Math.max(0, Math.min(index, photos.length - 1));

      const root = document.createElement("div");
      root.className = "adminCatalogPhotoViewer";
      root.dataset.adminCatalogPhotoViewer = "true";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", `Fotos do imóvel ${code}`);

      const inner = document.createElement("div");
      inner.className = "adminCatalogPhotoViewerInner";

      const top = document.createElement("div");
      top.className = "adminCatalogPhotoViewerTop";
      const title = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = `Imóvel ${code}`;
      const counter = document.createElement("small");
      counter.className = "adminCatalogPhotoViewerCounter";
      title.append(strong, counter);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "adminCatalogPhotoViewerClose";
      close.setAttribute("aria-label", "Fechar galeria");
      close.textContent = "×";
      close.addEventListener("click", (event) => { event.stopPropagation(); closeViewer(); });
      top.append(title, close);

      const stage = document.createElement("div");
      stage.className = "adminCatalogPhotoViewerStage";
      const previous = document.createElement("button");
      previous.type = "button";
      previous.className = "adminCatalogPhotoViewerNav previous";
      previous.setAttribute("aria-label", "Foto anterior");
      previous.textContent = "‹";
      previous.addEventListener("click", (event) => { event.stopPropagation(); moveViewer(-1); });
      const main = document.createElement("img");
      main.className = "adminCatalogPhotoViewerImage";
      main.draggable = false;
      main.addEventListener("click", (event) => { event.stopPropagation(); void toggleFullscreen(); });
      const next = document.createElement("button");
      next.type = "button";
      next.className = "adminCatalogPhotoViewerNav next";
      next.setAttribute("aria-label", "Próxima foto");
      next.textContent = "›";
      next.addEventListener("click", (event) => { event.stopPropagation(); moveViewer(1); });
      if (photos.length < 2) { previous.hidden = true; next.hidden = true; }
      stage.append(previous, main, next);

      stage.addEventListener("pointerdown", (event) => { swipeStartX = event.clientX; });
      stage.addEventListener("pointerup", (event) => {
        if (swipeStartX === null) return;
        const delta = event.clientX - swipeStartX;
        swipeStartX = null;
        if (Math.abs(delta) < 42) return;
        moveViewer(delta < 0 ? 1 : -1);
      });
      stage.addEventListener("pointercancel", () => { swipeStartX = null; });

      const thumbs = document.createElement("div");
      thumbs.className = "adminCatalogPhotoViewerThumbs";
      photos.forEach((photo, photoIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `Abrir foto ${photoIndex + 1}`);
        const thumb = document.createElement("img");
        thumb.src = photo.url;
        thumb.alt = "";
        thumb.loading = "lazy";
        button.appendChild(thumb);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          viewerIndex = photoIndex;
          updateViewer();
        });
        thumbs.appendChild(button);
      });

      inner.append(top, stage, thumbs);
      root.appendChild(inner);
      root.addEventListener("click", (event) => { if (event.target === root) closeViewer(); });
      document.body.appendChild(root);
      viewer = root;
      document.documentElement.classList.add("adminCatalogViewerOpen");
      updateViewer();
    }

    function render() {
      if (disposed) return;
      document.querySelectorAll<HTMLTableRowElement>(".adminTable tbody tr").forEach((row) => {
        const cells = row.querySelectorAll<HTMLTableCellElement>("td");
        if (cells.length < 2) return;
        const code = (
          cells[0].querySelector<HTMLElement>(".adminPropertyCode")?.textContent ||
          cells[0].querySelector("strong")?.textContent ||
          cells[0].textContent ||
          ""
        ).trim();
        const photos = galleries.get(code);
        if (!photos?.length) return;

        const isMobilePerformance = window.matchMedia("(max-width: 900px)").matches && Boolean(row.closest("#desempenho-imoveis"));
        const target = isMobilePerformance ? cells[0] : cells[1];
        const rowGallery = row.querySelector<HTMLElement>("[data-admin-catalog-gallery]");
        if (rowGallery && rowGallery.parentElement !== target) rowGallery.remove();
        const current = target.querySelector<HTMLElement>("[data-admin-catalog-gallery]");
        const signature = photos.map((photo) => `${photo.url}|${photo.fullUrl}`).join("|");
        if (current?.dataset.photoSignature === signature) return;
        current?.remove();

        const wrapper = document.createElement("div");
        wrapper.className = "adminCatalogPhotoGallery";
        wrapper.dataset.adminCatalogGallery = code;
        wrapper.dataset.photoSignature = signature;

        const strip = document.createElement("div");
        strip.className = "adminCatalogPhotoStrip";
        for (const [index, photo] of photos.entries()) {
          const image = document.createElement("img");
          image.src = photo.url;
          image.alt = `Foto ${index + 1} do imóvel ${code}`;
          image.loading = "lazy";
          image.tabIndex = 0;
          image.dataset.galleryReady = "true";
          if (photo.isCover) image.dataset.cover = "true";
          const open = () => openViewer(code, index);
          image.addEventListener("click", open);
          image.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
          });
          strip.appendChild(image);
        }

        const count = document.createElement("small");
        count.className = "adminCatalogPhotoCount";
        count.textContent = `${photos.length} foto${photos.length === 1 ? "" : "s"} · toque para ampliar`;
        wrapper.append(strip, count);
        target.prepend(wrapper);
      });
    }

    async function load() {
      const client = supabaseBrowser;
      if (!client) return;
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
      const thumbnailPaths = rows.map((photo) => photo.thumbnail_path || photo.storage_path);
      const originalPaths = rows.map((photo) => photo.storage_path);
      const [urls, fullUrls] = await Promise.all([
        getPropertyPhotoUrls(thumbnailPaths, 3600),
        getPropertyPhotoUrls(originalPaths, 3600),
      ]);
      if (disposed) return;

      const codeById = new Map(properties.map((property) => [property.id, property.code]));
      galleries.clear();
      rows.forEach((photo, index) => {
        const code = codeById.get(photo.property_id);
        const url = urls[index] || fullUrls[index];
        const fullUrl = fullUrls[index] || url;
        if (!code || !url || !fullUrl) return;
        const list = galleries.get(code) || [];
        list.push({ url, fullUrl, isCover: Boolean(photo.is_cover), position: photo.position });
        galleries.set(code, list);
      });
      galleries.forEach((items) => items.sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.position - b.position));
      render();
    }

    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(render, 80);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!viewer) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); moveViewer(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); moveViewer(1); }
      if (event.key === "Escape" && viewer.classList.contains("isFullscreenFallback")) {
        event.preventDefault(); viewer.classList.remove("isFullscreenFallback");
      } else if (event.key === "Escape" && !document.fullscreenElement) {
        closeViewer();
      }
    };

    void load();
    observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(render, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      closeViewer();
      document.querySelectorAll("[data-admin-catalog-gallery]").forEach((node) => node.remove());
    };
  }, []);

  return null;
}
