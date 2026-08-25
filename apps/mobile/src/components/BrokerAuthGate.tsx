import { ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getMobileAgencyContext, getMobileAvailableAgencies, MobileAgencyContext, setPreferredMobileAgencyId } from "../lib/currentAgency";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { mobileSupabase, mobileSupabaseConfigured } from "../lib/supabase";
import { configureBrokerNotifications, countUnreadBrokerNotifications, markBrokerNotificationsRead, presentNewestUnreadNotification } from "../services/brokerNotifications";

type Props = { children: ReactNode };
type Mode = "login" | "register";

const lenoyAppLogo = require("../../assets/lenoy-icon.png");

export default function BrokerAuthGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [backendValid, setBackendValid] = useState(true);
  const [agencyName, setAgencyName] = useState("");
  const [agencyLogo, setAgencyLogo] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#07182d");
  const [availableAgencies, setAvailableAgencies] = useState<MobileAgencyContext[]>([]);
  const [selectingAgency, setSelectingAgency] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function refreshNotifications(present = false) {
    if (!authorized) return;
    if (present) await presentNewestUnreadNotification();
    setUnread(await countUnreadBrokerNotifications());
  }

  function applyContext(context: MobileAgencyContext) {
    setAgencyName(context.agencyName);
    setAgencyLogo(context.logoUrl || "");
    setPrimaryColor(context.primaryColor);
    setAuthorized(true);
  }

  async function validateSession() {
    if (!mobileSupabase) {
      setChecking(false);
      return;
    }

    const validBackend = await isImobiliariasBackend();
    setBackendValid(validBackend);
    if (!validBackend) {
      setAuthorized(false);
      setAgencyName("");
      setAvailableAgencies([]);
      setChecking(false);
      return;
    }

    const agencies = await getMobileAvailableAgencies();
    setAvailableAgencies(agencies);
    const context = await getMobileAgencyContext();
    if (!context || context.role !== "broker" || !context.brokerId) {
      setAuthorized(false);
      setAgencyName("");
      setAgencyLogo("");
      setPrimaryColor("#07182d");
      setChecking(false);
      return;
    }

    applyContext(context);
    setChecking(false);
    await configureBrokerNotifications();
    setUnread(await countUnreadBrokerNotifications());
  }

  useEffect(() => {
    void validateSession();
    if (!mobileSupabase) return;
    const { data } = mobileSupabase.auth.onAuthStateChange(() => void validateSession());
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authorized) return;
    void refreshNotifications(false);
    const timer = setInterval(() => void refreshNotifications(true), 15000);
    return () => clearInterval(timer);
  }, [authorized, agencyName]);

  async function login() {
    if (!mobileSupabase) return Alert.alert("Configuração pendente", "O Supabase ainda não foi configurado neste aplicativo.");
    if (!backendValid) return Alert.alert("Conexão bloqueada", "O backend configurado não pertence ao projeto IMOBILIARIAS.");
    if (!email.trim() || !password) return Alert.alert("Dados incompletos", "Informe e-mail e senha.");

    setLoading(true);
    const { data, error } = await mobileSupabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.user) {
      setLoading(false);
      return Alert.alert("Não foi possível entrar", "Confira o e-mail e a senha.");
    }

    const agencies = await getMobileAvailableAgencies();
    setAvailableAgencies(agencies);
    const context = await getMobileAgencyContext();
    if (!context || context.role !== "broker" || !context.brokerId) {
      await mobileSupabase.auth.signOut();
      setLoading(false);
      return Alert.alert("Aguardando liberação", "Sua conta precisa estar ativa como corretor de uma imobiliária antes de usar o aplicativo.");
    }

    applyContext(context);
    setLoading(false);
  }

  async function register() {
    if (!mobileSupabase) return Alert.alert("Configuração pendente", "O Supabase ainda não foi configurado neste aplicativo.");
    if (!backendValid) return Alert.alert("Conexão bloqueada", "O backend configurado não pertence ao projeto IMOBILIARIAS.");
    if (!fullName.trim() || !email.trim() || !password) return Alert.alert("Dados incompletos", "Informe nome, e-mail e senha.");
    if (password.length < 8) return Alert.alert("Senha curta", "Use pelo menos 8 caracteres.");
    if (password !== confirm) return Alert.alert("Senhas diferentes", "Confirme a mesma senha nos dois campos.");

    setLoading(true);
    const { error } = await mobileSupabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setLoading(false);

    if (error) return Alert.alert("Não foi possível criar a conta", error.message);
    setPassword("");
    setConfirm("");
    setMode("login");
    Alert.alert("Conta criada", "Confirme seu e-mail, se solicitado. Depois o administrador da sua imobiliária precisa vincular esta conta ao cadastro de corretor.");
  }

  async function switchAgency(context: MobileAgencyContext) {
    if (context.agencyName === agencyName) {
      setSelectingAgency(false);
      return;
    }
    await setPreferredMobileAgencyId(context.agencyId);
    setUnread(0);
    setSelectingAgency(false);
    setChecking(true);
    await validateSession();
  }

  async function clearUnread() {
    if (!unread) return Alert.alert("Notificações", "Não há notificações não lidas.");
    Alert.alert(
      "Notificações",
      `Você tem ${unread} notificação(ões) nova(s). Elas correspondem a contatos e mensagens recebidos pela imobiliária.`,
      [
        { text: "Manter como não lidas", style: "cancel" },
        { text: "Marcar como lidas", onPress: () => void markBrokerNotificationsRead().then(() => setUnread(0)) },
      ],
    );
  }

  if (!mobileSupabaseConfigured) return <>{children}</>;

  if (checking) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <View style={styles.loadingLogoFrame}>
            <Image source={lenoyAppLogo} style={styles.loadingLogo} resizeMode="contain" />
          </View>
          <ActivityIndicator size="large" color="#d6ac58" />
          <Text style={styles.checking}>Verificando imobiliária e acesso...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!backendValid) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centeredMessage}>
          <View style={styles.card}>
            <Text style={styles.kicker}>PROTEÇÃO DE PROJETO</Text>
            <Text style={styles.title}>Conexão bloqueada</Text>
            <Text style={styles.text}>O servidor configurado não se identificou como IMOBILIARIAS. O aplicativo não acessará nem enviará dados até a configuração correta ser instalada.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (authorized) {
    return (
      <View style={styles.authorizedShell}>
        {agencyName ? (
          <View style={[styles.tenantBar, { backgroundColor: primaryColor || "#07182d" }]}>
            <View style={styles.tenantIdentity}>
              {agencyLogo ? (
                <Image source={{ uri: agencyLogo }} style={styles.tenantLogo} />
              ) : (
                <View style={styles.tenantLogoFallback}>
                  <Text style={styles.tenantLogoFallbackText}>{agencyName.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.tenantOverline}>LENOY IMOBILIÁRIAS · APP DO CORRETOR</Text>
                <Text style={styles.tenantText}>{agencyName}</Text>
              </View>
            </View>
            <View style={styles.topActions}>
              {availableAgencies.length > 1 ? (
                <Pressable style={styles.switchAgencyButton} onPress={() => setSelectingAgency((value) => !value)}>
                  <Text style={styles.switchAgencyText}>Trocar</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.notificationButton} onPress={() => void clearUnread()}>
                <Text style={styles.notificationIcon}>🔔</Text>
                {unread > 0 ? <Text style={styles.notificationBadge}>{unread > 99 ? "99+" : unread}</Text> : null}
              </Pressable>
            </View>
          </View>
        ) : null}

        {selectingAgency && availableAgencies.length > 1 ? (
          <View style={styles.agencyPicker}>
            <Text style={styles.agencyPickerTitle}>Escolha a imobiliária ativa</Text>
            {availableAgencies.map((agency) => (
              <Pressable
                key={agency.agencyId}
                style={[styles.agencyOption, agency.agencyName === agencyName && styles.agencyOptionActive]}
                onPress={() => void switchAgency(agency)}
              >
                <View style={styles.agencyIcon}>
                  <Text style={styles.agencyIconText}>{agency.agencyName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.agencyOptionName}>{agency.agencyName}</Text>
                  <Text style={styles.agencyOptionSub}>{agency.agencySlug}.imoveis.lenoy.com.br</Text>
                </View>
                <Text style={styles.agencyOptionState}>{agency.agencyName === agencyName ? "ATIVA" : "ABRIR"}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.loginShell}>
            <View style={styles.brandBlock}>
              <View style={styles.brandLogoFrame}>
                <Image source={lenoyAppLogo} style={styles.brandLogo} resizeMode="contain" />
              </View>
              <Text style={styles.brandName}>LENOY IMOBILIÁRIAS</Text>
              <Text style={styles.brandSub}>Aplicativo do corretor</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.kicker}>{mode === "login" ? "ACESSO PROFISSIONAL" : "NOVO CORRETOR"}</Text>
              <Text style={styles.title}>{mode === "login" ? "Acesso do corretor" : "Criar conta"}</Text>
              <Text style={styles.text}>
                {mode === "login"
                  ? "Entre com a conta vinculada à sua imobiliária e ao seu cadastro de corretor."
                  : "A conta será criada sem permissão. O administrador da imobiliária fará o vínculo com o corretor correto."}
              </Text>

              {mode === "register" ? (
                <>
                  <Text style={styles.label}>Nome completo</Text>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    autoComplete="name"
                    placeholder="Seu nome"
                    placeholderTextColor="#9aa4ad"
                  />
                </>
              ) : null}

              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="corretor@imobiliaria.com.br"
                placeholderTextColor="#9aa4ad"
              />

              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === "login" ? "password" : "new-password"}
                placeholder="Sua senha"
                placeholderTextColor="#9aa4ad"
                onSubmitEditing={() => {
                  if (mode === "login") void login();
                }}
              />

              {mode === "register" ? (
                <>
                  <Text style={styles.label}>Confirmar senha</Text>
                  <TextInput
                    style={styles.input}
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    placeholderTextColor="#9aa4ad"
                  />
                </>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
                onPress={() => void (mode === "login" ? login() : register())}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#07182d" /> : <Text style={styles.buttonText}>{mode === "login" ? "Entrar" : "Criar conta"}</Text>}
              </Pressable>

              <Pressable
                style={styles.switchButton}
                onPress={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setPassword("");
                  setConfirm("");
                }}
              >
                <Text style={styles.switchText}>{mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}</Text>
              </Pressable>
            </View>

            <View style={styles.securityNote}>
              <View style={styles.securityIconCircle}><Text style={styles.securityIcon}>✓</Text></View>
              <Text style={styles.securityText}>Acesso protegido por imobiliária e perfil de corretor.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authorizedShell: { flex: 1, backgroundColor: "#f4f1eb" },
  tenantBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.12)",
  },
  tenantIdentity: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  tenantLogo: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,.35)" },
  tenantLogoFallback: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,.16)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.2)" },
  tenantLogoFallbackText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  tenantOverline: { color: "#d6ac58", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  tenantText: { color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 3 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  switchAgencyButton: { height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,.12)", paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  switchAgencyText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  notificationButton: { width: 43, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,.12)", alignItems: "center", justifyContent: "center", position: "relative", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  notificationIcon: { fontSize: 17 },
  notificationBadge: { position: "absolute", right: -4, top: -5, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: "#d6ac58", color: "#07182d", fontSize: 9, fontWeight: "900", textAlign: "center", lineHeight: 19, paddingHorizontal: 4 },
  agencyPicker: { backgroundColor: "#fff", padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: "#e5ded3" },
  agencyPickerTitle: { fontSize: 10, fontWeight: "900", color: "#65717c", marginBottom: 3, letterSpacing: 0.7 },
  agencyOption: { borderWidth: 1, borderColor: "#e2ddd4", borderRadius: 14, padding: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: "#fff" },
  agencyOptionActive: { borderColor: "#d6ac58", backgroundColor: "#fffaf1" },
  agencyIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#f0e7d7", alignItems: "center", justifyContent: "center" },
  agencyIconText: { fontSize: 15, fontWeight: "900", color: "#8d6825" },
  agencyOptionName: { fontSize: 13, fontWeight: "900", color: "#07182d" },
  agencyOptionSub: { fontSize: 9, color: "#7b8790", marginTop: 3 },
  agencyOptionState: { fontSize: 8, fontWeight: "900", color: "#8d6825", letterSpacing: 0.5 },

  screen: { flex: 1, backgroundColor: "#07182d" },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 22, paddingVertical: 28 },
  loginShell: { width: "100%", maxWidth: 430, alignItems: "center" },
  brandBlock: { width: "100%", alignItems: "center", marginBottom: 18 },
  brandLogoFrame: { width: 86, height: 86, borderRadius: 27, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", padding: 8, borderWidth: 1, borderColor: "rgba(214,172,88,.7)", shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  brandLogo: { width: "100%", height: "100%", borderRadius: 20 },
  brandName: { color: "#ffffff", fontSize: 16, lineHeight: 21, fontWeight: "900", letterSpacing: 1.6, marginTop: 13, textAlign: "center" },
  brandSub: { color: "#a8b4c2", fontSize: 11, marginTop: 3, textAlign: "center" },
  card: { width: "100%", backgroundColor: "#ffffff", borderRadius: 28, paddingHorizontal: 24, paddingVertical: 26, borderWidth: 1, borderColor: "rgba(214,172,88,.35)", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  kicker: { color: "#a97a22", fontSize: 10, fontWeight: "900", letterSpacing: 1.35, marginBottom: 8 },
  title: { color: "#07182d", fontSize: 29, lineHeight: 34, fontWeight: "900", letterSpacing: -0.6 },
  text: { color: "#6e7a85", fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 22 },
  label: { color: "#243447", fontSize: 11, fontWeight: "800", marginBottom: 7, marginTop: 3 },
  input: { width: "100%", height: 54, borderRadius: 15, borderWidth: 1, borderColor: "#dbe1e6", backgroundColor: "#f8fafb", color: "#07182d", paddingHorizontal: 15, fontSize: 14, marginBottom: 15 },
  button: { width: "100%", height: 55, borderRadius: 16, backgroundColor: "#d6ac58", alignItems: "center", justifyContent: "center", marginTop: 7, shadowColor: "#8a641f", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  buttonPressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },
  buttonDisabled: { opacity: 0.62 },
  buttonText: { color: "#07182d", fontSize: 14, fontWeight: "900" },
  switchButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 7 },
  switchText: { color: "#31506d", fontSize: 11, fontWeight: "800" },
  securityNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16, paddingHorizontal: 8 },
  securityIconCircle: { width: 21, height: 21, borderRadius: 11, backgroundColor: "#d6ac58", alignItems: "center", justifyContent: "center" },
  securityIcon: { color: "#07182d", fontSize: 11, fontWeight: "900" },
  securityText: { color: "#c7d0d9", fontSize: 10, fontWeight: "600", textAlign: "center" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 18 },
  loadingLogoFrame: { width: 72, height: 72, borderRadius: 22, padding: 7, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  loadingLogo: { width: "100%", height: "100%", borderRadius: 16 },
  checking: { color: "#d7dfe7", fontSize: 12, fontWeight: "700", textAlign: "center" },
  centeredMessage: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 22 },
});
