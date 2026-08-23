import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as ImagePicker from "expo-image-picker";
import BrokerAuthGate from "./src/components/BrokerAuthGate";
import BrokerLeads from "./src/components/BrokerLeads";
import PublishedProperties from "./src/components/PublishedProperties";
import { mobileSupabase } from "./src/lib/supabase";
import { enqueueOfflineJob, getOfflineQueue, processOfflineQueue, retryFailedJobs } from "./src/services/offlineQueue";
import { getPropertyDrafts, PropertyDraft, removePropertyDraft, savePropertyDraft } from "./src/services/propertyDrafts";

type Screen = "home" | "editor" | "drafts" | "published" | "queue" | "leads";

const emptyDraft = (): Omit<PropertyDraft, "id" | "updatedAt"> => ({
  title: "", city: "", neighborhood: "", purpose: "Venda", category: "Casa", segment: "Residencial", zone: "Urbana", price: "",
  bedrooms: "0", suites: "0", bathrooms: "0", parking: "0", builtArea: "", landArea: "", address: "", addressPublic: false,
  description: "", photoUris: [],
});

function BrokerApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [drafts, setDrafts] = useState<PropertyDraft[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyDraft());
  const [queue, setQueue] = useState(awaitableEmptyQueue());

  async function refreshAll() {
    const [storedQueue, storedDrafts] = await Promise.all([getOfflineQueue(), getPropertyDrafts()]);
    setQueue(storedQueue);
    setPending(storedQueue.length);
    setFailed(storedQueue.filter((item) => item.state === "error").length);
    setDrafts(storedDrafts);
  }

  async function syncNow(allowCellular = false, silent = false) {
    if (syncing) return;
    const network = await NetInfo.fetch();
    if (!network.isConnected) {
      await refreshAll();
      if (!silent) Alert.alert("Sem conexão", "Os itens continuam salvos no aparelho e serão enviados quando a internet voltar.");
      return;
    }

    if (network.type === "cellular" && !allowCellular) {
      const storedQueue = await getOfflineQueue();
      if (!storedQueue.length) return;
      Alert.alert(
        "Usar dados móveis?",
        `Existem ${storedQueue.length} item(ns) para enviar, incluindo fotos. Deseja enviar agora usando seus dados móveis ou aguardar uma conexão Wi-Fi?`,
        [
          { text: "Aguardar Wi-Fi", style: "cancel" },
          { text: "Enviar pelos dados", onPress: () => void syncNow(true) },
        ],
      );
      return;
    }

    setSyncing(true);
    const result = await processOfflineQueue();
    await refreshAll();
    setSyncing(false);
    if (!silent && result.processed > 0) Alert.alert("Sincronização concluída", `${result.processed} item(ns) enviado(s).`);
    else if (!silent && result.pending > 0) Alert.alert("Sincronização pendente", "Ainda existem itens aguardando conexão ou correção de dados.");
  }

  async function retryQueue(allowCellular = false) {
    const network = await NetInfo.fetch();
    if (!network.isConnected) return Alert.alert("Sem conexão", "A fila continuará guardada neste aparelho.");
    if (network.type === "cellular" && !allowCellular) {
      Alert.alert("Usar dados móveis?", "A nova tentativa pode enviar fotos e consumir seu pacote de dados.", [
        { text: "Aguardar Wi-Fi", style: "cancel" },
        { text: "Enviar pelos dados", onPress: () => void retryQueue(true) },
      ]);
      return;
    }
    setSyncing(true);
    await retryFailedJobs();
    await refreshAll();
    setSyncing(false);
  }

  async function signOut() {
    if (!mobileSupabase) return;
    await mobileSupabase.auth.signOut();
  }

  useEffect(() => {
    void refreshAll();
    let wasConnected = false;
    let previousType = "unknown";
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected);
      const connectionChanged = connected && (!wasConnected || state.type !== previousType);
      if (connectionChanged && (state.type === "wifi" || state.type === "ethernet")) void syncNow(true, true);
      if (connectionChanged && state.type === "cellular") void syncNow(false, true);
      wasConnected = connected;
      previousType = state.type;
    });
    const timer = setInterval(() => void refreshAll(), 5000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);

  const canPublish = useMemo(() => Boolean(form.title.trim() && form.city.trim() && form.category && form.price.trim()), [form]);

  function openNew() { setEditingId(undefined); setForm(emptyDraft()); setScreen("editor"); }
  function openDraft(draft: PropertyDraft) {
    setEditingId(draft.id);
    const { id: _id, updatedAt: _updatedAt, ...data } = draft;
    setForm({ ...emptyDraft(), ...data });
    setScreen("editor");
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

  function movePhoto(index: number, direction: -1 | 1) {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.photoUris.length) return current;
      const photoUris = [...current.photoUris];
      [photoUris[index], photoUris[target]] = [photoUris[target], photoUris[index]];
      return { ...current, photoUris };
    });
  }

  async function saveDraftOnly() {
    const saved = await savePropertyDraft({ ...form, id: editingId });
    setEditingId(saved.id);
    await refreshAll();
    Alert.alert("Rascunho salvo", "O cadastro ficou guardado neste aparelho e pode ser continuado depois.");
  }

  async function queueForPublish() {
    if (!canPublish) return Alert.alert("Dados incompletos", "Preencha título, cidade, tipo e valor do imóvel.");
    const saved = await savePropertyDraft({ ...form, id: editingId });
    try {
      await enqueueOfflineJob({ clientOperationId: `publish-${saved.id}`, entityType: "property_draft", entityLocalId: saved.id, payload: saved as unknown as Record<string, unknown> });
    } catch (error) {
      return Alert.alert("Não foi possível preparar a sincronização", error instanceof Error ? error.message : String(error));
    }
    await refreshAll();
    setScreen("home");
    Alert.alert("Pronto para sincronizar", "O imóvel entrou na fila. No Wi-Fi o envio é automático; em dados móveis o aplicativo pede sua confirmação.");
    void syncNow();
  }

  async function deleteDraft(id: string) {
    Alert.alert("Excluir rascunho?", "As fotos e dados locais deste rascunho deixarão de aparecer no aplicativo.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => void removePropertyDraft(id).then(refreshAll) },
    ]);
  }

  if (screen === "published") return <SafeAreaView style={styles.screen}><PublishedProperties onClose={() => setScreen("home")} /></SafeAreaView>;
  if (screen === "leads") return <SafeAreaView style={styles.screen}><BrokerLeads onClose={() => setScreen("home")} /></SafeAreaView>;

  if (screen === "queue") return (
    <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
      <View style={styles.editorHero}><Pressable onPress={() => setScreen("home")}><Text style={styles.backLight}>← Voltar</Text></Pressable><Text style={styles.editorHeroKicker}>SINCRONIZAÇÃO</Text><Text style={styles.editorHeroTitle}>Fila offline</Text><Text style={styles.editorHeroText}>Acompanhe o que está aguardando internet, envio ou nova tentativa.</Text></View>
      <View style={styles.infoCard}><View style={styles.infoIcon}><Text style={styles.infoIconText}>↻</Text></View><View style={{flex:1}}><Text style={styles.infoTitle}>Controle de internet</Text><Text style={styles.infoText}>No Wi-Fi a fila é enviada automaticamente. Em dados móveis, você escolhe se quer enviar naquele momento.</Text></View></View>
      {queue.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyIcon}>✓</Text><Text style={styles.infoTitle}>Tudo sincronizado</Text><Text style={styles.infoText}>Não há operações pendentes.</Text></View> : queue.map((job) => <View style={styles.queueCard} key={job.clientOperationId}><View style={styles.queueHead}><View style={{flex:1}}><Text style={styles.draftTitle}>{job.entityType === "property_draft" ? "Publicação de imóvel" : "Sincronização"}</Text><Text style={styles.draftMeta}>Tentativas: {job.attempts}</Text></View><Text style={[styles.queueState, job.state === "error" && styles.queueError]}>{job.state === "error" ? "ERRO" : job.state === "syncing" ? "ENVIANDO" : "PENDENTE"}</Text></View>{job.lastError ? <Text style={styles.errorText}>{job.lastError}</Text> : null}</View>)}
      {failed > 0 ? <Pressable style={styles.primaryButton} onPress={() => void retryQueue()}><Text style={styles.primaryButtonText}>{syncing ? "Tentando..." : `Tentar novamente (${failed})`}</Text></Pressable> : null}
    </ScrollView></SafeAreaView>
  );

  if (screen === "editor") return (
    <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.editorHero}><Pressable onPress={() => setScreen("home")}><Text style={styles.backLight}>← Voltar</Text></Pressable><Text style={styles.editorHeroKicker}>CADASTRO DE IMÓVEL</Text><Text style={styles.editorHeroTitle}>{editingId ? "Editar rascunho" : "Novo imóvel"}</Text><Text style={styles.editorHeroText}>Preencha o essencial, fotografe e publique agora ou deixe salvo offline.</Text></View>
      <View style={styles.formCard}>
        <Field label="Título" value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder="Casa com 3 quartos no Centro" />
        <Text style={styles.groupTitle}>Finalidade</Text><View style={styles.choiceRow}>{(["Venda", "Locação"] as const).map((item) => <Choice key={item} selected={form.purpose === item} label={item} onPress={() => setForm({ ...form, purpose: item })} />)}</View>
        <Text style={styles.groupTitle}>Tipo</Text><View style={styles.choiceWrap}>{(["Casa", "Apartamento", "Comercial", "Rural"] as const).map((item) => <Choice key={item} selected={form.category === item} label={item} onPress={() => setForm({ ...form, category: item, segment: item === "Comercial" ? "Comercial" : form.segment, zone: item === "Rural" ? "Rural" : form.zone })} />)}</View>
        <Text style={styles.groupTitle}>Uso</Text><View style={styles.choiceRow}>{(["Residencial", "Comercial"] as const).map((item) => <Choice key={item} selected={form.segment === item} label={item} onPress={() => setForm({ ...form, segment: item })} />)}</View>
        <Text style={styles.groupTitle}>Zona</Text><View style={styles.choiceRow}>{(["Urbana", "Rural"] as const).map((item) => <Choice key={item} selected={form.zone === item} label={item} onPress={() => setForm({ ...form, zone: item })} />)}</View>
        <Field label="Cidade" value={form.city} onChangeText={(city) => setForm({ ...form, city })} placeholder="Cidade - UF" />
        <Field label="Bairro" value={form.neighborhood} onChangeText={(neighborhood) => setForm({ ...form, neighborhood })} placeholder="Centro" />
        <Field label="Endereço" value={form.address || ""} onChangeText={(address) => setForm({ ...form, address })} placeholder="Rua, número e complemento" />
        <View style={styles.choiceRow}><Choice selected={!form.addressPublic} label="Endereço privado" onPress={() => setForm({ ...form, addressPublic: false })} /><Choice selected={Boolean(form.addressPublic)} label="Exibir endereço" onPress={() => setForm({ ...form, addressPublic: true })} /></View>
        <Field label="Valor" value={form.price} onChangeText={(price) => setForm({ ...form, price })} placeholder="485000" keyboardType="decimal-pad" />
        <View style={styles.tripleRow}><MiniField label="Quartos" value={form.bedrooms} onChangeText={(bedrooms) => setForm({ ...form, bedrooms })} /><MiniField label="Suítes" value={form.suites || "0"} onChangeText={(suites) => setForm({ ...form, suites })} /><MiniField label="Banheiros" value={form.bathrooms} onChangeText={(bathrooms) => setForm({ ...form, bathrooms })} /></View>
        <View style={styles.tripleRow}><MiniField label="Vagas" value={form.parking} onChangeText={(parking) => setForm({ ...form, parking })} /><MiniField label="Área const." value={form.builtArea || ""} onChangeText={(builtArea) => setForm({ ...form, builtArea })} decimal /><MiniField label="Terreno" value={form.landArea || ""} onChangeText={(landArea) => setForm({ ...form, landArea })} decimal /></View>
        <Text style={styles.label}>Descrição</Text><TextInput multiline numberOfLines={5} style={[styles.input, styles.textarea]} value={form.description} onChangeText={(description) => setForm({ ...form, description })} placeholder="Destaques e informações do imóvel" placeholderTextColor="#98a2ab" textAlignVertical="top" />
        <View style={styles.photoHeader}><View><Text style={styles.label}>Fotos</Text><Text style={styles.help}>{form.photoUris.length}/20 imagens · a primeira é a capa</Text></View><View style={styles.photoActions}><Pressable style={styles.smallAction} onPress={() => void takePhoto()}><Text style={styles.smallActionText}>📷 Câmera</Text></Pressable><Pressable style={styles.smallAction} onPress={() => void pickPhotos()}><Text style={styles.smallActionText}>🖼 Galeria</Text></Pressable></View></View>
        {form.photoUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>{form.photoUris.map((uri, index) => <View key={`${uri}-${index}`} style={styles.photoItem}><Image source={{ uri }} style={styles.photo} /><Pressable style={styles.removePhoto} onPress={() => setForm((current) => ({ ...current, photoUris: current.photoUris.filter((_, i) => i !== index) }))}><Text style={styles.removePhotoText}>×</Text></Pressable>{index === 0 && <Text style={styles.coverLabel}>CAPA</Text>}<View style={styles.photoMove}><Pressable onPress={() => movePhoto(index, -1)}><Text style={styles.photoMoveText}>←</Text></Pressable><Pressable onPress={() => movePhoto(index, 1)}><Text style={styles.photoMoveText}>→</Text></Pressable></View></View>)}</ScrollView>}
        <Pressable style={styles.secondaryButton} onPress={() => void saveDraftOnly()}><Text style={styles.secondaryButtonText}>Salvar rascunho offline</Text></Pressable>
        <Pressable style={[styles.primaryButton, !canPublish && styles.disabled]} onPress={() => void queueForPublish()}><Text style={styles.primaryButtonText}>Publicar / sincronizar</Text></Pressable>
      </View>
    </ScrollView></SafeAreaView>
  );

  if (screen === "drafts") return (
    <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
      <View style={styles.editorHero}><Pressable onPress={() => setScreen("home")}><Text style={styles.backLight}>← Voltar</Text></Pressable><Text style={styles.editorHeroKicker}>TRABALHO OFFLINE</Text><Text style={styles.editorHeroTitle}>Rascunhos</Text><Text style={styles.editorHeroText}>{drafts.length} cadastro(s) preservado(s) neste aparelho.</Text></View>
      {drafts.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyIcon}>▧</Text><Text style={styles.infoTitle}>Nenhum rascunho</Text><Text style={styles.infoText}>Os cadastros salvos sem internet aparecerão aqui.</Text></View> : drafts.map((draft) => <View key={draft.id} style={styles.draftCard}><View style={styles.draftInfo}>{draft.photoUris[0] ? <Image source={{ uri: draft.photoUris[0] }} style={styles.draftThumb} /> : <View style={styles.draftThumbFallback}><Text style={styles.draftThumbFallbackText}>⌂</Text></View>}<View style={{ flex: 1 }}><Text style={styles.draftTitle}>{draft.title || "Imóvel sem título"}</Text><Text style={styles.draftMeta}>{draft.city || "Cidade não informada"} · {draft.photoUris.length} foto(s)</Text><Text style={styles.draftMeta}>{draft.purpose} · {draft.segment || "Residencial"} · {draft.zone || "Urbana"}</Text></View></View><View style={styles.draftActions}><Pressable style={styles.editAction} onPress={() => openDraft(draft)}><Text style={styles.editLink}>Editar</Text></Pressable><Pressable style={styles.deleteAction} onPress={() => void deleteDraft(draft.id)}><Text style={styles.deleteLink}>Excluir</Text></Pressable></View></View>)}
    </ScrollView></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><View style={{flex:1}}><Text style={styles.kicker}>LENOY IMOBILIÁRIAS</Text><Text style={styles.title}>Painel do corretor</Text><Text style={styles.text}>Cadastre, fotografe, publique e acompanhe contatos mesmo durante o trabalho de campo.</Text><View style={styles.heroChips}><Text style={styles.heroChip}>Offline</Text><Text style={styles.heroChip}>CRM</Text><Text style={styles.heroChip}>Fotos</Text></View></View><Pressable style={styles.syncBadge} onPress={() => setScreen("queue")}><Text style={styles.syncNumber}>{pending}</Text><Text style={styles.syncLabel}>{failed ? `${failed} erro(s)` : "na fila"}</Text></Pressable></View>
      <View style={styles.sectionIntro}><Text style={styles.sectionKicker}>ATALHOS</Text><Text style={styles.sectionTitle}>O que você precisa fazer agora?</Text></View>
      <View style={styles.grid}>
        <Pressable style={styles.primaryCard} onPress={openNew}><Text style={styles.primaryCardIcon}>＋</Text><Text style={styles.primaryCardTitle}>Novo imóvel</Text><Text style={styles.primaryCardText}>Cadastro completo, fotos e modo offline.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => setScreen("published")}><Text style={styles.cardIcon}>⌂</Text><Text style={styles.cardTitle}>Meus imóveis</Text><Text style={styles.cardText}>Publicados, vendidos, alugados e rascunhos online.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => setScreen("leads")}><Text style={styles.cardIcon}>☏</Text><Text style={styles.cardTitle}>Contatos</Text><Text style={styles.cardText}>Interessados, WhatsApp, ligações e andamento comercial.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => setScreen("drafts")}><Text style={styles.cardIcon}>▧</Text><Text style={styles.cardTitle}>Rascunhos locais</Text><Text style={styles.cardText}>{drafts.length} cadastro(s) salvo(s) neste aparelho.</Text></Pressable>
        <Pressable style={styles.wideCard} onPress={() => void syncNow()}><View style={styles.wideCardIcon}><Text style={styles.cardIcon}>↻</Text></View><View style={{flex:1}}><Text style={styles.cardTitle}>{syncing ? "Sincronizando..." : "Sincronizar agora"}</Text><Text style={styles.cardText}>Wi-Fi automático; dados móveis somente com sua autorização.</Text></View><Text style={styles.wideArrow}>›</Text></Pressable>
      </View>
      <View style={styles.infoCard}><View style={styles.infoIcon}><Text style={styles.infoIconText}>✓</Text></View><View style={{flex:1}}><Text style={styles.infoTitle}>Offline de verdade</Text><Text style={styles.infoText}>Fotos e dados ficam no aparelho. Quando a conexão volta por Wi-Fi, a fila envia automaticamente.</Text></View></View>
      <Pressable style={styles.logoutButton} onPress={() => void signOut()}><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
    </ScrollView></SafeAreaView>
  );
}

