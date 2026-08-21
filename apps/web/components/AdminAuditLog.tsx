"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type AuditRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  created_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

function actionLabel(action: string) {
  if (action === "insert") return "Criado";
  if (action === "update") return "Atualizado";
  if (action === "delete") return "Excluído";
  return action;
}

function entityLabel(entity: string) {
  if (entity === "property") return "Imóvel";
  if (entity === "broker") return "Corretor";
  return entity;
}

function describe(row: AuditRow) {
  const data = row.new_data || row.old_data || {};
  const code = typeof data.code === "string" ? data.code : "";
  const title = typeof data.title === "string" ? data.title : "";
  const name = typeof data.name === "string" ? data.name : "";
  return [code, title || name].filter(Boolean).join(" · ") || row.entity_id || "Registro";
}

export default function AdminAuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    if (!supabaseBrowser) return;
    const { data, error } = await supabaseBrowser.from("audit_log").select("id,entity_type,entity_id,action,created_at,old_data,new_data").order("created_at", { ascending: false }).limit(100);
    if (error) return setMessage(error.message);
    setRows((data || []) as AuditRow[]);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => filter === "all" ? rows : rows.filter((row) => row.entity_type === filter), [rows, filter]);

  return (
    <div className="adminPanel" id="historico">
      <div className="adminPanelHeader">
        <div><span className="eyebrow">AUDITORIA</span><h2>Histórico de alterações</h2><p>Registra criação, edição e exclusão de imóveis e corretores.</p></div>
        <div className="adminPanelTools"><select className="compactSelect" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Tudo</option><option value="property">Imóveis</option><option value="broker">Corretores</option></select>{isSupabaseConfigured && <button className="miniButton" onClick={() => void load()}>Atualizar</button>}</div>
      </div>
      {!isSupabaseConfigured ? <div className="formNotice">O histórico será ativado quando o Supabase exclusivo do IMOBILIARIAS estiver configurado.</div> : filtered.length === 0 ? <span className="emptyMini">Nenhuma alteração registrada ainda.</span> : <div className="auditList">{filtered.map((row) => <article className="auditRow" key={row.id}><div><strong>{actionLabel(row.action)} · {entityLabel(row.entity_type)}</strong><span>{describe(row)}</span></div><time>{new Date(row.created_at).toLocaleString("pt-BR")}</time></article>)}</div>}
      {message && <div className="formMessage">{message}</div>}
    </div>
  );
}
