"use client";

import { useEffect } from "react";

export default function AdminSidebarActiveTracker() {
  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>(".adminSidebar");
    if (!sidebar) return;

    const links = Array.from(sidebar.querySelectorAll<HTMLAnchorElement>('a[href*="#"]'));
    if (!links.length) return;

    let frame = 0;
    let lockUntil = 0;

    const getId = (link: HTMLAnchorElement) => {
      const href = link.getAttribute("href") || "";
      const hashIndex = href.indexOf("#");
      return hashIndex >= 0 ? decodeURIComponent(href.slice(hashIndex + 1)) : "";
    };

    const setActive = (id: string) => {
      links.forEach((link) => {
        const active = Boolean(id) && getId(link) === id;
        link.classList.toggle("active", active);
        link.toggleAttribute("data-admin-current", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };

    const getEntries = () => links
      .map((link) => {
        const id = getId(link);
        return { link, id, section: id ? document.getElementById(id) : null };
      })
      .filter((entry): entry is { link: HTMLAnchorElement; id: string; section: HTMLElement } => Boolean(entry.section));

    const syncFromScroll = () => {
      frame = 0;
      if (Date.now() < lockUntil) return;

      const entries = getEntries();
      if (!entries.length) return;

      const marker = Math.min(220, Math.max(115, window.innerHeight * 0.23));
      let current = entries[0];
      let bestPassedTop = -Infinity;
      let nearestDistance = Infinity;

      for (const entry of entries) {
        const top = entry.section.getBoundingClientRect().top;
        if (top <= marker && top > bestPassedTop) {
          bestPassedTop = top;
          current = entry;
        }
        if (bestPassedTop === -Infinity) {
          const distance = Math.abs(top - marker);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            current = entry;
          }
        }
      }

      setActive(current.id);
    };

    const queueSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(syncFromScroll);
    };

    const applyHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && links.some((link) => getId(link) === id)) {
        lockUntil = Date.now() + 900;
        setActive(id);
        window.setTimeout(queueSync, 950);
      } else {
        queueSync();
      }
    };

    const clickHandlers = links.map((link) => {
      const handler = () => {
        const id = getId(link);
        if (!id) return;
        lockUntil = Date.now() + 900;
        setActive(id);
        window.setTimeout(queueSync, 950);
      };
      link.addEventListener("click", handler);
      return { link, handler };
    });

    const observer = new MutationObserver(() => queueSync());
    const content = document.querySelector(".adminContent");
    if (content) observer.observe(content, { childList: true, subtree: true });

    window.addEventListener("scroll", queueSync, { passive: true });
    window.addEventListener("resize", queueSync, { passive: true });
    window.addEventListener("hashchange", applyHash);

    applyHash();
    window.setTimeout(applyHash, 100);
    window.setTimeout(queueSync, 650);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      clickHandlers.forEach(({ link, handler }) => link.removeEventListener("click", handler));
      window.removeEventListener("scroll", queueSync);
      window.removeEventListener("resize", queueSync);
      window.removeEventListener("hashchange", applyHash);
    };
  }, []);

  return null;
}
