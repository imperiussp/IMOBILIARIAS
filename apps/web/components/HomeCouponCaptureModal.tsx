"use client";

import { FormEvent, useEffect, useState } from "react";

const STORAGE_KEY = "lenoy-home-coupon-modal-seen-v1";
const CONTACT_EMAIL = "contato@lenoy.com.br";

export default function HomeCouponCaptureModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nome = String(data.get("nome") || "").trim();
    const email = String(data.get("email") || "").trim();
    const whatsapp = String(data.get("whatsapp") || "").trim();
    if (!nome || !email || !whatsapp) return;

    const subject = `Solicitação de cupom de desconto - ${nome}`;
    const body = [
      "Olá, equipe LENOY.",
      "",
      "Gostaria de receber um cupom de desconto para a plataforma imobiliária.",
      "",
      `Nome: ${nome}`,
      `E-mail: ${email}`,
      `WhatsApp: ${whatsapp}`,
      "",
      `Página de origem: ${window.location.href}`,
    ].join("\n");

    setOpen(false);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  if (!open) return null;

  return (
    <div className="lenoyCouponModal" role="dialog" aria-modal="true" aria-labelledby="lenoy-coupon-title">
      <style>{`
        .lenoyCouponModal{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center;padding:20px}
        .lenoyCouponModal__backdrop{position:absolute;inset:0;border:0;background:rgba(2,10,19,.80);backdrop-filter:blur(7px);cursor:pointer}
        .lenoyCouponModal__panel{position:relative;z-index:1;width:min(94vw,560px);max-height:92vh;overflow-y:auto;border:1px solid rgba(216,173,85,.30);border-radius:22px;background:#fff;box-shadow:0 28px 90px rgba(0,0,0,.44);padding:32px}
        .lenoyCouponModal__close{position:absolute;top:13px;right:13px;width:38px;height:38px;border:1px solid #dfe5ea;border-radius:999px;background:#f7f9fa;color:#102338;font-size:22px;line-height:1;cursor:pointer}
        .lenoyCouponModal__eyebrow{display:inline-block;margin-bottom:11px;color:#b1812e;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
        .lenoyCouponModal h2{margin:0;padding-right:42px;color:#07182d;font-size:31px;line-height:1.1;letter-spacing:-.02em}
        .lenoyCouponModal__intro{margin:12px 0 8px;color:#536575;font-size:15px;line-height:1.58}
        .lenoyCouponModal__promise{margin:0 0 24px;padding:12px 14px;border-radius:12px;background:#fff7e6;border:1px solid #ead19b;color:#6b4a10;font-size:13px;font-weight:800;line-height:1.5}
        .lenoyCouponModal form{display:grid;gap:15px}
        .lenoyCouponModal label{display:grid;gap:7px;color:#273b4e;font-size:12px;font-weight:800}
        .lenoyCouponModal input{width:100%;box-sizing:border-box;border:1px solid #d9e0e6;border-radius:11px;background:#fff;color:#102338;padding:12px 13px;font:inherit;font-size:14px;outline:none}
        .lenoyCouponModal input:focus{border-color:#c39642;box-shadow:0 0 0 3px rgba(195,150,66,.11)}
        .lenoyCouponModal__submit{min-height:50px;margin-top:3px;border:1px solid #d8ad55;border-radius:11px;background:#d8ad55;color:#07182d;font:inherit;font-size:14px;font-weight:900;cursor:pointer}
        .lenoyCouponModal__note{margin:11px 0 0;color:#7c8791;font-size:11px;line-height:1.5;text-align:center}
        @media(max-width:700px){.lenoyCouponModal{padding:12px}.lenoyCouponModal__panel{width:100%;border-radius:18px;padding:27px 19px 22px}.lenoyCouponModal h2{font-size:26px}}
      `}</style>

      <button type="button" className="lenoyCouponModal__backdrop" aria-label="Fechar" onClick={() => setOpen(false)} />
      <div className="lenoyCouponModal__panel">
        <button type="button" className="lenoyCouponModal__close" aria-label="Fechar" onClick={() => setOpen(false)}>×</button>
        <span className="lenoyCouponModal__eyebrow">Cupom de desconto</span>
        <h2 id="lenoy-coupon-title">Quer receber um cupom?</h2>
        <p className="lenoyCouponModal__intro">Preencha seus dados para solicitar uma condição especial para a plataforma LENOY Imobiliárias.</p>
        <p className="lenoyCouponModal__promise">Após recebermos sua solicitação, o cupom de desconto será enviado para o e-mail ou WhatsApp informado.</p>

        <form onSubmit={submit}>
          <label>Nome<input name="nome" type="text" required maxLength={160} autoComplete="name" /></label>
          <label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
          <label>WhatsApp<input name="whatsapp" type="tel" required maxLength={40} autoComplete="tel" inputMode="tel" placeholder="(13) 99999-9999" /></label>
          <button className="lenoyCouponModal__submit" type="submit">Quero receber meu cupom</button>
        </form>
        <p className="lenoyCouponModal__note">Este aviso é exibido apenas uma vez neste navegador. O envio do pedido utiliza o aplicativo de e-mail configurado no dispositivo.</p>
      </div>
    </div>
  );
}
