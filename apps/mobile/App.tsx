import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import BrokerAuthGate from "./src/components/BrokerAuthGate";
import { enqueueOfflineJob, getOfflineQueue, processOfflineQueue, startNetworkSyncListener } from "./src/services/offlineQueue";
import { getPropertyDrafts, PropertyDraft, removePropertyDraft, savePropertyDraft } from "./src/services/propertyDrafts";

type Screen = "home" | "editor" | "drafts";

const emptyDraft = (): Omit<PropertyDraft, "id" | "updatedAt"> => ({
  title: "", city: "", neighborhood: "", purpose: "Venda", category: "Casa", price: "",
  bedrooms: "0", bathrooms: "0", parking: "0", description: "", photoUris: [],
});

function BrokerApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [drafts, setDrafts] = useState<PropertyDraft[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyDraft());

  async function refreshAll() {
    const [queue, storedDrafts] = await Promise.all([getOfflineQueue(), getPropertyDrafts()]);
    setPending(queue.length); setDrafts(storedDrafts);
  }

  async function syncNow() {
    setSyncing(true);
    const result = await processOfflineQueue();
    await refreshAll();
    setSyncing(false);
    if (result.processed > 0) Alert.alert("Sincronização concluída", `${result.processed} item(ns) enviado(s).`);
    else if (result.pending > 0) Alert.alert("Sincronização pendente", "Ainda existem itens aguardando conexão, vínculo do corretor ou correção de dados.");
  }

  useEffect(() => {
    void refreshAll();
    const unsubscribe = startNetworkSyncListener();
    const timer = setInterval(() => void refreshAll(), 5000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);

  const canPublish = useMemo(() => Boolean(form.title.trim() && form.city.trim() && form.category), [form]);

  function openNew() { setEditingId(undefined); setForm(emptyDraft()); setScreen("editor"); }
  function openDraft(draft: PropertyDraft) {
    setEditingId(draft.id);
    const { id: _id, updatedAt: _updatedAt, ...data } = draft;
    setForm(data); setScreen("editor");
  }

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permissão necessária", "Autorize o acesso às fotos para anexar imagens do imóvel.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.75 });
    if (!result.canceled) setForm((current) => ({ ...current, photoUris: [...current.photoUris, ...result.assets.map((asset) => asset.uri)].slice(0, 20) }));
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permissão necessária", "Autorize a câmera para fotografar o imóvel.");
    const result = await ImagePicker.launchCameraAsync({ quality: 0.75 });
    if (!result.canceled) setForm((current) => ({ ...current, photoUris: [...current.photoUris, result.assets[0].uri].slice(0, 20) }));
  }

  async function saveDraftOnly() {
    const saved = await savePropertyDraft({ ...form, id: editingId });
    setEditingId(saved.id); await refreshAll();
    Alert.alert("Rascunho salvo", "O cadastro ficou guardado neste aparelho e pode ser continuado depois.");
  }

  async function queueForPublish() {
    if (!canPublish) return Alert.alert("Dados incompletos", "Preencha pelo menos título, cidade e tipo do imóvel.");
    const saved = await savePropertyDraft({ ...form, id: editingId });
    await enqueueOfflineJob({ clientOperationId: `publish-${saved.id}`, entityType: "property_draft", entityLocalId: saved.id, payload: saved as unknown as Record<string, unknown> });
    await refreshAll(); setScreen("home");
    Alert.alert("Pronto para sincronizar", "O imóvel entrou na fila e será enviado quando houver internet.");
    void syncNow();
  }

  async function deleteDraft(id: string) { await removePropertyDraft(id); await refreshAll(); }

  if (screen === "editor") return (
    <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.editorHeader}><Pressable onPress={() => setScreen("home")}><Text style={styles.back}>← Voltar</Text></Pressable><Text style={styles.editorTitle}>{editingId ? "Editar rascunho" : "Novo imóvel"}</Text></View>
      <View style={styles.formCard}>
        <Field label="Título" value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder="Casa com 3 quartos no Centro" />
        <View style={styles.choiceRow}>{(["Venda", "Locação"] as const).map((item) => <Choice key={item} selected={form.purpose === item} label={item} onPress={() => setForm({ ...form, purpose: item })} />)}</View>
        <View style={styles.choiceWrap}>{(["Casa", "Apartamento", "Comercial", "Rural"] as const).map((item) => <Choice key={item} selected={form.category === item} label={item} onPress={() => setForm({ ...form, category: item })} />)}</View>
        <Field label="Cidade" value={form.city} onChangeText={(city) => setForm({ ...form, city })} placeholder="Sengés - PR" />
        <Field label="Bairro" value={form.neighborhood} onChangeText={(neighborhood) => setForm({ ...form, neighborhood })} placeholder="Centro" />
        <Field label="Valor" value={form.price} onChangeText={(price) => setForm({ ...form, price })} placeholder="485000" keyboardType="decimal-pad" />
        <View style={styles.tripleRow}><MiniField label="Quartos" value={form.bedrooms} onChangeText={(bedrooms) => setForm({ ...form, bedrooms })} /><MiniField label="Banheiros" value={form.bathrooms} onChangeText={(bathrooms) => setForm({ ...form, bathrooms })} /><MiniField label="Vagas" value={form.parking} onChangeText={(parking) => setForm({ ...form, parking })} /></View>
        <Text style={styles.label}>Descrição</Text><TextInput multiline numberOfLines={5} style={[styles.input, styles.textarea]} value={form.description} onChangeText={(description) => setForm({ ...form, description })} placeholder="Destaques e informações do imóvel" textAlignVertical="top" />
        <View style={styles.photoHeader}><View><Text style={styles.label}>Fotos</Text><Text style={styles.help}>{form.photoUris.length}/20 imagens</Text></View><View style={styles.photoActions}><Pressable style={styles.smallAction} onPress={() => void takePhoto()}><Text>📷 Câmera</Text></Pressable><Pressable style={styles.smallAction} onPress={() => void pickPhotos()}><Text>🖼 Galeria</Text></Pressable></View></View>
        {form.photoUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>{form.photoUris.map((uri, index) => <View key={`${uri}-${index}`} style={styles.photoItem}><Image source={{ uri }} style={styles.photo} /><Pressable style={styles.removePhoto} onPress={() => setForm((current) => ({ ...current, photoUris: current.photoUris.filter((_, i) => i !== index) }))}><Text style={styles.removePhotoText}>×</Text></Pressable>{index === 0 && <Text style={styles.coverLabel}>CAPA</Text>}</View>)}</ScrollView>}
        <Pressable style={styles.secondaryButton} onPress={() => void saveDraftOnly()}><Text style={styles.secondaryButtonText}>Salvar rascunho offline</Text></Pressable>
        <Pressable style={[styles.primaryButton, !canPublish && styles.disabled]} onPress={() => void queueForPublish()}><Text style={styles.primaryButtonText}>Publicar / sincronizar</Text></Pressable>
      </View>
    </ScrollView></SafeAreaView>
  );

  if (screen === "drafts") return (
    <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
      <View style={styles.editorHeader}><Pressable onPress={() => setScreen("home")}><Text style={styles.back}>← Voltar</Text></Pressable><Text style={styles.editorTitle}>Rascunhos</Text></View>
      {drafts.length === 0 ? <View style={styles.infoCard}><Text style={styles.infoTitle}>Nenhum rascunho</Text><Text style={styles.infoText}>Os cadastros salvos sem internet aparecerão aqui.</Text></View> : drafts.map((draft) => <View key={draft.id} style={styles.draftCard}><View style={styles.draftInfo}><Text style={styles.draftTitle}>{draft.title || "Imóvel sem título"}</Text><Text style={styles.draftMeta}>{draft.city || "Cidade não informada"} · {draft.photoUris.length} foto(s)</Text></View><View style={styles.draftActions}><Pressable onPress={() => openDraft(draft)}><Text style={styles.editLink}>Editar</Text></Pressable><Pressable onPress={() => void deleteDraft(draft.id)}><Text style={styles.deleteLink}>Excluir</Text></Pressable></View></View>)}
    </ScrollView></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.kicker}>IMOBILIARIAS</Text><Text style={styles.title}>Painel do corretor</Text><Text style={styles.text}>Cadastre imóveis, fotografe e continue trabalhando mesmo sem sinal.</Text></View><View style={styles.syncBadge}><Text style={styles.syncNumber}>{pending}</Text><Text style={styles.syncLabel}>pendentes</Text></View></View>
      <View style={styles.grid}>
        <Pressable style={styles.primaryCard} onPress={openNew}><Text style={styles.primaryCardIcon}>＋</Text><Text style={styles.primaryCardTitle}>Novo imóvel</Text><Text style={styles.primaryCardText}>Dados, fotos e salvamento offline.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => setScreen("drafts")}><Text style={styles.cardIcon}>▧</Text><Text style={styles.cardTitle}>Rascunhos</Text><Text style={styles.cardText}>{drafts.length} cadastro(s) salvo(s) neste aparelho.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => void syncNow()}><Text style={styles.cardIcon}>↻</Text><Text style={styles.cardTitle}>{syncing ? "Sincronizando..." : "Sincronizar agora"}</Text><Text style={styles.cardText}>Tenta enviar todos os itens pendentes.</Text></Pressable>
        <View style={styles.card}><Text style={styles.cardIcon}>✓</Text><Text style={styles.cardTitle}>Fila segura</Text><Text style={styles.cardText}>Identificadores estáveis evitam duplicidade no envio.</Text></View>
      </View>
      <View style={styles.infoCard}><Text style={styles.infoTitle}>Offline de verdade</Text><Text style={styles.infoText}>Fotos e dados ficam no aparelho. Quando a conexão voltar, a fila resolve os vínculos do imóvel e envia tudo automaticamente.</Text></View>
    </ScrollView></SafeAreaView>
  );
}

