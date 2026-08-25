import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, BackHandler, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as ImagePicker from "expo-image-picker";
import BrokerAuthGate from "./src/components/BrokerAuthGate";
import BrokerLeads from "./src/components/BrokerLeads";
import PublishedProperties from "./src/components/PublishedProperties";
import { getMobileAgencyContext } from "./src/lib/currentAgency";
import { mobileSupabase } from "./src/lib/supabase";
import { enqueueOfflineJob, getOfflineQueue, processOfflineQueue, retryFailedJobs } from "./src/services/offlineQueue";
import { getPropertyDrafts, PropertyDraft, removePropertyDraft, savePropertyDraft } from "./src/services/propertyDrafts";

type Screen = "home" | "editor" | "drafts" | "published" | "queue" | "leads";
type IbgeCity = { nome?: string };
type AppTheme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonStyle: "rounded" | "square" | "pill";
};

const states = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;
const CITY_CACHE_PREFIX = "@imobiliarias/official-cities/";
const defaultAppTheme: AppTheme = { primaryColor: "#07182d", secondaryColor: "#d6ac58", backgroundColor: "#f4f1eb", textColor: "#07182d", buttonStyle: "rounded" };

const emptyDraft = (): Omit<PropertyDraft, "id" | "updatedAt"> => ({
  title: "", city: "", neighborhood: "", purpose: "Venda", category: "Casa", segment: "Residencial", zone: "Urbana", price: "",
  bedrooms: "", suites: "", bathrooms: "", parking: "", builtArea: "", landArea: "", address: "", addressPublic: false,
  description: "", photoUris: [],
});

function parseCityValue(value: string) {
  const text = value.trim();
  const match = text.match(/^(.*?)\s*[-/]\s*([A-Za-z]{2})$/);
  return { name: String(match?.[1] || text).trim(), state: String(match?.[2] || "PR").toUpperCase() };
}

function themeRadius(style: AppTheme["buttonStyle"], normal = 13) {
  return style === "pill" ? 999 : style === "square" ? 5 : normal;
}

function BrokerApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [drafts, setDrafts] = useState<PropertyDraft[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyDraft());
  const [queue, setQueue] = useState(awaitableEmptyQueue());
  const [cityState, setCityState] = useState("PR");
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState("");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(defaultAppTheme);

  async function refreshTheme() {
    const context = await getMobileAgencyContext();
    if (!context) return;
    setTheme({
      primaryColor: context.primaryColor,
      secondaryColor: context.secondaryColor,
      backgroundColor: context.backgroundColor,
      textColor: context.textColor,
      buttonStyle: context.buttonStyle,
    });
  }

  async function refreshAll() {
    const [storedQueue, storedDrafts] = await Promise.all([getOfflineQueue(), getPropertyDrafts()]);
    setQueue(storedQueue);
    setPending(storedQueue.length);
    setFailed(storedQueue.filter((item) => item.state === "error").length);
    setDrafts(storedDrafts);
  }

  async function loadCities(stateCode: string) {
    const uf = stateCode.toUpperCase();
    setCityLoading(true);
    let cached: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(`${CITY_CACHE_PREFIX}${uf}`);
      if (raw) cached = JSON.parse(raw) as string[];
    } catch { cached = []; }
    if (cached.length) setCityOptions(cached);

    try {
      const network = await NetInfo.fetch();
      const localResult = mobileSupabase
        ? await mobileSupabase.from("cities").select("name").eq("state_code", uf).order("name")
        : { data: null, error: null };
      const localNames = (localResult.data || []).map((item: { name: string }) => item.name).filter(Boolean);
      let officialNames: string[] = [];
      if (network.isConnected) {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
        if (response.ok) {
          const data = await response.json() as IbgeCity[];
          officialNames = data.map((item) => String(item.nome || "").trim()).filter(Boolean);
        }
      }
      const merged = Array.from(new Set([...officialNames, ...localNames, ...cached])).sort((a, b) => a.localeCompare(b, "pt-BR"));
      if (merged.length) {
        setCityOptions(merged);
        await AsyncStorage.setItem(`${CITY_CACHE_PREFIX}${uf}`, JSON.stringify(merged));
      }
    } catch {
      if (!cached.length) setCityOptions([]);
    } finally { setCityLoading(false); }
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
      Alert.alert("Usar dados móveis?", `Existem ${storedQueue.length} item(ns) para enviar, incluindo fotos. Deseja enviar agora usando seus dados móveis ou aguardar uma conexão Wi-Fi?`, [
        { text: "Aguardar Wi-Fi", style: "cancel" },
        { text: "Enviar pelos dados", onPress: () => void syncNow(true) },
      ]);
      return;
    }

    setSyncing(true);
    const result = await processOfflineQueue();
    await refreshAll();
    setSyncing(false);
    if (!silent && result.processed > 0) Alert.alert("Sincronização concluída", `${result.processed} item(ns) enviado(s).`);
    else if (!silent && result.pending > 0) Alert.alert("Sincronização pendente", "Abra a fila de sincronização para ver exatamente qual informação precisa de correção.");
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
    setMenuOpen(false);
    await mobileSupabase.auth.signOut();
  }

  function navigate(next: Screen) {
    setMenuOpen(false);
    setCityPickerOpen(false);
    setScreen(next);
  }

  useEffect(() => {
    void refreshAll();
    void refreshTheme();
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

  useEffect(() => {
    if (screen === "editor") void loadCities(cityState);
  }, [screen, cityState]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menuOpen) { setMenuOpen(false); return true; }
      if (cityPickerOpen) { setCityPickerOpen(false); return true; }
      if (screen !== "home") { setScreen("home"); return true; }
      return true;
    });
    return () => subscription.remove();
  }, [screen, menuOpen, cityPickerOpen]);

  const canPublish = useMemo(() => Boolean(form.title.trim() && form.city.trim() && form.category && form.price.trim()), [form]);
  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return cityOptions.slice(0, 120);
    return cityOptions.filter((name) => name.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 120);
  }, [cityOptions, citySearch]);

  function openNew() {
    setEditingId(undefined);
    setForm(emptyDraft());
    setCityState("PR");
    setCitySearch("");
    setScreen("editor");
  }

  function openDraft(draft: PropertyDraft) {
    setEditingId(draft.id);
    const { id: _id, updatedAt: _updatedAt, ...data } = draft;
    const parsed = parseCityValue(data.city || "");
    setCityState(parsed.state || "PR");
    setCitySearch("");
    setForm({ ...emptyDraft(), ...data });
    setScreen("editor");
  }

  function selectCity(name: string) {
    setForm((current) => ({ ...current, city: `${name} - ${cityState}` }));
    setCitySearch("");
    setCityPickerOpen(false);
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

  const radius = themeRadius(theme.buttonStyle);
  const screenStyle = [styles.screen, { backgroundColor: theme.backgroundColor }];
  const brandSurface = { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor };
  const accentText = { color: theme.secondaryColor };
  const primaryAction = { backgroundColor: theme.primaryColor, borderRadius: radius };
  const chrome = <AppTopbar onMenu={() => setMenuOpen(true)} theme={theme} />;
  const menu = <BrokerMenu visible={menuOpen} active={screen} pending={pending} failed={failed} onClose={() => setMenuOpen(false)} onNavigate={navigate} onNew={openNew} onSignOut={() => void signOut()} theme={theme} />;

  if (screen === "published") return <SafeAreaView style={screenStyle}>{chrome}{menu}<PublishedProperties onClose={() => setScreen("home")} /></SafeAreaView>;
  if (screen === "leads") return <SafeAreaView style={screenStyle}>{chrome}{menu}<BrokerLeads onClose={() => setScreen("home")} /></SafeAreaView>;

  if (screen === "queue") return (
    <SafeAreaView style={screenStyle}>{chrome}{menu}<ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.editorHero, brandSurface]}><Pressable onPress={() => setScreen("home")}><Text style={[styles.backLight, accentText]}>← Voltar</Text></Pressable><Text style={[styles.editorHeroKicker, accentText]}>SINCRONIZAÇÃO</Text><Text style={styles.editorHeroTitle}>Fila offline</Text><Text style={styles.editorHeroText}>Acompanhe o que está aguardando internet, envio ou nova tentativa.</Text></View>
      <View style={styles.infoCard}><View style={[styles.infoIcon, { backgroundColor: `${theme.secondaryColor}22` }]}><Text style={[styles.infoIconText, accentText]}>↻</Text></View><View style={{flex:1}}><Text style={[styles.infoTitle, { color: theme.textColor }]}>Controle de internet</Text><Text style={styles.infoText}>No Wi-Fi a fila é enviada automaticamente. Em dados móveis, você escolhe se quer enviar naquele momento.</Text></View></View>
      {queue.length === 0 ? <View style={styles.emptyCard}><Text style={[styles.emptyIcon, accentText]}>✓</Text><Text style={[styles.infoTitle, { color: theme.textColor }]}>Tudo sincronizado</Text><Text style={styles.infoText}>Não há operações pendentes.</Text></View> : queue.map((job) => <View style={styles.queueCard} key={job.clientOperationId}><View style={styles.queueHead}><View style={{flex:1}}><Text style={[styles.draftTitle, { color: theme.textColor }]}>{job.entityType === "property_draft" ? "Publicação de imóvel" : "Sincronização"}</Text><Text style={styles.draftMeta}>Tentativas: {job.attempts}</Text></View><Text style={[styles.queueState, job.state === "error" && styles.queueError]}>{job.state === "error" ? "ERRO" : job.state === "syncing" ? "ENVIANDO" : "PENDENTE"}</Text></View>{job.lastError ? <Text style={styles.errorText}>{job.lastError}</Text> : null}</View>)}
      {failed > 0 ? <Pressable style={[styles.primaryButton, primaryAction]} onPress={() => void retryQueue()}><Text style={styles.primaryButtonText}>{syncing ? "Tentando..." : `Tentar novamente (${failed})`}</Text></Pressable> : null}
    </ScrollView></SafeAreaView>
  );

  if (screen === "editor") return (
    <SafeAreaView style={screenStyle}>{chrome}{menu}<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.editorHero, brandSurface]}><Pressable onPress={() => setScreen("home")}><Text style={[styles.backLight, accentText]}>← Voltar</Text></Pressable><Text style={[styles.editorHeroKicker, accentText]}>CADASTRO DE IMÓVEL</Text><Text style={styles.editorHeroTitle}>{editingId ? "Editar rascunho" : "Novo imóvel"}</Text><Text style={styles.editorHeroText}>Preencha o essencial, fotografe e publique agora ou deixe salvo offline.</Text></View>
      <View style={styles.formCard}>
        <Field label="Título" value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder="Casa com 3 quartos no Centro" />
        <Text style={styles.groupTitle}>Finalidade</Text><View style={styles.choiceRow}>{(["Venda", "Locação"] as const).map((item) => <Choice key={item} selected={form.purpose === item} label={item} onPress={() => setForm({ ...form, purpose: item })} theme={theme} />)}</View>
        <Text style={styles.groupTitle}>Tipo</Text><View style={styles.choiceWrap}>{(["Casa", "Apartamento", "Comercial", "Rural"] as const).map((item) => <Choice key={item} selected={form.category === item} label={item} onPress={() => setForm({ ...form, category: item, segment: item === "Comercial" ? "Comercial" : form.segment, zone: item === "Rural" ? "Rural" : form.zone })} theme={theme} />)}</View>
        <Text style={styles.groupTitle}>Uso</Text><View style={styles.choiceRow}>{(["Residencial", "Comercial"] as const).map((item) => <Choice key={item} selected={form.segment === item} label={item} onPress={() => setForm({ ...form, segment: item })} theme={theme} />)}</View>
        <Text style={styles.groupTitle}>Zona</Text><View style={styles.choiceRow}>{(["Urbana", "Rural"] as const).map((item) => <Choice key={item} selected={form.zone === item} label={item} onPress={() => setForm({ ...form, zone: item })} theme={theme} />)}</View>

        <Text style={styles.label}>Estado</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stateStrip}>{states.map((uf) => <Pressable key={uf} style={[styles.stateChip, cityState === uf && styles.stateChipActive, cityState === uf && brandSurface]} onPress={() => { setCityState(uf); setForm((current) => ({ ...current, city: "" })); setCityPickerOpen(true); setCitySearch(""); }}><Text style={[styles.stateChipText, cityState === uf && styles.stateChipTextActive]}>{uf}</Text></Pressable>)}</ScrollView>
        <Text style={styles.label}>Cidade</Text>
        <Pressable style={styles.citySelect} onPress={() => setCityPickerOpen((value) => !value)}><Text style={form.city ? styles.citySelectText : styles.cityPlaceholder}>{form.city ? parseCityValue(form.city).name : cityLoading ? "Carregando cidades..." : "Selecionar cidade"}</Text><Text style={[styles.cityChevron, accentText]}>{cityPickerOpen ? "⌃" : "⌄"}</Text></Pressable>
        {cityPickerOpen ? <View style={styles.cityPicker}><TextInput style={styles.citySearch} value={citySearch} onChangeText={setCitySearch} autoCapitalize="words" placeholder={`Buscar cidade em ${cityState}`} placeholderTextColor="#98a2ab" />
          <ScrollView style={styles.cityList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filteredCities.map((name) => <Pressable key={`${cityState}-${name}`} style={styles.cityOption} onPress={() => selectCity(name)}><Text style={styles.cityOptionName}>{name}</Text><Text style={[styles.cityOptionUf, { color: theme.primaryColor, backgroundColor: `${theme.secondaryColor}22` }]}>{cityState}</Text></Pressable>)}
            {citySearch.trim() && !filteredCities.some((name) => name.toLocaleLowerCase("pt-BR") === citySearch.trim().toLocaleLowerCase("pt-BR")) ? <Pressable style={styles.cityManual} onPress={() => selectCity(citySearch.trim())}><Text style={styles.cityManualTitle}>Usar “{citySearch.trim()}”</Text><Text style={styles.cityManualText}>Salvar como cidade de {cityState}. Na sincronização o sistema prepara o cadastro automaticamente.</Text></Pressable> : null}
            {!cityLoading && cityOptions.length === 0 && !citySearch.trim() ? <Text style={styles.cityEmpty}>Sem lista em cache. Digite o nome da cidade acima; ela continuará salva no rascunho offline.</Text> : null}
          </ScrollView>
        </View> : null}

        <Field label="Bairro" value={form.neighborhood} onChangeText={(neighborhood) => setForm({ ...form, neighborhood })} placeholder="Centro" />
        <Field label="Endereço" value={form.address || ""} onChangeText={(address) => setForm({ ...form, address })} placeholder="Rua, número e complemento" />
        <View style={styles.choiceRow}><Choice selected={!form.addressPublic} label="Endereço privado" onPress={() => setForm({ ...form, addressPublic: false })} theme={theme} /><Choice selected={Boolean(form.addressPublic)} label="Exibir endereço" onPress={() => setForm({ ...form, addressPublic: true })} theme={theme} /></View>
        <Field label="Valor" value={form.price} onChangeText={(price) => setForm({ ...form, price })} placeholder="485000" keyboardType="decimal-pad" />
        <View style={styles.tripleRow}><MiniField label="Quartos" value={form.bedrooms} onChangeText={(bedrooms) => setForm({ ...form, bedrooms })} /><MiniField label="Suítes" value={form.suites || ""} onChangeText={(suites) => setForm({ ...form, suites })} /><MiniField label="Banheiros" value={form.bathrooms} onChangeText={(bathrooms) => setForm({ ...form, bathrooms })} /></View>
        <View style={styles.tripleRow}><MiniField label="Vagas" value={form.parking} onChangeText={(parking) => setForm({ ...form, parking })} /><MiniField label="Área const." value={form.builtArea || ""} onChangeText={(builtArea) => setForm({ ...form, builtArea })} decimal /><MiniField label="Terreno" value={form.landArea || ""} onChangeText={(landArea) => setForm({ ...form, landArea })} decimal /></View>
        <Text style={styles.label}>Descrição</Text><TextInput multiline numberOfLines={5} style={[styles.input, styles.textarea]} value={form.description} onChangeText={(description) => setForm({ ...form, description })} placeholder="Destaques e informações do imóvel" placeholderTextColor="#98a2ab" textAlignVertical="top" />
        <View style={styles.photoHeader}><View><Text style={styles.label}>Fotos</Text><Text style={styles.help}>{form.photoUris.length}/20 imagens · a primeira é a capa</Text></View><View style={styles.photoActions}><Pressable style={styles.smallAction} onPress={() => void takePhoto()}><Text style={styles.smallActionText}>📷 Câmera</Text></Pressable><Pressable style={styles.smallAction} onPress={() => void pickPhotos()}><Text style={styles.smallActionText}>🖼 Galeria</Text></Pressable></View></View>
        {form.photoUris.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>{form.photoUris.map((uri, index) => <View key={`${uri}-${index}`} style={styles.photoItem}><Image source={{ uri }} style={styles.photo} /><Pressable style={styles.removePhoto} onPress={() => setForm((current) => ({ ...current, photoUris: current.photoUris.filter((_, i) => i !== index) }))}><Text style={styles.removePhotoText}>×</Text></Pressable>{index === 0 && <Text style={[styles.coverLabel, { backgroundColor: theme.secondaryColor, color: theme.primaryColor }]}>CAPA</Text>}<View style={styles.photoMove}><Pressable onPress={() => movePhoto(index, -1)}><Text style={styles.photoMoveText}>←</Text></Pressable><Pressable onPress={() => movePhoto(index, 1)}><Text style={styles.photoMoveText}>→</Text></Pressable></View></View>)}</ScrollView>}
        <Pressable style={[styles.secondaryButton, { borderColor: theme.secondaryColor, borderRadius: radius }]} onPress={() => void saveDraftOnly()}><Text style={[styles.secondaryButtonText, { color: theme.primaryColor }]}>Salvar rascunho offline</Text></Pressable>
        <Pressable style={[styles.primaryButton, primaryAction, !canPublish && styles.disabled]} onPress={() => void queueForPublish()}><Text style={styles.primaryButtonText}>Publicar / sincronizar</Text></Pressable>
      </View>
    </ScrollView></SafeAreaView>
  );

  if (screen === "drafts") return (
    <SafeAreaView style={screenStyle}>{chrome}{menu}<ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.editorHero, brandSurface]}><Pressable onPress={() => setScreen("home")}><Text style={[styles.backLight, accentText]}>← Voltar</Text></Pressable><Text style={[styles.editorHeroKicker, accentText]}>TRABALHO OFFLINE</Text><Text style={styles.editorHeroTitle}>Rascunhos</Text><Text style={styles.editorHeroText}>{drafts.length} cadastro(s) preservado(s) neste aparelho.</Text></View>
      {drafts.length === 0 ? <View style={styles.emptyCard}><Text style={[styles.emptyIcon, accentText]}>▧</Text><Text style={[styles.infoTitle, { color: theme.textColor }]}>Nenhum rascunho</Text><Text style={styles.infoText}>Os cadastros salvos sem internet aparecerão aqui.</Text></View> : drafts.map((draft) => <View key={draft.id} style={styles.draftCard}><View style={styles.draftInfo}>{draft.photoUris[0] ? <Image source={{ uri: draft.photoUris[0] }} style={styles.draftThumb} /> : <View style={[styles.draftThumbFallback, { backgroundColor: `${theme.secondaryColor}22` }]}><Text style={[styles.draftThumbFallbackText, accentText]}>⌂</Text></View>}<View style={{ flex: 1 }}><Text style={[styles.draftTitle, { color: theme.textColor }]}>{draft.title || "Imóvel sem título"}</Text><Text style={styles.draftMeta}>{draft.city || "Cidade não informada"} · {draft.photoUris.length} foto(s)</Text><Text style={styles.draftMeta}>{draft.purpose} · {draft.segment || "Residencial"} · {draft.zone || "Urbana"}</Text></View></View><View style={styles.draftActions}><Pressable style={styles.editAction} onPress={() => openDraft(draft)}><Text style={[styles.editLink, { color: theme.primaryColor }]}>Editar</Text></Pressable><Pressable style={styles.deleteAction} onPress={() => void deleteDraft(draft.id)}><Text style={styles.deleteLink}>Excluir</Text></Pressable></View></View>)}
    </ScrollView></SafeAreaView>
  );

  return (
    <SafeAreaView style={screenStyle}>{chrome}{menu}<ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.header, brandSurface]}><View style={{flex:1}}><Text style={[styles.kicker, accentText]}>LENOY IMOBILIÁRIAS</Text><Text style={styles.title}>Painel do corretor</Text><Text style={styles.text}>Cadastre, fotografe, publique e acompanhe contatos mesmo durante o trabalho de campo.</Text><View style={styles.heroChips}><Text style={[styles.heroChip, accentText, { borderColor: `${theme.secondaryColor}66` }]}>Offline</Text><Text style={[styles.heroChip, accentText, { borderColor: `${theme.secondaryColor}66` }]}>CRM</Text><Text style={[styles.heroChip, accentText, { borderColor: `${theme.secondaryColor}66` }]}>Fotos</Text></View></View><Pressable style={[styles.syncBadge, { backgroundColor: theme.secondaryColor, borderRadius: themeRadius(theme.buttonStyle, 18) }]} onPress={() => setScreen("queue")}><Text style={[styles.syncNumber, { color: theme.primaryColor }]}>{pending}</Text><Text style={[styles.syncLabel, { color: theme.primaryColor }]}>{failed ? `${failed} erro(s)` : "na fila"}</Text></Pressable></View>
      <View style={styles.sectionIntro}><Text style={[styles.sectionKicker, accentText]}>ATALHOS</Text><Text style={[styles.sectionTitle, { color: theme.textColor }]}>O que você precisa fazer agora?</Text></View>
      <View style={styles.grid}>
        <Pressable style={[styles.primaryCard, brandSurface]} onPress={openNew}><Text style={[styles.primaryCardIcon, accentText]}>＋</Text><Text style={styles.primaryCardTitle}>Novo imóvel</Text><Text style={styles.primaryCardText}>Cadastro completo, fotos e modo offline.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => setScreen("published")}><Text style={[styles.cardIcon, accentText]}>⌂</Text><Text style={[styles.cardTitle, { color: theme.textColor }]}>Meus imóveis</Text><Text style={styles.cardText}>Publicados, vendidos, alugados e rascunhos online.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => setScreen("leads")}><Text style={[styles.cardIcon, accentText]}>☏</Text><Text style={[styles.cardTitle, { color: theme.textColor }]}>Contatos</Text><Text style={styles.cardText}>Interessados, WhatsApp, ligações e andamento comercial.</Text></Pressable>
        <Pressable style={styles.card} onPress={() => setScreen("drafts")}><Text style={[styles.cardIcon, accentText]}>▧</Text><Text style={[styles.cardTitle, { color: theme.textColor }]}>Rascunhos locais</Text><Text style={styles.cardText}>{drafts.length} cadastro(s) salvo(s) neste aparelho.</Text></Pressable>
        <Pressable style={styles.wideCard} onPress={() => void syncNow()}><View style={[styles.wideCardIcon, { backgroundColor: `${theme.secondaryColor}22` }]}><Text style={[styles.cardIcon, accentText]}>↻</Text></View><View style={{flex:1}}><Text style={[styles.cardTitle, { color: theme.textColor }]}>{syncing ? "Sincronizando..." : "Sincronizar agora"}</Text><Text style={styles.cardText}>Wi-Fi automático; dados móveis somente com sua autorização.</Text></View><Text style={[styles.wideArrow, accentText]}>›</Text></Pressable>
      </View>
      <View style={styles.infoCard}><View style={[styles.infoIcon, { backgroundColor: `${theme.secondaryColor}22` }]}><Text style={[styles.infoIconText, accentText]}>✓</Text></View><View style={{flex:1}}><Text style={[styles.infoTitle, { color: theme.textColor }]}>Offline de verdade</Text><Text style={styles.infoText}>Fotos e dados ficam no aparelho. Quando a conexão volta por Wi-Fi, a fila envia automaticamente.</Text></View></View>
      <Pressable style={[styles.logoutButton, { borderRadius: radius }]} onPress={() => void signOut()}><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
    </ScrollView></SafeAreaView>
  );
}

