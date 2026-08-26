"use client";

import { useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Row = {
  id: string;
  title: string;
  code: string;
  display_code: string | null;
  featured: boolean;
  marketing_label: string | null;
};

const suggestions = [
  "",
  "Destaque",
  "Lançamento",
  "Promoção",
  "Oferta",
  "Oportunidade",
  "Exclusivo",
  "Última chance",
  "Baixou o preço",
];

export default function PropertyMarketingLabels() {
  const [rows, setRows] = useState<Row[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const current = await getCurrentAgency();
    if (!current) return;
    setAgencyId(current.agencyId);
    const result = await supabaseBrowser
      .from("properties")
      .select("id,title,code,display_code,featured,marketing_label")
      .eq("agency_id", current.agencyId)
      .order("created_at", { ascending: false });
    if (result.error) setMessage(result.error.message);
    else setRows((result.data || []) as Row[]);
  }

  useEffect(() => { void load(); }, []);

  async function save(row: Row, featured: boolean, label: string) {
    if (!supabaseBrowser || !agencyId) return;
    const normalizedLabel = label.trim().slice(0, 40) || (featured ? "Destaque" : null);
    setSavingId(row.id);
    setMessage("");
    const result = await supabaseBrowser
      .from("properties")
      .update({ featured, marketing_label: normalizedLabel })
      .eq("id", row.id)
      .eq("agency_id", agencyId);
    setSavingId("");
    if (result.error) return setMessage(result.error.message);
    setRows((current) => current.map((item) => item.id === row.id
      ? { ...item, featured, marketing_label: normalizedLabel }
      : item));
    setMessage(`Vitrine de ${row.display_code || row.code} atualizada.`);
  }

  return <div className="propertyLabelManager">
    <p className="formNotice">Escolha quais imóveis entram na área <strong>Destaques</strong> do site e defina o selo exibido sobre a foto.</p>
    {message ? <div className="formMessage">{message}</div> : null}
    <div className="propertyLabelRows">
      {rows.map((row) => <article key={row.id} className={row.featured ? "isFeatured" : ""}>
        <div className="propertyLabelIdentity"><small>Ref. {row.display_code || row.code}</small><strong>{row.title}</strong></div>
        <label className="featuredToggle">
          <input type="checkbox" checked={row.featured} disabled={savingId === row.id} onChange={(event) => void save(row, event.target.checked, row.marketing_label || "")} />
          <span>Mostrar em Destaques</span>
        </label>
        <div className="propertyLabelControls">
          <input
            list={`labels-${row.id}`}
            value={row.marketing_label || ""}
            placeholder="Escolha ou digite um selo"
            maxLength={40}
            disabled={savingId === row.id}
            onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, marketing_label: event.target.value } : item))}
            onBlur={(event) => void save(row, row.featured, event.target.value)}
          />
          <datalist id={`labels-${row.id}`}>{suggestions.filter(Boolean).map((item) => <option key={item} value={item} />)}</datalist>
          <button type="button" disabled={savingId === row.id} onClick={(event) => {
            const input = event.currentTarget.previousElementSibling?.previousElementSibling as HTMLInputElement | null;
            if (input) void save(row, row.featured, input.value);
          }}>{savingId === row.id ? "Salvando..." : "Salvar"}</button>
        </div>
      </article>)}
    </div>
    {!rows.length ? <div className="emptyMini">Nenhum imóvel cadastrado.</div> : null}
  </div>;
}
