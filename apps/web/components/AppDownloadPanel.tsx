"use client";

import { useEffect, useState } from "react";

type Platform = "android" | "ios" | "other";

function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="appPlatformIcon">
      <path fill="currentColor" d="M7.2 7.1 5.7 4.5a.6.6 0 0 1 1-.6l1.6 2.7a9.8 9.8 0 0 1 7.4 0l1.6-2.7a.6.6 0 1 1 1 .6l-1.5 2.6A6.4 6.4 0 0 1 20 12H4a6.4 6.4 0 0 1 3.2-4.9ZM8 9.8a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Zm8 0A.9.9 0 1 0 16 8a.9.9 0 0 0 0 1.8ZM4 13h16v6.2A1.8 1.8 0 0 1 18.2 21H17v2a1 1 0 0 1-2 0v-2H9v2a1 1 0 0 1-2 0v-2H5.8A1.8 1.8 0 0 1 4 19.2V13Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="appPlatformIcon">
      <path fill="currentColor" d="M16.7 12.9c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.6-2c-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8a4.9 4.9 0 0 0-4.1 2.5c-1.8 3-.5 7.5 1.2 10 .9 1.2 1.9 2.5 3.2 2.4 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.2 3.1-2.4 1-1.4 1.4-2.9 1.4-3-.1 0-3-.9-3-3.9ZM14.2 5.6A4.3 4.3 0 0 0 15.3 2a4.5 4.5 0 0 0-3 1.5 4.1 4.1 0 0 0-1.1 3.5 3.7 3.7 0 0 0 3-1.4Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="appInlineIcon">
      <path d="M12 16V3m0 0L8 7m4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppDownloadPanel() {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    setPlatform(isIOS ? "ios" : isAndroid ? "android" : "other");
  }, []);

  return (
    <main className="appDownloadPage">
      <section className="appDownloadShell">
        <a href="/admin/" className="appBackLink">← Voltar ao painel</a>

        <div className="appDownloadBrand">
          <img src="https://lenoy.com.br/wp-content/uploads/2026/08/hh.png" alt="LENOY IMOBILIÁRIAS" />
          <span>APP DO CORRETOR</span>
        </div>

        <header className="appDownloadHero">
          <span className="appDownloadEyebrow">LENOY IMOBILIÁRIAS</span>
          <h1>Leve sua imobiliária no celular</h1>
          <p>Cadastre imóveis, fotografe, trabalhe mesmo sem internet e sincronize os dados quando a conexão voltar.</p>
        </header>

        {platform === "android" && (
          <div className="appDetectedBadge"><AndroidIcon /> Detectamos um aparelho Android</div>
        )}
        {platform === "ios" && (
          <div className="appDetectedBadge"><AppleIcon /> Detectamos um iPhone ou iPad</div>
        )}

        <div className="appPlatformGrid">
          <article className={`appPlatformCard ${platform === "android" ? "isRecommended" : ""}`}>
            <div className="appPlatformHeading">
              <div className="appPlatformSymbol android"><AndroidIcon /></div>
              <div><span>ANDROID</span><h2>Instalar aplicativo</h2></div>
            </div>
            <p>Baixe o aplicativo LENOY Imobiliárias diretamente no seu Android.</p>
            <a className="appDownloadButton" href="/app-imobiliaria.apk">
              <AndroidIcon /> Baixar app para Android
            </a>
            <div className="appInstructionBox">
              <strong>Como instalar</strong>
              <ol>
                <li>Toque em <b>Baixar app para Android</b>.</li>
                <li>Abra o arquivo <b>app-imobiliaria.apk</b> quando o download terminar.</li>
                <li>Se o Android solicitar, permita a instalação deste arquivo e conclua.</li>
              </ol>
            </div>
          </article>

          <article className={`appPlatformCard ${platform === "ios" ? "isRecommended" : ""}`}>
            <div className="appPlatformHeading">
              <div className="appPlatformSymbol apple"><AppleIcon /></div>
              <div><span>IPHONE / IPAD</span><h2>Adicionar à Tela de Início</h2></div>
            </div>
            <p>Enquanto a versão nativa para iPhone está em preparação, use o acesso rápido pela Tela de Início.</p>
            <div className="appIosNotice">No iPhone, abra esta página pelo <b>Safari</b>.</div>
            <div className="appInstructionBox appIosSteps">
              <strong>Como colocar na Tela de Início</strong>
              <ol>
                <li>Abra <b>imoveis.lenoy.com.br</b> no Safari.</li>
                <li>Toque no botão <b>Compartilhar</b> <ShareIcon />.</li>
                <li>Role as opções e toque em <b>Adicionar à Tela de Início</b>.</li>
                <li>Confirme em <b>Adicionar</b>.</li>
              </ol>
            </div>
            <a className="appSecondaryButton" href="/admin/">Abrir painel LENOY</a>
          </article>
        </div>

        <div className="appDownloadFootnote">
          <strong>Android:</strong> aplicativo instalável disponível. <strong>iPhone:</strong> acesso pela Tela de Início enquanto finalizamos a distribuição da versão iOS.
        </div>
      </section>
    </main>
  );
}
