"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type TenantBrand = {
  name: string;
  slug: string;
  logoUrl: string | null;
};

export default function AdminTenantBrand() {
  const [brand, setBrand] = useState<TenantBrand | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const agency = await getCurrentAgency();
      if (!agency || !active) return;

      let logoUrl: string | null = null;
      if (isSupabaseConfigured && supabaseBrowser) {
        const { data } = await supabaseBrowser
          .from("agencies")
          .select("logo_url")
          .eq("id", agency.agencyId)
          .maybeSingle();
        logoUrl = data?.logo_url || null;
      }

      if (!active) return;
      setBrand({ name: agency.agencyName, slug: agency.agencySlug, logoUrl });
    })();

    return () => { active = false; };
  }, []);

  if (!brand) return <div className="adminTenantBrand adminTenantBrandLoading" aria-hidden="true" />;

  const publicUrl = `https://${brand.slug}.imoveis.lenoy.com.br`;

  return (
    <div className="adminTenantBrandWrap">
      <a className="adminTenantBrand" href={publicUrl} target="_blank" rel="noreferrer" aria-label={`Abrir site da ${brand.name}`}>
        {brand.logoUrl
          ? <img src={brand.logoUrl} alt={brand.name} />
          : <strong>{brand.name}</strong>}
      </a>
      <a className="adminTenantSiteLink" href={publicUrl} target="_blank" rel="noreferrer">Abrir site</a>
    </div>
  );
}