function AppTopbar({ onMenu, theme }: { onMenu: () => void; theme: AppTheme }) {
  return <View style={styles.appTopbar}><View><Text style={[styles.appTopKicker, { color: theme.secondaryColor }]}>LENOY</Text><Text style={[styles.appTopTitle, { color: theme.textColor }]}>App do corretor</Text></View><Pressable style={[styles.hamburger, { backgroundColor: theme.primaryColor, borderRadius: themeRadius(theme.buttonStyle) }]} onPress={onMenu} accessibilityLabel="Abrir menu"><Text style={styles.hamburgerText}>☰</Text></Pressable></View>;
}

function BrokerMenu(props: { visible: boolean; active: Screen; pending: number; failed: number; onClose: () => void; onNavigate: (screen: Screen) => void; onNew: () => void; onSignOut: () => void; theme: AppTheme }) {
  const item = (screen: Screen, label: string, detail: string) => <Pressable key={screen} style={[styles.menuItem, props.active === screen && styles.menuItemActive, props.active === screen && { backgroundColor: props.theme.primaryColor, borderColor: props.theme.primaryColor }]} onPress={() => props.onNavigate(screen)}><View style={{flex:1}}><Text style={[styles.menuItemTitle, { color: props.theme.textColor }, props.active === screen && styles.menuItemTitleActive]}>{label}</Text><Text style={styles.menuItemDetail}>{detail}</Text></View>{props.active === screen ? <Text style={[styles.menuActiveMark, { color: props.theme.secondaryColor }]}>●</Text> : <Text style={styles.menuArrow}>›</Text>}</Pressable>;
  return <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}><View style={styles.menuModal}><Pressable style={styles.menuBackdrop} onPress={props.onClose} /><View style={styles.menuDrawer}><View style={styles.menuHead}><View><Text style={[styles.menuBrand, { color: props.theme.secondaryColor }]}>LENOY IMOBILIÁRIAS</Text><Text style={[styles.menuTitle, { color: props.theme.textColor }]}>Menu do corretor</Text></View><Pressable style={styles.menuClose} onPress={props.onClose}><Text style={[styles.menuCloseText, { color: props.theme.primaryColor }]}>×</Text></Pressable></View><ScrollView contentContainerStyle={styles.menuList}>{item("home","Início","Painel e atalhos")}<Pressable style={styles.menuItem} onPress={() => { props.onClose(); props.onNew(); }}><View style={{flex:1}}><Text style={[styles.menuItemTitle, { color: props.theme.textColor }]}>Novo imóvel</Text><Text style={styles.menuItemDetail}>Cadastrar e fotografar</Text></View><Text style={[styles.menuArrow, { color: props.theme.secondaryColor }]}>＋</Text></Pressable>{item("published","Meus imóveis","Publicados e andamento")}{item("leads","Contatos","Leads e interessados")}{item("drafts","Rascunhos locais","Cadastros salvos no aparelho")}{item("queue","Sincronização",props.failed ? `${props.failed} erro(s) · ${props.pending} na fila` : `${props.pending} na fila`)}<Pressable style={styles.menuLogout} onPress={props.onSignOut}><Text style={styles.menuLogoutText}>Sair da conta</Text></Pressable></ScrollView></View></View></Modal>;
}