function awaitableEmptyQueue(): Awaited<ReturnType<typeof getOfflineQueue>> { return []; }

export default function App() { return <BrokerAuthGate><BrokerApp /></BrokerAuthGate>; }

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: "default" | "decimal-pad" }) { return <View><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor="#98a2ab" keyboardType={props.keyboardType || "default"} /></View>; }
function MiniField(props: { label: string; value: string; onChangeText: (value: string) => void; decimal?: boolean }) { return <View style={styles.miniField}><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} keyboardType={props.decimal ? "decimal-pad" : "number-pad"} /></View>; }
function Choice(props: { selected: boolean; label: string; onPress: () => void }) { return <Pressable style={[styles.choice, props.selected && styles.choiceSelected]} onPress={props.onPress}><Text style={[styles.choiceText, props.selected && styles.choiceTextSelected]}>{props.label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f4f1eb"},content:{padding:18,gap:16},
  header:{backgroundColor:"#07182d",borderRadius:26,padding:23,flexDirection:"row",justifyContent:"space-between",gap:15,borderWidth:1,borderColor:"#102c4c"},kicker:{fontSize:9,fontWeight:"900",letterSpacing:1.7,color:"#d6ac58"},title:{fontSize:34,lineHeight:37,fontWeight:"900",marginTop:8,color:"#fff"},text:{fontSize:14,lineHeight:21,marginTop:9,color:"#becad5",maxWidth:260},heroChips:{flexDirection:"row",gap:6,marginTop:15},heroChip:{fontSize:9,fontWeight:"900",color:"#d6ac58",borderWidth:1,borderColor:"#3c516a",paddingHorizontal:8,paddingVertical:5,borderRadius:999},
  syncBadge:{minWidth:78,alignSelf:"flex-start",backgroundColor:"#d6ac58",borderRadius:18,padding:12,alignItems:"center"},syncNumber:{fontSize:27,fontWeight:"900",color:"#07182d"},syncLabel:{fontSize:9,fontWeight:"900",color:"#59451c",textAlign:"center"},
  sectionIntro:{paddingHorizontal:3,paddingTop:4},sectionKicker:{fontSize:9,fontWeight:"900",letterSpacing:1.3,color:"#a1782e"},sectionTitle:{fontSize:21,fontWeight:"900",color:"#07182d",marginTop:4},
  grid:{flexDirection:"row",flexWrap:"wrap",gap:11},primaryCard:{width:"48%",minHeight:164,backgroundColor:"#07182d",borderRadius:20,padding:19,borderWidth:1,borderColor:"#102c4c"},card:{width:"48%",minHeight:164,backgroundColor:"#fff",borderRadius:20,padding:19,borderWidth:1,borderColor:"#e5ded3"},primaryCardIcon:{fontSize:31,color:"#d6ac58"},primaryCardTitle:{fontSize:19,fontWeight:"900",color:"#fff",marginTop:20},primaryCardText:{fontSize:12,lineHeight:18,color:"#bdc9d4",marginTop:6},cardIcon:{fontSize:27,color:"#9a722a"},cardTitle:{fontSize:17,fontWeight:"900",color:"#07182d",marginTop:18},cardText:{fontSize:12,lineHeight:18,color:"#687785",marginTop:6},wideCard:{width:"100%",backgroundColor:"#fff",borderRadius:20,padding:17,borderWidth:1,borderColor:"#e5ded3",flexDirection:"row",alignItems:"center",gap:13},wideCardIcon:{width:48,height:48,borderRadius:15,backgroundColor:"#f2e8d5",alignItems:"center",justifyContent:"center"},wideArrow:{fontSize:31,color:"#b9a783"},
  infoCard:{backgroundColor:"#fff",borderRadius:20,padding:17,borderWidth:1,borderColor:"#e5ded3",flexDirection:"row",gap:13,alignItems:"flex-start"},infoIcon:{width:40,height:40,borderRadius:13,backgroundColor:"#f1e7d4",alignItems:"center",justifyContent:"center"},infoIconText:{fontSize:19,fontWeight:"900",color:"#8d6825"},infoTitle:{fontSize:17,fontWeight:"900",color:"#07182d"},infoText:{fontSize:13,lineHeight:20,color:"#657482",marginTop:6},
  editorHero:{backgroundColor:"#07182d",borderRadius:23,padding:21},backLight:{fontSize:12,fontWeight:"900",color:"#d6ac58",marginBottom:18},editorHeroKicker:{fontSize:9,fontWeight:"900",letterSpacing:1.5,color:"#d6ac58"},editorHeroTitle:{fontSize:29,fontWeight:"900",color:"#fff",marginTop:6},editorHeroText:{fontSize:13,lineHeight:19,color:"#bdc9d4",marginTop:7,maxWidth:310},
  formCard:{backgroundColor:"#fff",borderRadius:22,padding:19,gap:16,borderWidth:1,borderColor:"#e5ded3"},label:{fontSize:10,fontWeight:"900",color:"#526273",marginBottom:7,letterSpacing:.45},groupTitle:{fontSize:10,fontWeight:"900",color:"#7d682f",marginBottom:-8,letterSpacing:.6},help:{fontSize:10,color:"#85909a"},input:{borderWidth:1,borderColor:"#dce2e6",borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:"#10233a",backgroundColor:"#fff"},textarea:{minHeight:112},choiceRow:{flexDirection:"row",flexWrap:"wrap",gap:9},choiceWrap:{flexDirection:"row",flexWrap:"wrap",gap:8},choice:{paddingVertical:9,paddingHorizontal:13,borderRadius:999,borderWidth:1,borderColor:"#dce2e6",backgroundColor:"#fff"},choiceSelected:{backgroundColor:"#07182d",borderColor:"#07182d"},choiceText:{fontWeight:"800",color:"#596979",fontSize:12},choiceTextSelected:{color:"#fff"},tripleRow:{flexDirection:"row",gap:8},miniField:{flex:1},
  photoHeader:{gap:10},photoActions:{flexDirection:"row",gap:8},smallAction:{backgroundColor:"#f4efe6",borderRadius:10,paddingHorizontal:10,paddingVertical:9},smallActionText:{fontSize:11,fontWeight:"800",color:"#5e4d2d"},photoStrip:{gap:10},photoItem:{width:124,height:112,borderRadius:14,overflow:"hidden",position:"relative",backgroundColor:"#eef1f3"},photo:{width:"100%",height:"100%"},removePhoto:{position:"absolute",right:5,top:5,width:27,height:27,borderRadius:14,backgroundColor:"rgba(7,24,45,.88)",alignItems:"center",justifyContent:"center"},removePhotoText:{color:"#fff",fontSize:20,lineHeight:21},coverLabel:{position:"absolute",left:6,bottom:6,backgroundColor:"#d6ac58",color:"#07182d",paddingHorizontal:7,paddingVertical:4,borderRadius:7,fontSize:8,fontWeight:"900"},photoMove:{position:"absolute",right:5,bottom:5,flexDirection:"row",gap:4},photoMoveText:{backgroundColor:"rgba(255,255,255,.94)",paddingHorizontal:7,paddingVertical:4,borderRadius:7,fontWeight:"900",color:"#07182d"},
  secondaryButton:{minHeight:50,borderRadius:13,borderWidth:1,borderColor:"#d6ac58",backgroundColor:"#fffaf0",alignItems:"center",justifyContent:"center"},secondaryButtonText:{fontWeight:"900",color:"#7c5d23"},primaryButton:{minHeight:52,borderRadius:13,backgroundColor:"#07182d",alignItems:"center",justifyContent:"center"},primaryButtonText:{fontWeight:"900",color:"#fff"},disabled:{opacity:.48},
  emptyCard:{backgroundColor:"#fff",borderRadius:20,padding:24,borderWidth:1,borderColor:"#e5ded3",alignItems:"center"},emptyIcon:{fontSize:30,fontWeight:"900",color:"#d6ac58",marginBottom:7},
  draftCard:{backgroundColor:"#fff",borderRadius:18,padding:15,gap:12,borderWidth:1,borderColor:"#e5ded3"},draftInfo:{flexDirection:"row",alignItems:"center",gap:12},draftThumb:{width:68,height:58,borderRadius:11},draftThumbFallback:{width:68,height:58,borderRadius:11,backgroundColor:"#f1e7d4",alignItems:"center",justifyContent:"center"},draftThumbFallbackText:{fontSize:24,color:"#9a722a"},draftTitle:{fontSize:17,fontWeight:"900",color:"#07182d"},draftMeta:{fontSize:11,color:"#76838e",marginTop:4},draftActions:{flexDirection:"row",gap:9,justifyContent:"flex-end"},editAction:{backgroundColor:"#f4efe6",paddingHorizontal:12,paddingVertical:8,borderRadius:9},deleteAction:{backgroundColor:"#fff1f1",paddingHorizontal:12,paddingVertical:8,borderRadius:9},editLink:{fontWeight:"900",color:"#7e612b",fontSize:11},deleteLink:{fontWeight:"900",color:"#a13b3b",fontSize:11},
  queueCard:{backgroundColor:"#fff",borderRadius:16,padding:15,borderWidth:1,borderColor:"#e5ded3"},queueHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},queueState:{fontSize:8,fontWeight:"900",backgroundColor:"#fff3c7",color:"#745d09",paddingHorizontal:8,paddingVertical:5,borderRadius:999},queueError:{backgroundColor:"#fff0f0",color:"#a13b3b"},errorText:{fontSize:11,lineHeight:17,color:"#a13b3b",marginTop:8},
  logoutButton:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:"#d8d1c7",backgroundColor:"transparent",alignItems:"center",justifyContent:"center"},logoutText:{fontWeight:"900",color:"#6b7580",fontSize:12}
});