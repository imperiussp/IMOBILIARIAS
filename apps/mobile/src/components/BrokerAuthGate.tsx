import { ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileSupabase, mobileSupabaseConfigured } from "../lib/supabase";

type Props = { children: ReactNode };

export default function BrokerAuthGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function validateSession() {
    if (!mobileSupabase) { setChecking(false); return; }
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
    if (!email.trim() || !password) return Alert.alert("Dados incompletos", "Informe e-mail e senha.");
    setLoading(true);
    const { data, error } = await mobileSupabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setLoading(false);
      return Alert.alert("Não foi possível entrar", "Confira o e-mail e a senha.");
    }
    const { data: broker } = await mobileSupabase.from("brokers").select("id,active").eq("user_id", data.user.id).eq("active", true).maybeSingle();
    if (!broker) {
      await mobileSupabase.auth.signOut();
      setLoading(false);
      return Alert.alert("Acesso não autorizado", "Esta conta não está vinculada a um corretor ativo.");
    }
    setAuthorized(true);
    setLoading(false);
  }

  if (!mobileSupabaseConfigured) return <>{children}</>;
  if (checking) return <SafeAreaView style={styles.screen}><ActivityIndicator size="large" /><Text style={styles.checking}>Verificando acesso...</Text></SafeAreaView>;
  if (authorized) return <>{children}</>;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.kicker}>IMOBILIARIAS</Text>
        <Text style={styles.title}>Acesso do corretor</Text>
        <Text style={styles.text}>Entre com a conta vinculada ao seu cadastro de corretor.</Text>
        <Text style={styles.label}>E-mail</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="corretor@imobiliaria.com.br" />
        <Text style={styles.label}>Senha</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="Sua senha" />
        <Pressable style={styles.button} onPress={() => void login()} disabled={loading}><Text style={styles.buttonText}>{loading ? "Entrando..." : "Entrar"}</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f4f6f8",alignItems:"center",justifyContent:"center",padding:22},
  card:{width:"100%",maxWidth:460,backgroundColor:"#fff",borderRadius:24,padding:24},
  kicker:{fontSize:12,fontWeight:"800",letterSpacing:2,color:"#737e88"},
  title:{fontSize:30,fontWeight:"900",color:"#17202a",marginTop:8},
  text:{fontSize:14,lineHeight:21,color:"#68737e",marginTop:8,marginBottom:18},
  label:{fontSize:12,fontWeight:"800",color:"#59646f",marginTop:12,marginBottom:6},
  input:{borderWidth:1,borderColor:"#dbe1e5",borderRadius:12,minHeight:50,paddingHorizontal:14,fontSize:15},
  button:{minHeight:52,borderRadius:13,backgroundColor:"#17202a",alignItems:"center",justifyContent:"center",marginTop:22},
  buttonText:{color:"#fff",fontWeight:"900",fontSize:15},
  checking:{marginTop:12,color:"#68737e"}
});
