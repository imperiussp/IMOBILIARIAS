"use client";

import { useEffect, useState } from "react";
import RegisterForm from "./RegisterForm";

export default function RegistrationEntryGate(){
  const [mode,setMode]=useState<"loading"|"special"|"public">("loading");
  useEffect(()=>{const params=new URLSearchParams(window.location.search);const redirect=params.get("redirect")||"";const bootstrap=params.get("bootstrap")||"";setMode(redirect.startsWith("/convite/")||Boolean(bootstrap)?"special":"public")},[]);
  if(mode==="loading")return <div className="loginCard"><span className="eyebrow">CONTRATAÇÃO LENOY</span><h1>Preparando...</h1></div>;
  if(mode==="special")return <RegisterForm/>;
  return <div className="loginCard registrationChoicePrompt"><span className="eyebrow">PAGAMENTO ANTES DO CADASTRO</span><h1>Primeiro escolha e pague o plano.</h1><p>A criação da imobiliária acontece somente depois que a InfinitePay confirmar o pagamento. Você receberá por e-mail o link seguro para informar nome, endereço do site e senha.</p><div className="registrationChoiceActions"><a className="button secondary full" href="/demonstracao/">Ver demonstração</a><a className="button primary full" href="/planos/">Ver planos e contratar</a></div><a className="backLink" href="/login/">← Já tenho acesso</a></div>;
}
