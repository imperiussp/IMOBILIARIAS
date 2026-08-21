import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { mobileSupabase } from "../lib/supabase";

type Props = { onClose: () => void };
type Item = {
  id: string; code: string; title: string; status: "available" | "reserved" | "rented" | "sold" | "inactive"; purpose: "sale" | "rent";
  price: number; publication_state?: "draft" | "published"; description?: string | null; address?: string | null; bedrooms?: number | null;
  suites?: number | null; bathrooms?: number | null; parking_spaces?: number | null; built_area_m2?: number | null; land_area_m2?: number | null;
};
type Photo = { id: string; storage_path: string; position: number; is_cover: boolean; signedUrl?: string };

const labels: Record<Item["status"], string> = { available: "Disponível", reserved: "Reservado", rented: "Alugado", sold: "Vendido", inactive: "Inativo" };

export default function PublishedProperties({ onClose }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  async function load() {
    if (!mobileSupabase) return;
    setLoading(true); setMessage("");
    const { data: sessionData } = await mobileSupabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) { setMessage("Sessão inválida."); setLoading(false); return; }
    const { data: broker } = await mobileSupabase.from("brokers").select("id").eq("user_id", userId).eq("active", true).maybeSingle();
    if (!broker) { setMessage("Corretor ativo não encontrado."); setLoading(false); return; }
    const { data, error } = await mobileSupabase.from("properties").select("id,code,title,status,purpose,price,publication_state,description,address,bedrooms,suites,bathrooms,parking_spaces,built_area_m2,land_area_m2").eq("broker_id", broker.id).order("updated_at", { ascending: false });
    if (error) setMessage(error.message);
    else setItems((data || []) as Item[]);
    setLoading(false);
  }

  async function loadPhotos(propertyId: string) {
    if (!mobileSupabase) return;
    const { data, error } = await mobileSupabase.from("property_photos").select("id,storage_path,position,is_cover").eq("property_id", propertyId).order("position");
    if (error) return setMessage(error.message);
    const rows = (data || []) as Photo[];
    const hydrated = await Promise.all(rows.map(async (photo) => {
      const signed = await mobileSupabase!.storage.from("property-photos").createSignedUrl(photo.storage_path, 3600);
      return { ...photo, signedUrl: signed.data?.signedUrl || undefined };
    }));
    setPhotos(hydrated);
  }

  async function openEdit(item: Item) {
    setEditing({ ...item });
    setPhotos([]);
    await loadPhotos(item.id);
  }

  useEffect(() => { void load(); }, []);

  async function setStatus(item: Item, status: Item["status"]) {
    if (!mobileSupabase) return;
    const { error } = await mobileSupabase.from("properties").update({ status }).eq("id", item.id);
    if (error) return setMessage(error.message);
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, status } : row));
    setMessage(`${item.code}: ${labels[status]}.`);
  }

  async function togglePublication(item: Item) {
    if (!mobileSupabase) return;
    const next = item.publication_state === "draft" ? "published" : "draft";
    const { error } = await mobileSupabase.from("properties").update({ publication_state: next, published_at: next === "published" ? new Date().toISOString() : null }).eq("id", item.id);
    if (error) return setMessage(error.message);
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, publication_state: next } : row));
    setMessage(next === "published" ? "Imóvel publicado." : "Imóvel retirado do catálogo e mantido como rascunho.");
  }

  async function saveEdit() {
    if (!mobileSupabase || !editing) return;
    setSaving(true); setMessage("");
    const { error } = await mobileSupabase.from("properties").update({
      title: editing.title.trim(), price: Number(editing.price || 0), description: editing.description?.trim() || null, address: editing.address?.trim() || null,
      bedrooms: Number(editing.bedrooms || 0), suites: Number(editing.suites || 0), bathrooms: Number(editing.bathrooms || 0), parking_spaces: Number(editing.parking_spaces || 0),
      built_area_m2: Number(editing.built_area_m2 || 0) || null, land_area_m2: Number(editing.land_area_m2 || 0) || null,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) return setMessage(error.message);
    setItems((current) => current.map((row) => row.id === editing.id ? { ...row, ...editing } : row));
    setMessage(`${editing.code} atualizado.`);
  }

  async function addPhotoUris(uris: string[]) {
    if (!mobileSupabase || !editing || uris.length === 0) return;
    if (photos.length + uris.length > 20) return Alert.alert("Limite de fotos", "O imóvel pode ter até 20 fotos.");
    setPhotoBusy(true); setMessage("");
    try {
      let nextPosition = photos.length ? Math.max(...photos.map((photo) => photo.position)) + 1 : 0;
      for (const [offset, uri] of uris.entries()) {
        const response = await fetch(uri);
        const blob = await response.blob();
        const rawExtension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
        const extension = ["jpg", "jpeg", "png", "webp"].includes(rawExtension) ? rawExtension : "jpg";
        const storagePath = `${editing.id}/mobile-edit/${Date.now()}-${offset}.${extension}`;
        const upload = await mobileSupabase.storage.from("property-photos").upload(storagePath, blob, { upsert: false, contentType: blob.type || `image/${extension === "jpg" ? "jpeg" : extension}` });
        if (upload.error) throw upload.error;
        const insert = await mobileSupabase.from("property_photos").insert({ property_id: editing.id, storage_path: storagePath, position: nextPosition + offset, is_cover: photos.length === 0 && offset === 0, alt_text: `${editing.title} - foto ${nextPosition + offset + 1}` });
        if (insert.error) throw insert.error;
      }
      await loadPhotos(editing.id);
      setMessage("Fotos adicionadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function choosePhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permissão necessária", "Autorize o acesso às fotos.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.75 });
    if (!result.canceled) await addPhotoUris(result.assets.map((asset) => asset.uri));
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permissão necessária", "Autorize o uso da câmera.");
    const result = await ImagePicker.launchCameraAsync({ quality: 0.75 });
    if (!result.canceled) await addPhotoUris([result.assets[0].uri]);
  }

  async function setCover(photo: Photo) {
    if (!mobileSupabase || !editing) return;
    setPhotoBusy(true);
    const clear = await mobileSupabase.from("property_photos").update({ is_cover: false }).eq("property_id", editing.id);
    if (clear.error) { setPhotoBusy(false); return setMessage(clear.error.message); }
    const apply = await mobileSupabase.from("property_photos").update({ is_cover: true }).eq("id", photo.id);
    setPhotoBusy(false);
    if (apply.error) return setMessage(apply.error.message);
    await loadPhotos(editing.id);
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    if (!mobileSupabase || !editing) return;
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const a = photos[index]; const b = photos[target];
    setPhotoBusy(true);
    const first = await mobileSupabase.from("property_photos").update({ position: b.position }).eq("id", a.id);
    const second = first.error ? null : await mobileSupabase.from("property_photos").update({ position: a.position }).eq("id", b.id);
    setPhotoBusy(false);
    if (first.error || second?.error) return setMessage(first.error?.message || second?.error?.message || "Erro ao reordenar fotos.");
    await loadPhotos(editing.id);
  }

  async function removePhoto(photo: Photo) {
    if (!mobileSupabase || !editing) return;
    Alert.alert("Excluir foto?", "A foto será removida deste imóvel.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => void (async () => {
        setPhotoBusy(true);
        const storage = await mobileSupabase.storage.from("property-photos").remove([photo.storage_path]);
        if (storage.error) { setPhotoBusy(false); return setMessage(storage.error.message); }
        const row = await mobileSupabase.from("property_photos").delete().eq("id", photo.id);
        setPhotoBusy(false);
        if (row.error) return setMessage(row.error.message);
        await loadPhotos(editing.id);
      })() },
    ]);
  }

  if (editing) return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.head}><Pressable onPress={() => setEditing(null)}><Text style={styles.back}>← Voltar</Text></Pressable><Text style={styles.title}>Editar imóvel</Text><View style={{ width: 50 }} /></View>
      {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
      <View style={styles.editCard}>
        <Text style={styles.code}>{editing.code}</Text>
        <Field label="Título" value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })} />
        <Field label="Valor" value={String(editing.price ?? "")} onChangeText={(value) => setEditing({ ...editing, price: Number(value.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0 })} numeric />
        <Field label="Endereço" value={editing.address || ""} onChangeText={(address) => setEditing({ ...editing, address })} />
        <View style={styles.row}><Mini label="Quartos" value={editing.bedrooms} onChange={(bedrooms) => setEditing({ ...editing, bedrooms })} /><Mini label="Suítes" value={editing.suites} onChange={(suites) => setEditing({ ...editing, suites })} /><Mini label="Banheiros" value={editing.bathrooms} onChange={(bathrooms) => setEditing({ ...editing, bathrooms })} /></View>
        <View style={styles.row}><Mini label="Vagas" value={editing.parking_spaces} onChange={(parking_spaces) => setEditing({ ...editing, parking_spaces })} /><Mini label="Área const." value={editing.built_area_m2} onChange={(built_area_m2) => setEditing({ ...editing, built_area_m2 })} /><Mini label="Terreno" value={editing.land_area_m2} onChange={(land_area_m2) => setEditing({ ...editing, land_area_m2 })} /></View>
        <Text style={styles.label}>Descrição</Text><TextInput style={[styles.input, styles.textarea]} multiline value={editing.description || ""} onChangeText={(description) => setEditing({ ...editing, description })} textAlignVertical="top" />
        <Pressable style={styles.primary} disabled={saving} onPress={() => void saveEdit()}><Text style={styles.primaryText}>{saving ? "Salvando..." : "Salvar alterações"}</Text></Pressable>
      </View>

      <View style={styles.editCard}>
        <View style={styles.photoHeader}><View><Text style={styles.sectionTitle}>Fotos do imóvel</Text><Text style={styles.meta}>{photos.length}/20 · a foto marcada como CAPA aparece primeiro</Text></View><View style={styles.photoActions}><Pressable style={styles.smallButton} disabled={photoBusy} onPress={() => void takePhoto()}><Text style={styles.smallButtonText}>📷 Câmera</Text></Pressable><Pressable style={styles.smallButton} disabled={photoBusy} onPress={() => void choosePhotos()}><Text style={styles.smallButtonText}>🖼 Galeria</Text></Pressable></View></View>
        {photoBusy ? <ActivityIndicator /> : null}
        {photos.length === 0 ? <Text style={styles.emptyText}>Nenhuma foto cadastrada.</Text> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>{photos.map((photo, index) => <View style={styles.photoCard} key={photo.id}>{photo.signedUrl ? <Image source={{ uri: photo.signedUrl }} style={styles.photo} /> : <View style={styles.photoFallback} />}<View style={styles.photoBadges}>{photo.is_cover ? <Text style={styles.cover}>CAPA</Text> : null}</View><View style={styles.photoControls}><Pressable disabled={index === 0 || photoBusy} onPress={() => void movePhoto(index, -1)}><Text style={styles.photoControl}>←</Text></Pressable><Pressable disabled={index === photos.length - 1 || photoBusy} onPress={() => void movePhoto(index, 1)}><Text style={styles.photoControl}>→</Text></Pressable><Pressable disabled={photo.is_cover || photoBusy} onPress={() => void setCover(photo)}><Text style={styles.photoControl}>Capa</Text></Pressable><Pressable disabled={photoBusy} onPress={() => void removePhoto(photo)}><Text style={[styles.photoControl, styles.danger]}>Excluir</Text></Pressable></View></View>)}</ScrollView>}
      </View>
    </ScrollView>
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.head}><Pressable onPress={onClose}><Text style={styles.back}>← Voltar</Text></Pressable><Text style={styles.title}>Meus imóveis</Text><Pressable onPress={() => void load()}><Text style={styles.refresh}>Atualizar</Text></Pressable></View>
      {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
      {loading ? <ActivityIndicator size="large" /> : items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhum imóvel cadastrado</Text><Text style={styles.emptyText}>Os imóveis enviados pelo aplicativo aparecerão aqui.</Text></View> : items.map((item) => <View style={styles.card} key={item.id}>
        <View style={styles.cardHead}><View style={styles.info}><Text style={styles.code}>{item.code}</Text><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.meta}>{item.purpose === "sale" ? "Venda" : "Locação"} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.price || 0))}</Text></View><Text style={styles.publication}>{item.publication_state === "draft" ? "RASCUNHO" : "PUBLICADO"}</Text></View>
        <View style={styles.statusRow}>{Object.entries(labels).map(([value, label]) => <Pressable key={value} style={[styles.pill, item.status === value && styles.pillActive]} onPress={() => void setStatus(item, value as Item["status"])}><Text style={[styles.pillText, item.status === value && styles.pillTextActive]}>{label}</Text></Pressable>)}</View>
        <View style={styles.actions}><Pressable style={styles.secondary} onPress={() => void openEdit(item)}><Text style={styles.secondaryText}>Editar dados e fotos</Text></Pressable><Pressable style={styles.secondary} onPress={() => void togglePublication(item)}><Text style={styles.secondaryText}>{item.publication_state === "draft" ? "Publicar" : "Virar rascunho"}</Text></Pressable></View>
      </View>)}
    </ScrollView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; numeric?: boolean }) { return <View><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} keyboardType={props.numeric ? "decimal-pad" : "default"} /></View>; }
