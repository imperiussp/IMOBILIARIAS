"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentAgency, type CurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type PlanState = {
  name: string;
  status: string;
  renewsAt: string | null;
  endsAt: string | null;
};

type MenuItem = {
  label: string;
  detail: string;
  href: string;
  adminOnly?: boolean;
};

const menuItems: MenuItem[] = [
  { label: "Início", detail: "Painel móvel", href: "/app/" },
  { label: "Imóveis", detail: "Catálogo e anúncios", href: "/admin/#imoveis" },
  { label: "Novo imóvel", detail: "Cadastrar imóvel", href: "/admin/#novo-imovel", adminOnly: true },
  { label: "Contatos", detail: "Leads e interessados", href: "/admin/#contatos" },
  { label: "Classificação", detail: "Organizar oportunidades", href: "/admin/#qualificacao-contatos" },
  { label: "Acompanhamentos", detail: "Próximas ações", href: "/admin/#acompanhamentos" },
  { label: "Agenda de visitas", detail: "Visitas e compromissos", href: "/admin/#agenda-visitas" },
  { label: "Meu plano", detail: "Plano, vigência e limites", href: "/admin/#meu-plano", adminOnly: true },
  { label: "Alterar / renovar plano", detail: "Pagamento e mudança de plano", href: "/admin/#pagamento-infinitepay", adminOnly: true },
  { label: "E-mails profissionais", detail: "Criar e gerenciar caixas", href: "/admin/#emails-profissionais", adminOnly: true },
  { label: "Identidade e aparência", detail: "Logo, cores e visual", href: "/admin/#configuracoes", adminOnly: true },
  { label: "Domínios", detail: "Domínio próprio da imobiliária", href: "/admin/#dominios", adminOnly: true },
  { label: "Usuários", detail: "Acessos da equipe", href: "/admin/#usuarios", adminOnly: true },
  { label: "Corretores", detail: "Equipe comercial", href: "/admin/#corretores", adminOnly: true },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

export default function MobileWebApp() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [agency, setAgency] = useState<CurrentAgency | null>(null);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = agency?.role === "owner" || agency?.role === "admin";

  useEffect(() => {
    let active = true;
    void (async () => {
      const current = await getCurrentAgency();
      if (!active) return;
      setAgency(current);
      if (current && supabaseBrowser) {
        const result = await supabaseBrowser
          .from("agency_subscriptions")
          .select("status,renews_at,ends_at,subscription_plans(name)")
          .eq("agency_id", current.agencyId)
          .order("starts_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!active) return;
        if (!result.error && result.data) {
          const rawPlan = result.data.subscription_plans as unknown as { name?: string } | null;
          setPlan({
            name: rawPlan?.name || "Plano atual",
            status: String(result.data.status || ""),
            renewsAt: result.data.renews_at || null,
            endsAt: result.data.ends_at || null,
          });
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  const visibleMenu = useMemo(() => menuItems.filter((item) => !item.adminOnly || isAdmin), [isAdmin]);

  async function signOut() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    window.location.href = "/login/?redirect=%2Fapp%2F";
  }

  const roleLabel = agency?.role === "owner" ? "Proprietário" : agency?.role === "admin" ? "Administrador" : agency?.role === "broker" ? "Corretor" : "Equipe";

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.brand}>LENOY IMOBILIÁRIAS</div>
          <div style={styles.appTitle}>Painel do corretor</div>
        </div>
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" style={styles.menuButton}>☰</button>
      </header>

      <section style={styles.content}>
        <div style={styles.hero}>
          <div>
            <div style={styles.heroKicker}>{loading ? "CARREGANDO" : roleLabel.toUpperCase()}</div>
            <h1 style={styles.heroTitle}>{agency?.agencyName || "Sua imobiliária"}</h1>
            <p style={styles.heroText}>Imóveis, contatos, visitas e gestão em uma tela feita para o celular.</p>
          </div>
          {isAdmin ? <a href="/admin/#meu-plano" style={styles.planBadge}><span style={styles.planBadgeLabel}>PLANO</span><strong style={styles.planBadgeValue}>{plan?.name || "—"}</strong></a> : null}
        </div>

        <div style={styles.sectionHeader}>
          <span style={styles.sectionKicker}>ATALHOS</span>
          <h2 style={styles.sectionTitle}>O que você precisa fazer?</h2>
        </div>

        <div style={styles.grid}>
          {isAdmin ? <ActionCard title="Novo imóvel" text="Cadastrar um novo imóvel" href="/admin/#novo-imovel" dark /> : null}
          <ActionCard title="Meus imóveis" text="Consultar catálogo e anúncios" href="/admin/#imoveis" />
          <ActionCard title="Contatos" text="Leads e interessados" href="/admin/#contatos" />
          <ActionCard title="Visitas" text="Agenda comercial" href="/admin/#agenda-visitas" />
          <ActionCard title="Acompanhamentos" text="Próximas ações e retornos" href="/admin/#acompanhamentos" />
          {isAdmin ? <ActionCard title="Meu plano" text="Vigência, limites e alteração" href="/admin/#meu-plano" /> : null}
        </div>

        {isAdmin ? (
          <section style={styles.managementCard}>
            <div>
              <span style={styles.sectionKicker}>GESTÃO</span>
              <h2 style={{ ...styles.sectionTitle, marginTop: 4 }}>Conta da imobiliária</h2>
              <p style={styles.muted}>Plano: {plan?.name || "—"} · Renovação: {formatDate(plan?.renewsAt || plan?.endsAt || null)}</p>
            </div>
            <div style={styles.managementLinks}>
              <a href="/admin/#pagamento-infinitepay" style={styles.manageLink}>Alterar / renovar plano <span>›</span></a>
              <a href="/admin/#emails-profissionais" style={styles.manageLink}>E-mails profissionais <span>›</span></a>
              <a href="/admin/#configuracoes" style={styles.manageLink}>Identidade e aparência <span>›</span></a>
              <a href="/admin/#dominios" style={styles.manageLink}>Domínios <span>›</span></a>
            </div>
          </section>
        ) : null}

        <a href="/admin/" style={styles.fullPanelLink}>Abrir painel completo <span>›</span></a>
      </section>

      {menuOpen ? (
        <div style={styles.menuLayer} role="dialog" aria-modal="true" aria-label="Menu do aplicativo">
          <button type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} style={styles.backdrop} />
          <aside style={styles.drawer}>
            <div style={styles.drawerHead}>
              <div>
                <div style={styles.brand}>LENOY IMOBILIÁRIAS</div>
                <div style={styles.drawerTitle}>Menu</div>
                <div style={styles.drawerAgency}>{agency?.agencyName || "Sua imobiliária"}</div>
              </div>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" style={styles.closeButton}>×</button>
            </div>
            <nav style={styles.menuList}>
              {visibleMenu.map((item) => (
                <a key={`${item.label}-${item.href}`} href={item.href} onClick={() => setMenuOpen(false)} style={styles.menuItem}>
                  <span><strong style={styles.menuItemTitle}>{item.label}</strong><small style={styles.menuItemDetail}>{item.detail}</small></span>
                  <span style={styles.arrow}>›</span>
                </a>
              ))}
            </nav>
            <button type="button" onClick={() => void signOut()} style={styles.signOut}>Sair da conta</button>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function ActionCard({ title, text, href, dark = false }: { title: string; text: string; href: string; dark?: boolean }) {
  return <a href={href} style={{ ...styles.actionCard, ...(dark ? styles.actionCardDark : {}) }}><span style={{ ...styles.actionIcon, ...(dark ? styles.actionIconDark : {}) }}>＋</span><strong style={{ ...styles.actionTitle, ...(dark ? styles.actionTitleDark : {}) }}>{title}</strong><small style={{ ...styles.actionText, ...(dark ? styles.actionTextDark : {}) }}>{text}</small></a>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#f5f1ea", color: "#07182d", fontFamily: "Inter, Arial, sans-serif" },
  topbar: { position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingLeft: 18, paddingRight: 18, paddingBottom: 12, paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)", background: "rgba(255,255,255,.97)", borderBottom: "1px solid #e8e0d4", boxShadow: "0 8px 24px rgba(7,24,45,.05)" },
  brand: { fontSize: 9, lineHeight: 1.2, letterSpacing: 1.7, fontWeight: 900, color: "#a1782e" },
  appTitle: { marginTop: 3, fontSize: 17, lineHeight: 1.1, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  menuButton: { width: 46, height: 44, flex: "0 0 auto", border: 0, borderRadius: 14, background: "#07182d", color: "#fff", fontSize: 24, fontWeight: 900, cursor: "pointer" },
  content: { width: "min(100%, 760px)", margin: "0 auto", padding: "16px 16px calc(30px + env(safe-area-inset-bottom, 0px))" },
  hero: { display: "flex", justifyContent: "space-between", gap: 14, padding: 20, borderRadius: 24, background: "#07182d", color: "#fff", boxShadow: "0 18px 38px rgba(7,24,45,.14)" },
  heroKicker: { fontSize: 9, letterSpacing: 1.7, fontWeight: 900, color: "#d6ac58" },
  heroTitle: { margin: "7px 0 0", fontSize: 27, lineHeight: 1.05, fontWeight: 950 },
  heroText: { margin: "9px 0 0", maxWidth: 340, fontSize: 13, lineHeight: 1.55, color: "#c6d0da" },
  planBadge: { alignSelf: "flex-start", minWidth: 88, padding: 11, borderRadius: 16, textDecoration: "none", background: "#d6ac58", color: "#07182d", textAlign: "center" },
  planBadgeLabel: { display: "block", fontSize: 8, fontWeight: 900, letterSpacing: 1.2 },
  planBadgeValue: { display: "block", marginTop: 4, fontSize: 14, lineHeight: 1.05 },
  sectionHeader: { marginTop: 22, padding: "0 2px" },
  sectionKicker: { fontSize: 9, fontWeight: 900, letterSpacing: 1.5, color: "#a1782e" },
  sectionTitle: { margin: "5px 0 0", fontSize: 22, lineHeight: 1.15, fontWeight: 950 },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 11, marginTop: 13 },
  actionCard: { minHeight: 142, display: "flex", flexDirection: "column", justifyContent: "flex-start", padding: 17, borderRadius: 20, border: "1px solid #e5ded3", background: "#fff", color: "#07182d", textDecoration: "none", boxShadow: "0 8px 22px rgba(7,24,45,.04)" },
  actionCardDark: { background: "#07182d", borderColor: "#07182d" },
  actionIcon: { fontSize: 25, lineHeight: 1, color: "#a1782e" },
  actionIconDark: { color: "#d6ac58" },
  actionTitle: { marginTop: 20, fontSize: 16, fontWeight: 950 },
  actionTitleDark: { color: "#fff" },
  actionText: { marginTop: 5, fontSize: 11, lineHeight: 1.45, color: "#74808a" },
  actionTextDark: { color: "#b8c4ce" },
  managementCard: { marginTop: 18, padding: 18, borderRadius: 21, background: "#fff", border: "1px solid #e5ded3" },
  muted: { margin: "7px 0 0", fontSize: 12, lineHeight: 1.5, color: "#71808b" },
  managementLinks: { display: "grid", gap: 8, marginTop: 14 },
  manageLink: { display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 46, padding: "0 13px", borderRadius: 13, background: "#f7f4ef", color: "#07182d", textDecoration: "none", fontSize: 13, fontWeight: 850 },
  fullPanelLink: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, minHeight: 50, padding: "0 16px", borderRadius: 15, background: "#07182d", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 900 },
  menuLayer: { position: "fixed", inset: 0, zIndex: 100, display: "flex" },
  backdrop: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "rgba(2,10,20,.58)", cursor: "pointer" },
  drawer: { position: "relative", marginLeft: "auto", width: "min(88vw, 360px)", height: "100%", overflowY: "auto", paddingLeft: 14, paddingRight: 14, paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))", paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)", background: "#fff", boxShadow: "-18px 0 45px rgba(2,10,20,.2)" },
  drawerHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "4px 2px 16px", borderBottom: "1px solid #ece5da" },
  drawerTitle: { marginTop: 4, fontSize: 25, fontWeight: 950 },
  drawerAgency: { marginTop: 4, fontSize: 11, color: "#6d7983" },
  closeButton: { width: 42, height: 42, border: 0, borderRadius: 13, background: "#f3eee6", color: "#07182d", fontSize: 28, lineHeight: 1, cursor: "pointer" },
  menuList: { display: "grid", gap: 7, paddingTop: 13 },
  menuItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 60, padding: "10px 13px", borderRadius: 15, border: "1px solid #eee8df", background: "#f9f7f3", color: "#07182d", textDecoration: "none" },
  menuItemTitle: { display: "block", fontSize: 13, fontWeight: 950 },
  menuItemDetail: { display: "block", marginTop: 3, fontSize: 10, color: "#7a8791" },
  arrow: { fontSize: 24, color: "#a58d63" },
  signOut: { width: "100%", minHeight: 48, marginTop: 12, borderRadius: 13, border: "1px solid #ecd3d3", background: "#fff5f5", color: "#a13b3b", fontSize: 12, fontWeight: 900, cursor: "pointer" },
};
