"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Profile = { user_id: string; email: string | null; full_name: string | null; phone: string | null; created_at: string };
type RoleRow = { user_id: string; role: "admin" | "broker" };
type Broker = { id: string; name: string; user_id: string | null; active: boolean };

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const [profilesResult, rolesResult, brokersResult] = await Promise.all([
      supabaseBrowser.from("profiles").select("user_id,email,full_name,phone,created_at").order("created_at", { ascending: false }),
      supabaseBrowser.from("user_roles").select("user_id,role"),
      supabaseBrowser.from("brokers").select("id,name,user_id,active").order("name"),
    ]);
    if (profilesResult.error || rolesResult.error || brokersResult.error) {
      setMessage(profilesResult.error?.message || rolesResult.error?.message || brokersResult.error?.message || "Erro ao carregar acessos.");
      return;
    }
    setProfiles((profilesResult.data || []) as Profile[]);
    setRoles((rolesResult.data || []) as RoleRow[]);
    setBrokers((brokersResult.data || []) as Broker[]);
  }

  useEffect(() => { void load(); }, []);

  const roleByUser = useMemo(() => new Map(roles.map((row) => [row.user_id, row.role])), [roles]);
  const brokerByUser = useMemo(() => new Map(brokers.filter((row) => row.user_id).map((row) => [row.user_id as string, row])), [brokers]);

  async function grant(userId: string, role: "admin" | "broker", brokerId?: string) {
    if (!supabaseBrowser) return;
    if (role === "broker" && !brokerId) return setMessage("Selecione o corretor que corresponde a esta conta.");
    setWorking(userId); setMessage("");
    const { error } = await supabaseBrowser.rpc("admin_set_user_access", {
      target_user_id: userId,
      target_role: role,
      target_broker_id: role === "broker" ? brokerId : null,
    });
    setWorking("");
    if (error) return setMessage(error.message);
    setMessage(role === "admin" ? "Acesso de administrador liberado." : "Acesso de corretor liberado e vinculado.");
    await load();
  }

  async function revoke(userId: string) {
    if (!supabaseBrowser) return;
    if (!window.confirm("Revogar o acesso desta conta ao sistema?")) return;
    setWorking(userId); setMessage("");
    const { error } = await supabaseBrowser.rpc("admin_revoke_user_access", { target_user_id: userId });
    setWorking("");
    if (error) return setMessage(error.message);
    setMessage("Acesso revogado. A conta foi preservada, mas não entra mais no painel ou aplicativo.");
    await load();
  }

  return (
    <div className="adminPanel" id="usuarios">
      <div className="adminPanelHeader"><div><span className="eyebrow">ACESSOS</span><h2>Usuários e permissões</h2><p>Contas novas ficam sem acesso até que um administrador libere o perfil correto.</p></div><span>{isSupabaseConfigured ? `${profiles.length} conta(s)` : "Modo demonstração"}</span></div>
      {!isSupabaseConfigured ? <div className="formNotice">A gestão de usuários será ativada junto com o Supabase exclusivo do IMOBILIARIAS.</div> : null}
      {message ? <div className="formMessage">{message}</div> : null}
      {profiles.length > 0 ? <div className="accessList">{profiles.map((profile) => {
        const role = roleByUser.get(profile.user_id);
        const linkedBroker = brokerByUser.get(profile.user_id);
        return <article className="accessRow" key={profile.user_id}>
          <div className="accessIdentity"><strong>{profile.full_name || "Usuário sem nome"}</strong><span>{profile.email || "E-mail não disponível"}</span><small>{role === "admin" ? "Administrador" : role === "broker" ? `Corretor${linkedBroker ? ` · ${linkedBroker.name}` : ""}` : "Aguardando liberação"}</small></div>
          <div className="accessActions">
            <button className="miniButton" disabled={working === profile.user_id} onClick={() => void grant(profile.user_id, "admin")}>Administrador</button>
            <select id={`broker-${profile.user_id}`} className="compactSelect" defaultValue={linkedBroker?.id || ""}><option value="">Vincular corretor...</option>{brokers.filter((broker) => broker.active).map((broker) => <option value={broker.id} key={broker.id}>{broker.name}</option>)}</select>
            <button className="miniButton" disabled={working === profile.user_id} onClick={() => {
              const select = document.getElementById(`broker-${profile.user_id}`) as HTMLSelectElement | null;
              void grant(profile.user_id, "broker", select?.value || undefined);
            }}>Liberar corretor</button>
            {role ? <button className="miniButton danger" disabled={working === profile.user_id} onClick={() => void revoke(profile.user_id)}>Revogar</button> : null}
          </div>
        </article>;
      })}</div> : isSupabaseConfigured ? <div className="emptyMini">Nenhuma conta criada ainda.</div> : null}
    </div>
  );
}
