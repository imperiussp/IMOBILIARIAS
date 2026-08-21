"use client";

import { FormEvent, useEffect, useState } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type Invitation = {
  id: string;
  email: string;
  role: "admin" | "broker" | "staff";
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  broker_id: string | null;
};
type Broker = { id: string; name: string; active: boolean };

export default function AdminInvitations() {
  const [agencyId, setAgencyId] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [working, setWorking] = useState(false);

  async function load(targetAgencyId?: string) {
    if (!supabaseBrowser) return;
    const id = targetAgencyId || agencyId;
    if (!id) return;
    const [inviteResult, brokerResult] = await Promise.all([
      supabaseBrowser.from("agency_invitations").select("id,email,role,expires_at,accepted_at,revoked_at,broker_id").eq("agency_id", id).order("created_at", { ascending: false }).limit(30),
      supabaseBrowser.from("brokers").select("id,name,active").eq("agency_id", id).eq("active", true).order("name"),
    ]);
    if (inviteResult.error || brokerResult.error) return setMessage(inviteResult.error?.message || brokerResult.error?.message || "Erro ao carregar convites.");
    setInvitations((inviteResult.data || []) as Invitation[]);
    setBrokers((brokerResult.data || []) as Broker[]);
  }

  useEffect(() => {
    if (!supabaseBrowser) return;
    void (async () => {
      const current = await getCurrentAgency();
      if (!current) return setMessage("Não foi possível identificar a imobiliária desta conta.");
      setAgencyId(current.agencyId);
      setCurrentRole(current.role);
      await load(current.agencyId);
    })();
  }, []);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseBrowser || !agencyId) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const role = String(data.get("role") || "staff");
    const brokerId = String(data.get("broker_id") || "") || null;
    if (role === "broker" && !brokerId) return setMessage("Selecione o corretor vinculado ao convite.");
    setWorking(true); setMessage(""); setInviteLink("");
    const { data: rpcData, error } = await supabaseBrowser.rpc("create_agency_invitation", {
      p_agency_id: agencyId,
      p_email: email,
      p_role: role,
      p_broker_id: role === "broker" ? brokerId : null,
    });
    setWorking(false);
    if (error) return setMessage(error.message);
    const token = Array.isArray(rpcData) ? rpcData[0]?.invitation_token : null;
    if (!token) return setMessage("Convite criado, mas o link não pôde ser montado.");
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${base}/convite/?token=${encodeURIComponent(token)}`;
    setInviteLink(link);
    setMessage("Convite criado. Copie o link e envie para a pessoa convidada.");
    event.currentTarget.reset();
    await load();
  }

  async function revoke(id: string) {
    if (!supabaseBrowser) return;
    const { error } = await supabaseBrowser.rpc("revoke_agency_invitation", { p_invitation_id: id });
    if (error) return setMessage(error.message);
    setMessage("Convite revogado.");
    await load();
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setMessage("Link copiado.");
  }

  const canInvite = currentRole === "owner" || currentRole === "admin";

  return <div className="adminPanel" id="convites">
    <div className="adminPanelHeader"><div><span className="eyebrow">EQUIPE</span><h2>Convites de acesso</h2><p>Convide pessoas sem compartilhar senhas e mantendo o vínculo somente com esta imobiliária.</p></div><span>{isSupabaseConfigured ? `${invitations.filter((item) => !item.accepted_at && !item.revoked_at).length} pendente(s)` : "Modo demonstração"}</span></div>
    {!isSupabaseConfigured ? <div className="formNotice">Os convites reais serão ativados junto com o Supabase de produção.</div> : null}
    {canInvite ? <form className="propertyForm" onSubmit={createInvite}>
      <div className="formGrid three"><label>E-mail<input name="email" type="email" required placeholder="pessoa@empresa.com" /></label><label>Perfil<select name="role" defaultValue="staff"><option value="staff">Equipe</option><option value="broker">Corretor</option>{currentRole === "owner" ? <option value="admin">Administrador</option> : null}</select></label><label>Corretor vinculado<select name="broker_id" defaultValue=""><option value="">Somente para perfil Corretor</option>{brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name}</option>)}</select></label></div>
      <div className="formActions"><button className="button primary" disabled={working}>{working ? "Criando..." : "Gerar convite"}</button></div>
    </form> : <div className="formNotice">Somente proprietário ou administrador pode gerar convites.</div>}
    {inviteLink ? <div className="domainPrimaryCard"><div><span className="eyebrow">LINK DO CONVITE</span><strong style={{wordBreak:"break-all"}}>{inviteLink}</strong><small>Expira em 7 dias e só pode ser aceito pela conta do e-mail convidado.</small></div><button type="button" className="miniButton" onClick={() => void copyLink()}>Copiar link</button></div> : null}
    {message ? <div className="formMessage">{message}</div> : null}
    {invitations.length ? <div className="accessList">{invitations.map((item) => {
      const expired = new Date(item.expires_at).getTime() < Date.now();
      const state = item.accepted_at ? "Aceito" : item.revoked_at ? "Revogado" : expired ? "Expirado" : "Pendente";
      return <article className="accessRow" key={item.id}><div className="accessIdentity"><strong>{item.email}</strong><span>{item.role === "admin" ? "Administrador" : item.role === "broker" ? "Corretor" : "Equipe"}</span><small>Expira em {new Date(item.expires_at).toLocaleDateString("pt-BR")}</small></div><div className="accessActions"><span className="statusPill">{state}</span>{state === "Pendente" && canInvite ? <button type="button" className="miniButton danger" onClick={() => void revoke(item.id)}>Revogar</button> : null}</div></article>;
    })}</div> : isSupabaseConfigured ? <div className="emptyMini">Nenhum convite criado ainda.</div> : null}
  </div>;
}
