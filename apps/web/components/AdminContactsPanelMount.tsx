"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AdminContacts from "./AdminContacts";

export default function AdminContactsPanelMount(){
  const[target,setTarget]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    if(!window.location.pathname.includes("/admin"))return;
    let disposed=false;let observer:MutationObserver|null=null;
    const attach=()=>{
      const content=document.querySelector<HTMLElement>(".adminPage .adminContent");
      if(!content)return false;
      let host=document.getElementById("admin-contacts-registry-mount");
      if(!host){host=document.createElement("div");host.id="admin-contacts-registry-mount";content.appendChild(host);}
      if(!disposed)setTarget(host);return true;
    };
    if(!attach()){observer=new MutationObserver(()=>{if(attach())observer?.disconnect();});observer.observe(document.body,{childList:true,subtree:true});}
    return()=>{disposed=true;observer?.disconnect();};
  },[]);
  return target?createPortal(<AdminContacts/>,target):null;
}
