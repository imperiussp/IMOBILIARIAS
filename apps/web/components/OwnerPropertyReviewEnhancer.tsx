"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type ViewerState = { urls: string[]; index: number; title: string } | null;

export default function OwnerPropertyReviewEnhancer() {
  const [viewer, setViewer] = useState<ViewerState>(null);

  useEffect(() => {
    if (!supabaseBrowser) return;
    const db = supabaseBrowser;
    let observer: MutationObserver | null = null;

    const enhance = () => {
      document.querySelectorAll<HTMLImageElement>(".ownerReviewPhotos img").forEach((img) => {
        if (img.dataset.viewerReady === "true") return;
        img.dataset.viewerReady = "true";
        img.tabIndex = 0;
        img.setAttribute("role", "button");
        img.setAttribute("title", "Abrir foto");
      });

      document.querySelectorAll<HTMLElement>(".ownerReviewCard.pending").forEach((card) => {
        const actions = card.querySelector<HTMLElement>(":scope > .ownerReviewActions");
        if (!actions || actions.querySelector("[data-delete-owner-submission]")) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ownerReviewDeleteButton";
        button.dataset.deleteOwnerSubmission = "true";
        button.textContent = "Excluir";
        actions.appendChild(button);
      });
    };

    const openImage = (img: HTMLImageElement) => {
      const card = img.closest<HTMLElement>(".ownerReviewCard");
      if (!card) return;
      const images = Array.from(card.querySelectorAll<HTMLImageElement>(".ownerReviewPhotos img"));
      const urls = images.map((item) => item.src).filter(Boolean);
      const index = Math.max(0, images.indexOf(img));
      const title = card.querySelector(".ownerReviewCardTop h3")?.textContent?.trim() || "Foto do imóvel";
      if (urls.length) setViewer({ urls, index, title });
    };

    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.matches(".ownerReviewPhotos img")) {
        openImage(target as HTMLImageElement);
        return;
      }
      const deleteButton = target.closest<HTMLButtonElement>("[data-delete-owner-submission]");
      if (!deleteButton) return;
      const card = deleteButton.closest<HTMLElement>(".ownerReviewCard.pending");
      const submissionId = card?.dataset.ownerSubmission || "";
      if (!card || !submissionId) return;
      const title = card.querySelector(".ownerReviewCardTop h3")?.textContent?.trim() || "este imóvel";
      if (!window.confirm(`Excluir “${title}” da área de avaliações?\n\nO contato do proprietário continuará salvo no CRM.`)) return;

      const original = deleteButton.textContent;
      deleteButton.disabled = true;
      deleteButton.textContent = "Excluindo...";
      const result = await db.functions.invoke("delete-owner-property-submission", { body: { submission_id: submissionId } });
      const data = result.data as { ok?: boolean; detail?: string; error?: string } | null;
      if (result.error || !data?.ok) {
        deleteButton.disabled = false;
        deleteButton.textContent = original || "Excluir";
        window.alert(data?.detail || result.error?.message || "Não foi possível excluir o imóvel da avaliação.");
        return;
      }

      card.remove();
      const count = document.querySelectorAll(".ownerReviewCard.pending").length;
      const badge = document.querySelector<HTMLElement>(".ownerReviewHeading > b");
      if (badge) badge.textContent = `${count} pendente${count === 1 ? "" : "s"}`;
      if (!document.querySelector(".ownerReviewCard")) window.location.reload();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches(".ownerReviewPhotos img") && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openImage(target as HTMLImageElement);
      }
      if (viewer && event.key === "Escape") setViewer(null);
    };

    enhance();
    observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      observer?.disconnect();
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [viewer]);

  if (!viewer || typeof document === "undefined") return null;
  const currentUrl = viewer.urls[viewer.index];
  const previous = () => setViewer((state) => state ? { ...state, index: (state.index - 1 + state.urls.length) % state.urls.length } : state);
  const next = () => setViewer((state) => state ? { ...state, index: (state.index + 1) % state.urls.length } : state);

  return createPortal(
    <div className="ownerPhotoViewer" role="dialog" aria-modal="true" aria-label={`Fotos de ${viewer.title}`} onClick={() => setViewer(null)}>
      <div className="ownerPhotoViewerInner" onClick={(event) => event.stopPropagation()}>
        <div className="ownerPhotoViewerTop"><div><strong>{viewer.title}</strong><small>{viewer.index + 1} de {viewer.urls.length}</small></div><button type="button" onClick={() => setViewer(null)} aria-label="Fechar fotos">×</button></div>
        <div className="ownerPhotoViewerStage">
          {viewer.urls.length > 1 ? <button className="previous" type="button" onClick={previous} aria-label="Foto anterior">‹</button> : null}
          <img src={currentUrl} alt={`${viewer.title} - foto ${viewer.index + 1}`} />
          {viewer.urls.length > 1 ? <button className="next" type="button" onClick={next} aria-label="Próxima foto">›</button> : null}
        </div>
        {viewer.urls.length > 1 ? <div className="ownerPhotoViewerThumbs">{viewer.urls.map((url, index) => <button key={`${url}-${index}`} type="button" className={index === viewer.index ? "active" : ""} onClick={() => setViewer({ ...viewer, index })}><img src={url} alt={`Miniatura ${index + 1}`} /></button>)}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