export default function App() {
  return <BrokerAuthGate><BrokerApp /></BrokerAuthGate>;
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: "default" | "decimal-pad" }) { return <View><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} keyboardType={props.keyboardType || "default"} /></View>; }
function MiniField(props: { label: string; value: string; onChangeText: (value: string) => void }) { return <View style={styles.miniField}><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} keyboardType="number-pad" /></View>; }
function Choice(props: { selected: boolean; label: string; onPress: () => void }) { return <Pressable style={[styles.choice, props.selected && styles.choiceSelected]} onPress={props.onPress}><Text style={[styles.choiceText, props.selected && styles.choiceTextSelected]}>{props.label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f4f6f8"},content:{padding:20,gap:18},header:{backgroundColor:"#17202a",borderRadius:24,padding:24,flexDirection:"row",justifyContent:"space-between",gap:16},kicker:{fontSize:12,fontWeight:"800",letterSpacing:2,color:"#aeb7c0"},title:{fontSize:32,lineHeight:36,fontWeight:"800",marginTop:10,color:"#fff"},text:{fontSize:15,lineHeight:22,marginTop:10,color:"#cbd2d8",maxWidth:260},syncBadge:{minWidth:78,alignSelf:"flex-start",backgroundColor:"#fff",borderRadius:18,padding:12,alignItems:"center"},syncNumber:{fontSize:26,fontWeight:"900",color:"#17202a"},syncLabel:{fontSize:11,color:"#69737d"},grid:{flexDirection:"row",flexWrap:"wrap",gap:12},primaryCard:{width:"48%",minHeight:160,backgroundColor:"#17202a",borderRadius:20,padding:20},card:{width:"48%",minHeight:160,backgroundColor:"#fff",borderRadius:20,padding:20},primaryCardIcon:{fontSize:30,color:"#fff"},primaryCardTitle:{fontSize:19,fontWeight:"800",color:"#fff",marginTop:22},primaryCardText:{fontSize:13,lineHeight:19,color:"#cbd2d8",marginTop:6},cardIcon:{fontSize:28,color:"#17202a"},cardTitle:{fontSize:18,fontWeight:"800",color:"#17202a",marginTop:22},cardText:{fontSize:13,lineHeight:19,color:"#68737e",marginTop:6},infoCard:{backgroundColor:"#fff",borderRadius:20,padding:20},infoTitle:{fontSize:18,fontWeight:"800",color:"#17202a"},infoText:{fontSize:14,lineHeight:22,color:"#65717c",marginTop:8},editorHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:14},back:{fontSize:15,fontWeight:"800",color:"#5e6974"},editorTitle:{fontSize:24,fontWeight:"900",color:"#17202a"},formCard:{backgroundColor:"#fff",borderRadius:22,padding:20,gap:16},label:{fontSize:12,fontWeight:"800",color:"#56616c",marginBottom:7},help:{fontSize:11,color:"#85909a"},input:{borderWidth:1,borderColor:"#dce1e5",borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:"#17202a",backgroundColor:"#fff"},textarea:{minHeight:110},choiceRow:{flexDirection:"row",gap:10},choiceWrap:{flexDirection:"row",flexWrap:"wrap",gap:8},choice:{paddingVertical:10,paddingHorizontal:14,borderRadius:999,borderWidth:1,borderColor:"#dce1e5",backgroundColor:"#fff"},choiceSelected:{backgroundColor:"#17202a",borderColor:"#17202a"},choiceText:{fontWeight:"800",color:"#56616c"},choiceTextSelected:{color:"#fff"},tripleRow:{flexDirection:"row",gap:9},miniField:{flex:1},photoHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},photoActions:{flexDirection:"row",gap:8},smallAction:{backgroundColor:"#f1f4f6",borderRadius:10,paddingHorizontal:10,paddingVertical:9},photoStrip:{gap:10},photoItem:{width:120,height:100,borderRadius:14,overflow:"hidden",position:"relative",backgroundColor:"#eef1f3"},photo:{width:"100%",height:"100%"},removePhoto:{position:"absolute",right:5,top:5,width:26,height:26,borderRadius:13,backgroundColor:"rgba(23,32,42,.85)",alignItems:"center",justifyContent:"center"},removePhotoText:{color:"#fff",fontSize:20,lineHeight:21},coverLabel:{position:"absolute",left:6,bottom:6,backgroundColor:"#fff",paddingHorizontal:7,paddingVertical:4,borderRadius:7,fontSize:9,fontWeight:"900"},secondaryButton:{minHeight:50,borderRadius:13,borderWidth:1,borderColor:"#ccd3d9",alignItems:"center",justifyContent:"center"},secondaryButtonText:{fontWeight:"900",color:"#17202a"},primaryButton:{minHeight:52,borderRadius:13,backgroundColor:"#17202a",alignItems:"center",justifyContent:"center"},primaryButtonText:{fontWeight:"900",color:"#fff"},disabled:{opacity:.5},draftCard:{backgroundColor:"#fff",borderRadius:18,padding:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:14},draftInfo:{flex:1},draftTitle:{fontSize:17,fontWeight:"900",color:"#17202a"},draftMeta:{fontSize:12,color:"#76818b",marginTop:5},draftActions:{flexDirection:"row",gap:13},editLink:{fontWeight:"800",color:"#245f9b"},deleteLink:{fontWeight:"800",color:"#a13b3b"}
});
