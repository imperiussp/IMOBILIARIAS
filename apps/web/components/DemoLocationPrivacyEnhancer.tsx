"use client";

import { useEffect } from "react";

export default function DemoLocationPrivacyEnhancer() {
  useEffect(() => {
    if (!window.location.pathname.startsWith("/demonstracao/")) return;
    let shareLocation = false;

    const enhanceForms = () => {
      document.querySelectorAll<HTMLFormElement>(".demoReplicaForm").forEach((form) => {
        if (form.querySelector(".demoLocationPrivacyChoice")) return;
        const anchor = form.querySelector(".demoReplicaFakeUpload") || form.querySelector("button[type='submit']");
        if (!anchor) return;
        const box = document.createElement("div");
        box.className = "demoLocationPrivacyChoice";
        box.innerHTML = `
          <div class="demoLocationPrivacyHead">
            <strong>Localização no anúncio</strong>
            <small>O corretor decide se o cliente poderá ver o mapa e o endereço exato.</small>
          </div>
          <label class="demoLocationPrivacyOption">
            <input type="radio" name="demo_location_privacy" value="private" checked>
            <span><b>Não compartilhar localização</b><small>Mostra somente bairro, cidade e UF. Sem mapa e sem endereço exato.</small></span>
          </label>
          <label class="demoLocationPrivacyOption">
            <input type="radio" name="demo_location_privacy" value="public">
            <span><b>Exibir localização</b><small>Publica o mapa e o endereço informado no anúncio.</small></span>
          </label>`;
        anchor.parentElement?.insertBefore(box, anchor);
        box.querySelectorAll<HTMLInputElement>("input[name='demo_location_privacy']").forEach((input) => {
          input.addEventListener("change", () => { shareLocation = input.value === "public" && input.checked; });
        });
      });
    };

    const enhancePreview = () => {
      document.querySelectorAll<HTMLElement>(".demoReplicaPreviewModal .demoReplicaPreviewCard>div").forEach((content) => {
        let status = content.querySelector<HTMLElement>(".demoLocationPreviewStatus");
        if (!status) {
          status = document.createElement("div");
          status.className = "demoLocationPreviewStatus";
          content.appendChild(status);
        }
        status.innerHTML = shareLocation
          ? `<strong>📍 Localização pública</strong><small>Na versão real, o anúncio exibirá mapa e endereço exato.</small><div class="demoLocationFakeMap"><span>Mapa do imóvel</span><small>Prévia demonstrativa</small></div>`
          : `<strong>🔒 Localização não compartilhada</strong><small>O cliente verá somente bairro, cidade e UF. O mapa ficará oculto.</small>`;
      });
    };

    const sync = () => { enhanceForms(); enhancePreview(); };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <style>{`
    .demoLocationPrivacyChoice{display:grid;gap:9px;margin:16px 0;padding:15px;border:1px solid #d8e2e9;border-radius:14px;background:#f8fafb}.demoLocationPrivacyHead{display:grid;gap:3px}.demoLocationPrivacyHead strong{font-size:13px;color:#10283f}.demoLocationPrivacyHead small{font-size:11px;line-height:1.4;color:#697a88}.demoLocationPrivacyOption{display:flex!important;align-items:flex-start!important;gap:9px!important;padding:11px!important;border:1px solid #dce5eb!important;border-radius:12px!important;background:#fff!important;cursor:pointer!important}.demoLocationPrivacyOption input{flex:0 0 auto!important;width:17px!important;height:17px!important;margin:1px 0 0!important}.demoLocationPrivacyOption span{display:grid;gap:2px;min-width:0}.demoLocationPrivacyOption b{font-size:12px;color:#173047}.demoLocationPrivacyOption small{font-size:10px;line-height:1.4;color:#6c7d89}.demoLocationPreviewStatus{display:grid!important;gap:4px!important;margin-top:10px!important;padding:11px!important;border-radius:11px!important;background:#f2f5f7!important;border:1px solid #dce4e9!important}.demoLocationPreviewStatus strong{font-size:12px!important}.demoLocationPreviewStatus small{font-size:10px!important;line-height:1.4!important;color:#657682!important}.demoLocationFakeMap{display:grid!important;place-items:center!important;gap:2px!important;min-height:105px!important;margin-top:7px!important;border-radius:10px!important;background:linear-gradient(135deg,#dfe8de,#e8edf2)!important;border:1px solid #ced9d0!important;color:#294c36!important}.demoLocationFakeMap span{background:transparent!important;padding:0!important;font-size:12px!important;font-weight:900!important}.demoLocationFakeMap small{font-size:9px!important}
  `}</style>;
}
