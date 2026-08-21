import { ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getMobileAgencyContext } from "../lib/currentAgency";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { mobileSupabase, mobileSupabaseConfigured } from "../lib/supabase";
import { configureBrokerNotifications, countUnreadBrokerNotifications, markBrokerNotificationsRead, presentNewestUnreadNotification } from "../services/brokerNotifications";

type Props = { children: ReactNode };
type Mode = "login" | "register";

export default function BrokerAuthGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [backendValid, setBackendValid] = useState(true);
  const [agencyName, setAgencyName] = useState("");
  const [agencyLogo, setAgencyLogo] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#17202a");
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

  async function validateSession() {
    if (!mobileSupabase) { setChecking(false); return; }
    const validBackend = await isImobiliariasBackend();
    setBackendValid(validBackend);
    if (!validBackend) { setAuthorized(false); setAgencyName(""); setChecking(false); return; }

    const context = await getMobileAgencyContext();
    if (!context || context.role !== "broker" || !context.brokerId) {
      setAuthorized(false);
      setAgencyName(context?.agencyName || "");
      setAgencyLogo(context?.logoUrl || "");
      setPrimaryColor(context?.primaryColor || "#17202a");
      setChecking(false);
      return;
    }

    setAgencyName(context.agencyName);
    setAgencyLogo(context.logoUrl || "");
    setPrimaryColor(context.primaryColor);
    setAuthorized(true);
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
  }, [authorized]);

  async function login() {
    if (!mobileSupabase) return Alert.alert("Configuração pendente", "O Supabase ainda não foi configurado neste aplicativo.");
    if (!backendValid) return Alert.alert("Conexão bloqueada", "O backend configurado não pertence ao projeto IMOBILIARIAS.");
    if (!email.trim() || !password) return Alert.alert("Dados incompletos", "Informe e-mail e senha.");
    setLoading(true);
    const { data, error } = await mobileSupabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) {
      setLoading(false);
      return Alert.alert("Não foi possível entrar", "Confira o e-mail e a senha.");
    }

    const context = await getMobileAgencyContext();
    if (!context || context.role !== "broker" || !context.brokerId) {
      await mobileSupabase.auth.signOut();
      setLoading(false);
      return Alert.alert("Aguardando liberação", "Sua conta precisa estar ativa como corretor de uma imobiliária antes de usar o aplicativo.");
    }

    setAgencyName(context.agencyName);
    setAgencyLogo(context.logoUrl || "");
    setPrimaryColor(context.primaryColor);
    setAuthorized(true);
    setLoading(false);
  }

  async function register() {
    if (!mobileSupabase) return Alert.alert("Configuração pendente", "O Supabase ainda não foi configurado neste aplicativo.");
    if (!backendValid) return Alert.alert("Conexão bloqueada", "O backend configurado não pertence ao projeto IMOBILIARIAS.");
    if (!fullName.trim() || !email.trim() || !password) return Alert.alert("Dados incompletos", "Informe nome, e-mail e senha.");
    if (password.length < 8) return Alert.alert("Senha curta", "Use pelo menos 8 caracteres.");
    if (password !== confirm) return Alert.alert("Senhas diferentes", "Confirme a mesma senha nos dois campos.");
    setLoading(true);
    const { error } = await mobileSupabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: fullName.trim() } } });
    setLoading(false);
    if (error) return Alert.alert("Não foi possível criar a conta", error.message);
    setPassword(""); setConfirm(""); setMode("login");
    Alert.alert("Conta criada", "Confirme seu e-mail, se solicitado. Depois o administrador da sua imobiliária precisa vincular esta conta ao cadastro de corretor.");
  }

  async function clearUnread() {
    if (!unread) return Alert.alert("Notificações", "Não há notificações não lidas.");
    Alert.alert("Notificações", `Você tem ${unread} notificação(ões) nova(s). Elas correspondem a contatos e mensagens recebidos pela imobiliária.`, [
      { text: "Manter como não lidas", style: "cancel" },
      { text: "Marcar como lidas", onPress: () => void markBrokerNotificationsRead().then(() => setUnread(0)) },
    ]);
  }

  if (!mobileSupabaseConfigured) return <>{children}</>;
  if (checking) return <SafeAreaView style={styles.screen}><ActivityIndicator size="large" /><Text style={styles.checking}>Verificando imobiliária e acesso...</Text></SafeAreaView>;
  if (!backendValid) return <SafeAreaView style={styles.screen}><View style={styles.card}><Text style={styles.kicker}>PROTEÇÃO DE PROJETO</Text><Text style={styles.title}>Conexão bloqueada</Text><Text style={styles.text}>O servidor configurado não se identificou como IMOBILIARIAS. O aplicativo não acessará nem enviará dados até a configuração correta ser instalada.</Text></View></SafeAreaView>;
  if (authorized) return <View style={styles.authorizedShell}>{agencyName ? <View style={[styles.tenantBar, { backgroundColor: primaryColor }]}><View style={styles.tenantIdentity}>{agencyLogo ? <Image source={{ uri: agencyLogo }} style={styles.tenantLogo} /> : <View style={styles.tenantLogoFallback}><Text style={styles.tenantLogoFallbackText}>{agencyName.slice(0, 1).toUpperCase()}</Text></View>}<View><Text style={styles.tenantOverline}>APP DO CORRETOR</Text><Text style={styles.tenantText}>{agencyName}</Text></View></View><Pressable style={styles.notificationButton} onPress={() => void clearUnread()}><Text style={styles.notificationIcon}>🔔</Text>{unread > 0 ? <Text style={styles.notificationBadge}>{unread > 99 ? "99+" : unread}</Text> : null}</Pressable></View> : null}{children}</View>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.kicker}>LENOY IMÓVEIS</Text>
          <Text style={styles.title}>{mode === "login" ? "Acesso do corretor" : "Criar conta"}</Text>
          <Text style={styles.text}>{mode === "login" ? "Entre com a conta vinculada à sua imobiliária e ao seu cadastro de corretor." : "A conta será criada sem permissão. O administrador da imobiliária fará o vínculo com o corretor correto."}</Text>
          {mode === "register" ? <><Text style={styles.label}>Nome completo</Text><TextInput style={styles.input} value={fullName} onChangeText={setFullName} autoComplete="name" placeholder="Seu nome" /></> : null}
          <Text style={styles.label}>E-mail</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="corretor@imobiliaria.com.br" />
          <Text style={styles.label}>Senha</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "login" ? "password" : "new-password"} placeholder="Sua senha" />
          {mode === "register" ? <><Text style={styles.label}>Confirmar senha</Text><TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" placeholder="Repita a senha" /></> : null}
          <Pressable style={styles.button} onPress={() => void (mode === "login" ? login() : register())} disabled={loading}><Text style={styles.buttonText}>{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</Text></Pressable>
          <Pressable style={styles.switchButton} onPress={() => { setMode(mode === "login" ? "register" : "login"); setPassword(""); setConfirm(""); }}><Text style={styles.switchText}>{mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}</Text></Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authorizedShell:{flex:1},
  tenantBar:{paddingHorizontal:14,paddingVertical:9,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},
  tenantIdentity:{flexDirection:"row",alignItems:"center",gap:10,flex:1},
  tenantLogo:{width:34,height:34,borderRadius:9,backgroundColor:"#fff"},
  tenantLogoFallback:{width:34,height:34,borderRadius:9,backgroundColor:"rgba(255,255,255,.18)",alignItems:"center",justifyContent:"center"},
  tenantLogoFallbackText:{color:"#fff",fontWeight:"900",fontSize:16},
  tenantOverline:{color:"rgba(255,255,255,.68)",fontSize:8,fontWeight:"900",letterSpacing:1.4},
  tenantText:{color:"#fff",fontSize:12,fontWeight:"900",marginTop:2},
  notificationButton:{width:42,height:38,borderRadius:12,backgroundColor:"rgba(255,255,255,.14)",alignItems:"center",justifyContent:"center",position:"relative"},
  notificationIcon:{fontSize:18},
  notificationBadge:{position:"absolute",right:-4,top:-5,minWidth:19,height:19,borderRadius:10,backgroundColor:"#fff",color:"#17202a",fontSize:9,fontWeight:"900",textAlign:"center",lineHeight:19,paddingHorizontal:4},
  screen:{flex:1,backgroundColor:"#f4f6f8",alignItems:"center",justifyContent:"center",padding:22},
  scroll:{flexGrow:1,alignItems:"center",justifyContent:"center",padding:0,width:"100%"},
  card:{width:"100%",maxWidth:460,backgroundColor:"#fff",borderRadius:24,padding:24},
  kicker:{fontSize:12,fontWeight:"800",letterSpacing:2,color:"#737e88"},
  title:{fontSize:30,fontWeight:"900",color:"#17202a",marginTop:8},
  text:{fontSize:14,lineHeight:21,color:"#68737e",marginTop:8,marginBottom:18},
  label:{fontSize:12,fontWeight:"800",color:"#59646f",marginTop:12,marginBottom:6},
  input:{borderWidth:1,borderColor:"#dbe1e5",borderRadius:12,minHeight:50,paddingHorizontal:14,fontSize:15},
  button:{minHeight:52,borderRadius:13,backgroundColor:"#17202a",alignItems:"center",justifyContent:"center",marginTop:22},
  buttonText:{color:"#fff",fontWeight:"900",fontSize:15},
  switchButton:{minHeight:44,alignItems:"center",justifyContent:"center",marginTop:8},
  switchText:{fontWeight:"800",color:"#365f86"},
  checking:{marginTop:12,color:"#68737e"}
});
