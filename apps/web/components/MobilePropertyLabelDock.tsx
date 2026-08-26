"use client";

import { useEffect, useState } from "react";
import PropertyMarketingLabels from "./PropertyMarketingLabels";

export default function MobilePropertyLabelDock(){
 const[visible,setVisible]=useState(false);
 useEffect(()=>{const sync=()=>setVisible(new URLSearchParams(window.location.search).get("view")==="imoveis");sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);},[]);
 if(!visible)return null;
 return <section className="mobileLabelDock"><details className="mobileCollapsedModule"><summary><strong>Etiquetas dos anúncios</strong><span>+</span></summary><div className="mobileCollapsedBody mobileModule"><PropertyMarketingLabels/></div></details></section>;
}
