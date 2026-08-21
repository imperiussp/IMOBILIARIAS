import { ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { isImobiliariasBackend } from "../lib/projectGuard";
import { mobileSupabase, mobileSupabaseConfigured } from "../lib/supabase";

type Props = { children: ReactNode };
type Mode = "login" | "register";

export default function BrokerAuthGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [backendValid, setBackendValid] = useState(true);
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function validateSession() {
    if (!mobileSupabase) { setChecking(false); return; }
    const validBackend = await isImobiliariasBackend();
    setBackendValid(validBackend);
    if (!validBackend) { setAuthorized(false); setChecking(false); return; }
    const { data } = await mobileSupabase.auth.getSession();
    const user = data.session?.user;
    if (!user) { setAuthorized(false); setChecking(false); return; }
    const { data: broker } = await mobileSupabase.from("brokers").select("id,active").eq("user_id", user.id).eq("active", true).maybeSingle();
    setAuthorized(Boolean(broker));
    setChecking(false);
  }

  useEffect(() => {
    void validateSession();
    if (!mobileSupabase) return;
    const { data } = mobileSupabase.auth.onAuthStateChange(() => void validateSession());
    return () => data.subscription.unsubscribe();
  }, []);

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
    const { data: broker } = await mobileSupabase.from("brokers").select("id,active").eq("user_id", data.user.id).eq("active", true).maybeSingle();
    if (!broker) {
      await mobileSupabase.auth.signOut();
      setLoading(false);
      return Alert.alert("Aguardando liberação", "Sua conta existe, mas ainda precisa ser vinculada a um corretor ativo pelo administrador.");
    }
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
    Alert.alert("Conta criada", "Confirme seu e-mail, se solicitado. Depois o administrador precisa vincular esta conta ao seu cadastro de corretor.");
  }

  if (!mobileSupabaseConfigured) return <>{children}</>;
  if (checking) return <SafeAreaView style={styles.screen}><ActivityIndicator size="large" /><Text style={styles.checking}>Verificando acesso e projeto...</Text></SafeAreaView>;
  if (!backendValid) return <SafeAreaView style={styles.screen}><View style={styles.card}><Text style={styles.kicker}>PROTEÇÃO DE PROJETO</Text><Text style={styles.title}>Conexão bloqueada</Text><Text style={styles.text}>O servidor configurado não se identificou como IMOBILIARIAS. O aplicativo não acessará nem enviará dados até a configuração correta ser instalada.</Text></View></SafeAreaView>;
  if (authorized) return <>{children}</>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.kicker}>IMOBILIARIAS</Text>
          <Text style={styles.title}>{mode === "login" ? "Acesso do corretor" : "Criar conta"}</Text>
          <Text style={styles.text}>{mode === "login" ? "Entre com a conta vinculada ao seu cadastro de corretor." : "A conta será criada sem permissão. O administrador fará o vínculo com o corretor correto."}</Text>
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
