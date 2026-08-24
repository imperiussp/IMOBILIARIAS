"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Profile = { user_id: string; email: string | null; full_name: string | null; phone: string | null; created_at: string };
type Membership = { user_id: string; role: "owner" | "admin" | "broker" | "staff"; active: boolean; created_at: string };
type Broker = { id: string; name: string; user_id: string | null; photo_url: string | null; active: boolean };

export default function AdminUsers() {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [currentRole, setCurrentRole] = useState<Membership["role"] | "">("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");

  async function load(targetAgencyId?: string) {
    if (!supabaseBrowser) return;
    const resolvedAgencyId = targetAgencyId || agencyId;
    if (!resolvedAgencyId) return;

    const [membershipResult, brokersResult] = await Promise.all([
      supabaseBrowser.from("agency_memberships").select("user_id,role,active,created_at").eq("agency_id", resolvedAgencyId).eq("active", true).order("created_at"),
      supabaseBrowser.from("brokers").select("id,name,user_id,photo_url,active").eq("agency_id", resolvedAgencyId).order("name"),
    ]);

    if (membershipResult.error || brokersResult.error) {
      setMessage(membershipResult.error?.message || brokersResult.error?.message || "Erro ao carregar acessos.");
      return;
    }

    const memberRows = (membershipResult.data || []) as Membership[];
    setMemberships(memberRows);
    setBrokers((brokersResult.data || []) as Broker[]);

    const userIds = memberRows.map((row) => row.user_id);
    if (!userIds.length) {
      setProfiles([]);
      return;
    }

    const profilesResult = await supabaseBrowser
      .from("profiles")
      .select("user_id,email,full_name,phone,created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false });

    if (profilesResult.error) return setMessage(profilesResult.error.message);
    setProfiles((profilesResult.data || []) as Profile[]);
  }

  useEffect(() => {
    if (!supabaseBrowser) return;
    let active = true;
    void (async () => {
      const currentAgency = await getCurrentAgency();
      if (!active) return;
      if (!currentAgency) {
        setMessage("Vincule esta conta a uma imobiliária para gerenciar a equipe.");
        return;
      }
      setAgencyId(currentAgency.agencyId);
      setAgencyName(currentAgency.agencyName);
      setCurrentRole(currentAgency.role);
      await load(currentAgency.agencyId);
    })();
    return () => { active = false; };
  }, []);

  const membershipByUser = useMemo(() => new Map(memberships.map((row) => [row.user_id, row])), [memberships]);
  const brokerByUser = useMemo(() => new Map(brokers.filter((row) => row.user_id).map((row) => [row.user_id as string, row])), [brokers]);
  const canManage = currentRole === "owner" || currentRole === "admin";

  async function grant(userId: string, role: "admin" | "broker" | "staff", brokerId?: string) {
    if (!supabaseBrowser || !agencyId) return;
    if (role === "broker" && !brokerId) return setMessage("Selecione o corretor que corresponde a esta conta.");
    setWorking(userId); setMessage("");
    const { error } = await supabaseBrowser.rpc("agency_set_member_role", {
      p_agency_id: agencyId,
      p_target_user_id: userId,
      p_role: role,
      p_broker_id: role === "broker" ? brokerId : null,
    });
    setWorking("");
    if (error) return setMessage(error.message);
    setMessage(role === "admin" ? "Acesso de administrador liberado." : role === "broker" ? "Acesso de corretor liberado e vinculado." : "Acesso de equipe liberado.");
    await load();
  }

  async function revoke(userId: string) {
    if (!supabaseBrowser || !agencyId) return;
    if (!window.confirm("Revogar o acesso desta conta a esta imobiliária?")) return;
    setWorking(userId); setMessage("");
    const { error } = await supabaseBrowser.rpc("agency_revoke_member", { p_agency_id: agencyId, p_target_user_id: userId });
    setWorking("");
    if (error) return setMessage(error.message);
    setMessage("Acesso revogado nesta imobiliária. A conta foi preservada.");
    await load();
  }

  return (
    <div className="adminPanel" id="usuarios">
      <div className="adminPanelHeader"><div><span className="eyebrow">ACESSOS</span><h2>Usuários e permissões</h2><p>{agencyName ? `Equipe vinculada exclusivamente a ${agencyName}.` : "Gerencie os acessos da sua imobiliária."}</p></div><span>{isSupabaseConfigured ? `${memberships.length} membro(s)` : "Modo demonstração"}</span></div>
      {!isSupabaseConfigured ? <div className="formNotice">A gestão de usuários será ativada junto com o Supabase exclusivo do IMOBILIARIAS.</div> : null}
      {isSupabaseConfigured && currentRole === "staff" ? <div className="formNotice">Seu perfil pode consultar a equipe, mas alterações de permissões dependem do proprietário ou administrador.</div> : null}
      {message ? <div className="formMessage">{message}</div> : null}
      {profiles.length > 0 ? <div className="accessList">{profiles.map((profile) => {
        const membership = membershipByUser.get(profile.user_id);
        const linkedBroker = brokerByUser.get(profile.user_id);
        const role = membership?.role;
        const protectedOwner = role === "owner";
        const displayName = profile.full_name || linkedBroker?.name || "Usuário sem nome";
        return <article className="accessRow" key={profile.user_id}>
          <div className="accessIdentityWithPhoto">
            {linkedBroker?.photo_url ? <img className="accessAvatar" src={linkedBroker.photo_url} alt={linkedBroker.name} /> : <div className="accessAvatar accessAvatarFallback">{displayName.slice(0,1).toUpperCase()}</div>}
            <div className="accessIdentity"><strong>{displayName}</strong><span>{profile.email || "E-mail não disponível"}</span><small>{role === "owner" ? "Proprietário" : role === "admin" ? "Administrador" : role === "broker" ? `Corretor${linkedBroker ? ` · ${linkedBroker.name}` : ""}` : "Equipe"}</small></div>
          </div>
          <div className="accessActions">
            {!protectedOwner && canManage ? <>
              {currentRole === "owner" ? <button className="miniButton" disabled={working === profile.user_id} onClick={() => void grant(profile.user_id, "admin")}>Administrador</button> : null}
              <button className="miniButton" disabled={working === profile.user_id} onClick={() => void grant(profile.user_id, "staff")}>Equipe</button>
              <select id={`broker-${profile.user_id}`} className="compactSelect" defaultValue={linkedBroker?.id || ""}><option value="">Vincular corretor...</option>{brokers.filter((broker) => broker.active).map((broker) => <option value={broker.id} key={broker.id}>{broker.name}</option>)}</select>
              <button className="miniButton" disabled={working === profile.user_id} onClick={() => {
                const select = document.getElementById(`broker-${profile.user_id}`) as HTMLSelectElement | null;
                void grant(profile.user_id, "broker", select?.value || undefined);
              }}>Liberar corretor</button>
              <button className="miniButton danger" disabled={working === profile.user_id} onClick={() => void revoke(profile.user_id)}>Revogar</button>
            </> : <span className="statusPill">{protectedOwner ? "Conta principal" : "Somente leitura"}</span>}
          </div>
        </article>;
      })}</div> : isSupabaseConfigured ? <div className="emptyMini">Nenhum membro vinculado a esta imobiliária.</div> : null}
    </div>
  );
}
