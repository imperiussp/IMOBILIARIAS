"use client";

import { useEffect, useState } from "react";
import { getAvailableAgencies, getCurrentAgency, setPreferredAgencyId, type CurrentAgency } from "../lib/currentAgency";

const roleLabel: Record<CurrentAgency["role"], string> = {
  owner: "Proprietário",
  admin: "Administrador",
  broker: "Corretor",
  staff: "Equipe",
};

export default function AdminAgencySwitcher() {
  const [agencies, setAgencies] = useState<CurrentAgency[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const [available, current] = await Promise.all([getAvailableAgencies(), getCurrentAgency()]);
      if (!active) return;
      setAgencies(available);
      setSelectedId(current?.agencyId || "");
    })();
    return () => { active = false; };
  }, []);

  if (!selectedId || !agencies.length) return null;
  const selected = agencies.find((agency) => agency.agencyId === selectedId) || agencies[0];

  if (agencies.length === 1) {
    return <div className="agencyContext"><small>Imobiliária</small><strong>{selected.agencyName}</strong><span>{roleLabel[selected.role]}</span></div>;
  }

  return <label className="agencySwitcher">
    <span>Imobiliária ativa</span>
    <select value={selectedId} onChange={(event) => {
      setPreferredAgencyId(event.target.value);
      setSelectedId(event.target.value);
      window.location.reload();
    }}>
      {agencies.map((agency) => <option key={agency.agencyId} value={agency.agencyId}>{agency.agencyName} · {roleLabel[agency.role]}</option>)}
    </select>
  </label>;
}
