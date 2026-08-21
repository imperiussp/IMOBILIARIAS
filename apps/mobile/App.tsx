import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getOfflineQueue, processOfflineQueue, startNetworkSyncListener } from "./src/services/offlineQueue";
import { getPropertyDrafts, savePropertyDraft } from "./src/services/propertyDrafts";

type Screen = "home" | "new" | "drafts";

export default function App() {
  const [pending, setPending] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  async function refreshCounters() {
    const [queue, drafts] = await Promise.all([getOfflineQueue(), getPropertyDrafts()]);
    setPending(queue.length);
    setDraftCount(drafts.length);
  }

  async function syncNow() {
    setSyncing(true);
    await processOfflineQueue();
    await refreshCounters();
    setSyncing(false);
  }

  async function saveDraft() {
    if (!title.trim() || !city.trim()) {
      Alert.alert("Dados incompletos", "Informe pelo menos o título e a cidade.");
      return;
    }
    await savePropertyDraft({
      title: title.trim(), city: city.trim(), neighborhood: neighborhood.trim(), purpose: "Venda", category: "Casa",
      price: price.trim(), bedrooms: "", bathrooms: "", parking: "", description: description.trim(), photoUris: []
    });
    setTitle(""); setCity(""); setNeighborhood(""); setPrice(""); setDescription("");
    await refreshCounters();
    Alert.alert("Rascunho salvo", "O cadastro ficou armazenado neste aparelho e pode ser concluído depois.");
    setScreen("home");
  }

  useEffect(() => {
    void refreshCounters();
    const unsubscribe = startNetworkSyncListener();
    const timer = setInterval(() => void refreshCounters(), 5000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);

  if (screen === "new") {
    return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => setScreen("home")}><Text style={styles.back}>← Voltar</Text></Pressable>
      <View style={styles.formCard}>
        <Text style={styles.kickerDark}>NOVO IMÓVEL</Text><Text style={styles.formTitle}>Cadastro em campo</Text>
        <Text style={styles.formText}>Você pode preencher agora e salvar mesmo sem internet.</Text>
        <Text style={styles.label}>Título</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Casa com 3 quartos" />
        <Text style={styles.label}>Cidade</Text><TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Sengés - PR" />
        <Text style={styles.label}>Bairro</Text><TextInput style={styles.input} value={neighborhood} onChangeText={setNeighborhood} placeholder="Centro" />
        <Text style={styles.label}>Valor</Text><TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="R$ 0,00" keyboardType="numeric" />
        <Text style={styles.label}>Descrição</Text><TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Características do imóvel" multiline />
        <Pressable style={styles.saveButton} onPress={() => void saveDraft()}><Text style={styles.saveButtonText}>Salvar rascunho offline</Text></Pressable>
      </View>
    </ScrollView></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.kicker}>IMOBILIARIAS</Text><Text style={styles.title}>Painel do corretor</Text><Text style={styles.text}>Cadastre imóveis em campo, mesmo sem internet.</Text></View><View style={styles.syncBadge}><Text style={styles.syncNumber}>{pending}</Text><Text style={styles.syncLabel}>pendentes</Text></View></View>
      <View style={styles.grid}>
        <Pressable style={styles.primaryCard} onPress={() => setScreen("new")}><Text style={styles.primaryCardIcon}>＋</Text><Text style={styles.primaryCardTitle}>Novo imóvel</Text><Text style={styles.primaryCardText}>Cadastrar dados e salvar offline.</Text></Pressable>
        <Pressable style={styles.card}><Text style={styles.cardIcon}>⌂</Text><Text style={styles.cardTitle}>Meus imóveis</Text><Text style={styles.cardText}>Acompanhar publicados e sincronizados.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => setScreen("drafts")}><Text style={styles.cardIcon}>▧</Text><Text style={styles.cardTitle}>Rascunhos ({draftCount})</Text><Text style={styles.cardText}>Cadastros salvos neste aparelho.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => void syncNow()}><Text style={styles.cardIcon}>↻</Text><Text style={styles.cardTitle}>{syncing ? "Sincronizando..." : "Sincronizar agora"}</Text><Text style={styles.cardText}>Enviar automaticamente o que ficou offline.</Text></Pressable>
      </View>
      {screen === "drafts" ? <View style={styles.infoCard}><Text style={styles.infoTitle}>Rascunhos locais</Text><Text style={styles.infoText}>Existem {draftCount} cadastro(s) salvo(s) neste aparelho. A tela de edição completa será conectada à próxima etapa do fluxo.</Text><Pressable onPress={() => setScreen("home")}><Text style={styles.back}>Fechar</Text></Pressable></View> : null}
      <View style={styles.infoCard}><Text style={styles.infoTitle}>Modo offline preparado</Text><Text style={styles.infoText}>Se a conexão cair durante um cadastro, os dados permanecem locais. Quando o envio estiver pronto, a fila de sincronização evita duplicações.</Text></View>
    </ScrollView></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f4f6f8"},content:{padding:20,gap:18},header:{backgroundColor:"#17202a",borderRadius:24,padding:24,flexDirection:"row",justifyContent:"space-between",gap:16},kicker:{fontSize:12,fontWeight:"800",letterSpacing:2,color:"#aeb7c0"},kickerDark:{fontSize:12,fontWeight:"800",letterSpacing:2,color:"#6b7580"},title:{fontSize:32,lineHeight:36,fontWeight:"800",marginTop:10,color:"#fff"},text:{fontSize:15,lineHeight:22,marginTop:10,color:"#cbd2d8",maxWidth:260},syncBadge:{minWidth:78,alignSelf:"flex-start",backgroundColor:"#fff",borderRadius:18,padding:12,alignItems:"center"},syncNumber:{fontSize:26,fontWeight:"900",color:"#17202a"},syncLabel:{fontSize:11,color:"#69737d"},grid:{flexDirection:"row",flexWrap:"wrap",gap:12},primaryCard:{width:"48%",minHeight:160,backgroundColor:"#17202a",borderRadius:20,padding:20},card:{width:"48%",minHeight:160,backgroundColor:"#fff",borderRadius:20,padding:20},primaryCardIcon:{fontSize:30,color:"#fff"},primaryCardTitle:{fontSize:19,fontWeight:"800",color:"#fff",marginTop:22},primaryCardText:{fontSize:13,lineHeight:19,color:"#cbd2d8",marginTop:6},cardIcon:{fontSize:28,color:"#17202a"},cardTitle:{fontSize:18,fontWeight:"800",color:"#17202a",marginTop:22},cardText:{fontSize:13,lineHeight:19,color:"#68737e",marginTop:6},infoCard:{backgroundColor:"#fff",borderRadius:20,padding:20},infoTitle:{fontSize:18,fontWeight:"800",color:"#17202a"},infoText:{fontSize:14,lineHeight:22,color:"#65717c",marginTop:8},back:{fontSize:15,fontWeight:"800",color:"#17202a",paddingVertical:8},formCard:{backgroundColor:"#fff",borderRadius:22,padding:22},formTitle:{fontSize:30,fontWeight:"800",color:"#17202a",marginTop:8},formText:{fontSize:14,lineHeight:21,color:"#68737e",marginTop:8,marginBottom:18},label:{fontSize:12,fontWeight:"800",color:"#5e6974",marginTop:12,marginBottom:6},input:{borderWidth:1,borderColor:"#dce2e7",borderRadius:12,paddingHorizontal:13,minHeight:48,backgroundColor:"#fff"},textarea:{minHeight:110,paddingTop:12,textAlignVertical:"top"},saveButton:{backgroundColor:"#17202a",borderRadius:12,minHeight:50,alignItems:"center",justifyContent:"center",marginTop:20},saveButtonText:{color:"#fff",fontWeight:"800",fontSize:15}
});