function Mini(props: { label: string; value?: number | null; onChange: (value: number) => void }) { return <View style={{ flex: 1 }}><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value == null ? "" : String(props.value)} keyboardType="decimal-pad" onChangeText={(value) => props.onChange(Number(value.replace(",", ".")) || 0)} /></View>; }

const styles = StyleSheet.create({
  screen:{padding:20,gap:14,backgroundColor:"#f4f6f8",minHeight:"100%"},head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:4},back:{fontWeight:"900",color:"#5e6974"},title:{fontSize:24,fontWeight:"900",color:"#17202a"},refresh:{fontWeight:"900",color:"#245f9b"},message:{backgroundColor:"#eef5ff",borderRadius:12,padding:12},messageText:{color:"#31577e",fontSize:13},empty:{backgroundColor:"#fff",borderRadius:18,padding:22},emptyTitle:{fontSize:18,fontWeight:"900",color:"#17202a"},emptyText:{marginTop:6,color:"#68737e"},card:{backgroundColor:"#fff",borderRadius:18,padding:18,gap:14},cardHead:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:12},info:{flex:1},code:{fontSize:10,fontWeight:"900",letterSpacing:1.2,color:"#89939c"},itemTitle:{fontSize:19,fontWeight:"900",color:"#17202a",marginTop:5},meta:{fontSize:12,color:"#6e7983",marginTop:5},publication:{fontSize:9,fontWeight:"900",paddingHorizontal:8,paddingVertical:5,borderRadius:999,backgroundColor:"#eef1f3",color:"#5e6974"},statusRow:{flexDirection:"row",flexWrap:"wrap",gap:7},pill:{paddingHorizontal:10,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:"#dbe1e5"},pillActive:{backgroundColor:"#17202a",borderColor:"#17202a"},pillText:{fontSize:11,fontWeight:"800",color:"#62707c"},pillTextActive:{color:"#fff"},actions:{flexDirection:"row",gap:8},secondary:{flex:1,minHeight:44,borderWidth:1,borderColor:"#d6dde2",borderRadius:11,alignItems:"center",justifyContent:"center"},secondaryText:{fontWeight:"900",color:"#17202a",textAlign:"center"},editCard:{backgroundColor:"#fff",borderRadius:20,padding:20,gap:14},label:{fontSize:12,fontWeight:"800",color:"#59646f",marginBottom:6},input:{borderWidth:1,borderColor:"#dbe1e5",borderRadius:11,minHeight:46,paddingHorizontal:12,color:"#17202a"},textarea:{minHeight:120,paddingTop:12},row:{flexDirection:"row",gap:8},primary:{minHeight:50,backgroundColor:"#17202a",borderRadius:12,alignItems:"center",justifyContent:"center",marginTop:6},primaryText:{color:"#fff",fontWeight:"900"},sectionTitle:{fontSize:18,fontWeight:"900",color:"#17202a"},photoHeader:{gap:10},photoActions:{flexDirection:"row",gap:8},smallButton:{borderWidth:1,borderColor:"#d7dde2",borderRadius:10,paddingHorizontal:12,paddingVertical:9},smallButtonText:{fontWeight:"800",color:"#17202a"},photoStrip:{gap:10},photoCard:{width:190,backgroundColor:"#f7f9fa",borderRadius:14,overflow:"hidden"},photo:{width:"100%",height:130},photoFallback:{width:"100%",height:130,backgroundColor:"#e6eaed"},photoBadges:{position:"absolute",left:7,top:7},cover:{fontSize:9,fontWeight:"900",backgroundColor:"#fff",paddingHorizontal:7,paddingVertical:4,borderRadius:999},photoControls:{flexDirection:"row",flexWrap:"wrap",gap:6,padding:9},photoControl:{fontSize:11,fontWeight:"900",borderWidth:1,borderColor:"#d8dee3",borderRadius:8,paddingHorizontal:8,paddingVertical:6,color:"#17202a"},danger:{color:"#a13b3b"}
});
