"use client";

import { useEffect } from "react";

export default function AdminSidebarActiveTracker() {
  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>(".adminPage .adminSidebar");
    if (!sidebar) return;

    const links = Array.from(sidebar.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    const entries = links
      .map((link) => {
        const id = decodeURIComponent(link.hash.slice(1));
        return { link, id, section: id ? document.getElementById(id) : null };
      })
      .filter((entry): entry is { link: HTMLAnchorElement; id: string; section: HTMLElement } => Boolean(entry.section));

    if (!entries.length) return;

    let frame = 0;

    const setActive = (id: string) => {
      links.forEach((link) => {
        const active = decodeURIComponent(link.hash.slice(1)) === id;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };

    const syncFromScroll = () => {
      frame = 0;
      const marker = window.scrollY + Math.min(220, Math.max(110, window.innerHeight * 0.22));
      let current = entries[0];
      for (const entry of entries) {
        const top = entry.section.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) current = entry;
        else break;
      }
      setActive(current.id);
    };

    const queueSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncFromScroll);
    };

    const onHashChange = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && entries.some((entry) => entry.id === id)) setActive(id);
      else queueSync();
    };

    links.forEach((link) => {
      link.addEventListener("click", () => {
        const id = decodeURIComponent(link.hash.slice(1));
        if (id) setActive(id);
      });
    });

    window.addEventListener("scroll", queueSync, { passive: true });
    window.addEventListener("resize", queueSync, { passive: true });
    window.addEventListener("hashchange", onHashChange);
    onHashChange();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queueSync);
      window.removeEventListener("resize", queueSync);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return null;
}