function awaitableEmptyQueue(): Awaited<ReturnType<typeof getOfflineQueue>> { return []; }
export default function App() { return <BrokerAuthGate><BrokerApp /></BrokerAuthGate>; }

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: "default" | "decimal-pad" }) { return <View><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor="#98a2ab" keyboardType={props.keyboardType || "default"} /></View>; }
function MiniField(props: { label: string; value: string; onChangeText: (value: string) => void; decimal?: boolean }) { return <View style={styles.miniField}><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} keyboardType={props.decimal ? "decimal-pad" : "number-pad"} /></View>; }
function Choice(props: { selected: boolean; label: string; onPress: () => void; theme: AppTheme }) { return <Pressable style={[styles.choice, props.selected && styles.choiceSelected, props.selected && { backgroundColor: props.theme.primaryColor, borderColor: props.theme.primaryColor }]} onPress={props.onPress}><Text style={[styles.choiceText, props.selected && styles.choiceTextSelected]}>{props.label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f4f1eb"},content:{padding:18,gap:16},
  appTopbar:{minHeight:60,paddingHorizontal:18,paddingVertical:9,backgroundColor:"#fff",borderBottomWidth:1,borderBottomColor:"#e6ded2",flexDirection:"row",alignItems:"center",justifyContent:"space-between"},appTopKicker:{fontSize:9,fontWeight:"900",letterSpacing:1.8,color:"#a1782e"},appTopTitle:{fontSize:16,fontWeight:"900",color:"#07182d",marginTop:2},hamburger:{width:44,height:42,borderRadius:13,backgroundColor:"#07182d",alignItems:"center",justifyContent:"center"},hamburgerText:{fontSize:23,lineHeight:26,color:"#fff",fontWeight:"900"},
  menuModal:{flex:1,flexDirection:"row"},menuBackdrop:{flex:1,backgroundColor:"rgba(2,10,20,.58)"},menuDrawer:{width:"82%",maxWidth:350,backgroundColor:"#fff",paddingTop:26,paddingHorizontal:16,paddingBottom:18},menuHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,paddingBottom:17,borderBottomWidth:1,borderBottomColor:"#ece5da"},menuBrand:{fontSize:8,fontWeight:"900",letterSpacing:1.4,color:"#a1782e"},menuTitle:{fontSize:23,fontWeight:"900",color:"#07182d",marginTop:4},menuClose:{width:39,height:39,borderRadius:12,backgroundColor:"#f3eee6",alignItems:"center",justifyContent:"center"},menuCloseText:{fontSize:27,lineHeight:29,color:"#07182d"},menuList:{paddingTop:14,gap:7},menuItem:{minHeight:62,borderRadius:15,paddingHorizontal:14,paddingVertical:10,backgroundColor:"#f8f6f2",borderWidth:1,borderColor:"#eee8df",flexDirection:"row",alignItems:"center",gap:10},menuItemActive:{backgroundColor:"#07182d",borderColor:"#07182d"},menuItemTitle:{fontSize:14,fontWeight:"900",color:"#07182d"},menuItemTitleActive:{color:"#fff"},menuItemDetail:{fontSize:10,color:"#7a8791",marginTop:3},menuArrow:{fontSize:24,color:"#a58d63"},menuActiveMark:{fontSize:12,color:"#d6ac58"},menuLogout:{minHeight:48,borderRadius:13,borderWidth:1,borderColor:"#ecd3d3",backgroundColor:"#fff5f5",alignItems:"center",justifyContent:"center",marginTop:8},menuLogoutText:{fontSize:12,fontWeight:"900",color:"#a13b3b"},
  header:{backgroundColor:"#07182d",borderRadius:26,padding:23,flexDirection:"row",justifyContent:"space-between",gap:15,borderWidth:1,borderColor:"#102c4c"},kicker:{fontSize:9,fontWeight:"900",letterSpacing:1.7,color:"#d6ac58"},title:{fontSize:34,lineHeight:37,fontWeight:"900",marginTop:8,color:"#fff"},text:{fontSize:14,lineHeight:21,marginTop:9,color:"#becad5",maxWidth:260},heroChips:{flexDirection:"row",gap:6,marginTop:15},heroChip:{fontSize:9,fontWeight:"900",color:"#d6ac58",borderWidth:1,borderColor:"#3c516a",paddingHorizontal:8,paddingVertical:5,borderRadius:999},
  syncBadge:{minWidth:78,alignSelf:"flex-start",backgroundColor:"#d6ac58",borderRadius:18,padding:12,alignItems:"center"},syncNumber:{fontSize:27,fontWeight:"900",color:"#07182d"},syncLabel:{fontSize:9,fontWeight:"900",color:"#59451c",textAlign:"center"},
  sectionIntro:{paddingHorizontal:3,paddingTop:4},sectionKicker:{fontSize:9,fontWeight:"900",letterSpacing:1.3,color:"#a1782e"},sectionTitle:{fontSize:21,fontWeight:"900",color:"#07182d",marginTop:4},
  grid:{flexDirection:"row",flexWrap:"wrap",gap:11},primaryCard:{width:"48%",minHeight:164,backgroundColor:"#07182d",borderRadius:20,padding:19,borderWidth:1,borderColor:"#102c4c"},card:{width:"48%",minHeight:164,backgroundColor:"#fff",borderRadius:20,padding:19,borderWidth:1,borderColor:"#e5ded3"},primaryCardIcon:{fontSize:31,color:"#d6ac58"},primaryCardTitle:{fontSize:19,fontWeight:"900",color:"#fff",marginTop:20},primaryCardText:{fontSize:12,lineHeight:18,color:"#bdc9d4",marginTop:6},cardIcon:{fontSize:27,color:"#9a722a"},cardTitle:{fontSize:17,fontWeight:"900",color:"#07182d",marginTop:18},cardText:{fontSize:12,lineHeight:18,color:"#687785",marginTop:6},wideCard:{width:"100%",backgroundColor:"#fff",borderRadius:20,padding:17,borderWidth:1,borderColor:"#e5ded3",flexDirection:"row",alignItems:"center",gap:13},wideCardIcon:{width:48,height:48,borderRadius:15,backgroundColor:"#f2e8d5",alignItems:"center",justifyContent:"center"},wideArrow:{fontSize:31,color:"#b9a783"},
  infoCard:{backgroundColor:"#fff",borderRadius:20,padding:17,borderWidth:1,borderColor:"#e5ded3",flexDirection:"row",gap:13,alignItems:"flex-start"},infoIcon:{width:40,height:40,borderRadius:13,backgroundColor:"#f1e7d4",alignItems:"center",justifyContent:"center"},infoIconText:{fontSize:19,fontWeight:"900",color:"#8d6825"},infoTitle:{fontSize:17,fontWeight:"900",color:"#07182d"},infoText:{fontSize:13,lineHeight:20,color:"#657482",marginTop:6},
  editorHero:{backgroundColor:"#07182d",borderRadius:23,padding:21},backLight:{fontSize:12,fontWeight:"900",color:"#d6ac58",marginBottom:18},editorHeroKicker:{fontSize:9,fontWeight:"900",letterSpacing:1.5,color:"#d6ac58"},editorHeroTitle:{fontSize:29,fontWeight:"900",color:"#fff",marginTop:6},editorHeroText:{fontSize:13,lineHeight:19,color:"#bdc9d4",marginTop:7,maxWidth:310},
  formCard:{backgroundColor:"#fff",borderRadius:22,padding:19,gap:16,borderWidth:1,borderColor:"#e5ded3"},label:{fontSize:10,fontWeight:"900",color:"#526273",marginBottom:7,letterSpacing:.45},groupTitle:{fontSize:10,fontWeight:"900",color:"#7d682f",marginBottom:-8,letterSpacing:.6},help:{fontSize:10,color:"#85909a"},input:{borderWidth:1,borderColor:"#dce2e6",borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:"#10233a",backgroundColor:"#fff"},textarea:{minHeight:112},choiceRow:{flexDirection:"row",flexWrap:"wrap",gap:9},choiceWrap:{flexDirection:"row",flexWrap:"wrap",gap:8},choice:{paddingVertical:9,paddingHorizontal:13,borderRadius:999,borderWidth:1,borderColor:"#dce2e6",backgroundColor:"#fff"},choiceSelected:{backgroundColor:"#07182d",borderColor:"#07182d"},choiceText:{fontWeight:"800",color:"#596979",fontSize:12},choiceTextSelected:{color:"#fff"},tripleRow:{flexDirection:"row",gap:8},miniField:{flex:1},
  stateStrip:{gap:7,paddingVertical:2},stateChip:{width:42,height:36,borderRadius:11,borderWidth:1,borderColor:"#dce2e6",backgroundColor:"#fff",alignItems:"center",justifyContent:"center"},stateChipActive:{backgroundColor:"#07182d",borderColor:"#07182d"},stateChipText:{fontSize:11,fontWeight:"900",color:"#657482"},stateChipTextActive:{color:"#fff"},citySelect:{minHeight:50,borderWidth:1,borderColor:"#dce2e6",borderRadius:12,paddingHorizontal:14,backgroundColor:"#fff",flexDirection:"row",alignItems:"center",justifyContent:"space-between"},citySelectText:{fontSize:15,fontWeight:"800",color:"#10233a"},cityPlaceholder:{fontSize:15,color:"#98a2ab"},cityChevron:{fontSize:20,color:"#8e7a55"},cityPicker:{borderWidth:1,borderColor:"#e1d9cd",borderRadius:15,backgroundColor:"#faf8f4",padding:10,gap:8},citySearch:{height:46,borderRadius:11,borderWidth:1,borderColor:"#dce2e6",backgroundColor:"#fff",paddingHorizontal:12,fontSize:14,color:"#10233a"},cityList:{maxHeight:230},cityOption:{minHeight:45,paddingHorizontal:11,borderBottomWidth:1,borderBottomColor:"#ece6dc",flexDirection:"row",alignItems:"center",justifyContent:"space-between"},cityOptionName:{fontSize:13,fontWeight:"800",color:"#14273d"},cityOptionUf:{fontSize:9,fontWeight:"900",color:"#9a722a",backgroundColor:"#f2e8d5",paddingHorizontal:7,paddingVertical:4,borderRadius:999},cityManual:{padding:12,backgroundColor:"#fff8e9",borderRadius:11,marginTop:6},cityManualTitle:{fontSize:13,fontWeight:"900",color:"#72551e"},cityManualText:{fontSize:10,lineHeight:15,color:"#7f735d",marginTop:4},cityEmpty:{fontSize:11,lineHeight:17,color:"#7c8790",padding:12,textAlign:"center"},
  photoHeader:{gap:10},photoActions:{flexDirection:"row",gap:8},smallAction:{backgroundColor:"#f4efe6",borderRadius:10,paddingHorizontal:10,paddingVertical:9},smallActionText:{fontSize:11,fontWeight:"800",color:"#5e4d2d"},photoStrip:{gap:10},photoItem:{width:124,height:112,borderRadius:14,overflow:"hidden",position:"relative",backgroundColor:"#eef1f3"},photo:{width:"100%",height:"100%"},removePhoto:{position:"absolute",right:5,top:5,width:27,height:27,borderRadius:14,backgroundColor:"rgba(7,24,45,.88)",alignItems:"center",justifyContent:"center"},removePhotoText:{color:"#fff",fontSize:20,lineHeight:21},coverLabel:{position:"absolute",left:6,bottom:6,backgroundColor:"#d6ac58",color:"#07182d",paddingHorizontal:7,paddingVertical:4,borderRadius:7,fontSize:8,fontWeight:"900"},photoMove:{position:"absolute",right:5,bottom:5,flexDirection:"row",gap:4},photoMoveText:{backgroundColor:"rgba(255,255,255,.94)",paddingHorizontal:7,paddingVertical:4,borderRadius:7,fontWeight:"900",color:"#07182d"},
  secondaryButton:{minHeight:50,borderRadius:13,borderWidth:1,borderColor:"#d6ac58",backgroundColor:"#fffaf0",alignItems:"center",justifyContent:"center"},secondaryButtonText:{fontWeight:"900",color:"#7c5d23"},primaryButton:{minHeight:52,borderRadius:13,backgroundColor:"#07182d",alignItems:"center",justifyContent:"center"},primaryButtonText:{fontWeight:"900",color:"#fff"},disabled:{opacity:.48},
  emptyCard:{backgroundColor:"#fff",borderRadius:20,padding:24,borderWidth:1,borderColor:"#e5ded3",alignItems:"center"},emptyIcon:{fontSize:30,fontWeight:"900",color:"#d6ac58",marginBottom:7},
  draftCard:{backgroundColor:"#fff",borderRadius:18,padding:15,gap:12,borderWidth:1,borderColor:"#e5ded3"},draftInfo:{flexDirection:"row",alignItems:"center",gap:12},draftThumb:{width:68,height:58,borderRadius:11},draftThumbFallback:{width:68,height:58,borderRadius:11,backgroundColor:"#f1e7d4",alignItems:"center",justifyContent:"center"},draftThumbFallbackText:{fontSize:24,color:"#9a722a"},draftTitle:{fontSize:17,fontWeight:"900",color:"#07182d"},draftMeta:{fontSize:11,color:"#76838e",marginTop:4},draftActions:{flexDirection:"row",gap:9,justifyContent:"flex-end"},editAction:{backgroundColor:"#f4efe6",paddingHorizontal:12,paddingVertical:8,borderRadius:9},deleteAction:{backgroundColor:"#fff1f1",paddingHorizontal:12,paddingVertical:8,borderRadius:9},editLink:{fontWeight:"900",color:"#7e612b",fontSize:11},deleteLink:{fontWeight:"900",color:"#a13b3b",fontSize:11},
  queueCard:{backgroundColor:"#fff",borderRadius:16,padding:15,borderWidth:1,borderColor:"#e5ded3"},queueHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},queueState:{fontSize:8,fontWeight:"900",backgroundColor:"#fff3c7",color:"#745d09",paddingHorizontal:8,paddingVertical:5,borderRadius:999},queueError:{backgroundColor:"#fff0f0",color:"#a13b3b"},errorText:{fontSize:11,lineHeight:17,color:"#a13b3b",marginTop:8},
  logoutButton:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:"#d8d1c7",backgroundColor:"transparent",alignItems:"center",justifyContent:"center"},logoutText:{fontWeight:"900",color:"#6b7580",fontSize:12}
});