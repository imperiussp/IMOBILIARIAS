import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { getMobileAgencyContext } from "../lib/currentAgency";
import { mobilePropertyPhotoPaths } from "../lib/storagePaths";
import { mobileSupabase } from "../lib/supabase";
import { preparePropertyPhoto } from "../services/imageProcessing";

type Props = { onClose: () => void };
type Item = {
  id: string; code: string; title: string; status: "available" | "reserved" | "rented" | "sold" | "inactive"; purpose: "sale" | "rent";
  price: number; publication_state?: "draft" | "published"; description?: string | null; address?: string | null; bedrooms?: number | null;
  suites?: number | null; bathrooms?: number | null; parking_spaces?: number | null; built_area_m2?: number | null; land_area_m2?: number | null;
};
type Photo = { id: string; storage_path: string; thumbnail_path?: string | null; position: number; is_cover: boolean; signedUrl?: string };

const labels: Record<Item["status"], string> = { available: "Disponível", reserved: "Reservado", rented: "Alugado", sold: "Vendido", inactive: "Inativo" };

async function blobFromUri(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Não foi possível preparar a imagem para envio.");
  return response.blob();
}

export default function PublishedProperties({ onClose }: Props) {
  const [agencyId, setAgencyId] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [brokerId, setBrokerId] = useState("");
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
    const context = await getMobileAgencyContext();
    if (!context || context.role !== "broker" || !context.brokerId) {
      setMessage("Corretor ativo e imobiliária vinculada não encontrados.");
      setLoading(false);
      return;
    }
    setAgencyId(context.agencyId);
    setAgencyName(context.agencyName);
    setBrokerId(context.brokerId);
    const { data, error } = await mobileSupabase
      .from("properties")
      .select("id,code,title,status,purpose,price,publication_state,description,address,bedrooms,suites,bathrooms,parking_spaces,built_area_m2,land_area_m2")
      .eq("agency_id", context.agencyId)
      .eq("broker_id", context.brokerId)
      .order("updated_at", { ascending: false });
    if (error) setMessage(error.message);
    else setItems((data || []) as Item[]);
    setLoading(false);
  }

  async function loadPhotos(propertyId: string) {
    if (!mobileSupabase || !agencyId || !brokerId) return;
    const allowed = await mobileSupabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("agency_id", agencyId)
      .eq("broker_id", brokerId)
      .maybeSingle();
    if (allowed.error || !allowed.data) return setMessage("Este imóvel não pertence ao corretor desta imobiliária.");

    const { data, error } = await mobileSupabase
      .from("property_photos")
      .select("id,storage_path,thumbnail_path,position,is_cover")
      .eq("property_id", propertyId)
      .order("position");
    if (error) return setMessage(error.message);
    const rows = (data || []) as Photo[];
    const hydrated = await Promise.all(rows.map(async (photo) => {
      const previewPath = photo.thumbnail_path || photo.storage_path;
      const signed = await mobileSupabase!.storage.from("property-photos").createSignedUrl(previewPath, 3600);
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
    if (!mobileSupabase || !agencyId || !brokerId) return;
    const { error } = await mobileSupabase
      .from("properties")
      .update({ status })
      .eq("id", item.id)
      .eq("agency_id", agencyId)
      .eq("broker_id", brokerId);
    if (error) return setMessage(error.message);
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, status } : row));
    setMessage(`${item.code}: ${labels[status]}.`);
  }

  async function togglePublication(item: Item) {
    if (!mobileSupabase || !agencyId || !brokerId) return;
    const next = item.publication_state === "draft" ? "published" : "draft";
    const { error } = await mobileSupabase
      .from("properties")
      .update({ publication_state: next, published_at: next === "published" ? new Date().toISOString() : null })
      .eq("id", item.id)
      .eq("agency_id", agencyId)
      .eq("broker_id", brokerId);
    if (error) return setMessage(error.message);
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, publication_state: next } : row));
    setMessage(next === "published" ? "Imóvel publicado." : "Imóvel retirado do catálogo e mantido como rascunho.");
  }

  async function saveEdit() {
    if (!mobileSupabase || !editing || !agencyId || !brokerId) return;
    setSaving(true); setMessage("");
    const { error } = await mobileSupabase.from("properties").update({
      title: editing.title.trim(), price: Number(editing.price || 0), description: editing.description?.trim() || null, address: editing.address?.trim() || null,
      bedrooms: Number(editing.bedrooms || 0), suites: Number(editing.suites || 0), bathrooms: Number(editing.bathrooms || 0), parking_spaces: Number(editing.parking_spaces || 0),
      built_area_m2: Number(editing.built_area_m2 || 0) || null, land_area_m2: Number(editing.land_area_m2 || 0) || null,
    }).eq("id", editing.id).eq("agency_id", agencyId).eq("broker_id", brokerId);
    setSaving(false);
    if (error) return setMessage(error.message);
    setItems((current) => current.map((row) => row.id === editing.id ? { ...row, ...editing } : row));
    setMessage(`${editing.code} atualizado.`);
  }

  async function addPhotoUris(uris: string[]) {
    if (!mobileSupabase || !editing || !agencyId || !brokerId || uris.length === 0) return;
    if (photos.length + uris.length > 20) return Alert.alert("Limite de fotos", "O imóvel pode ter até 20 fotos.");
    setPhotoBusy(true); setMessage("");
    const createdPaths: string[] = [];
    const insertedPhotoIds: string[] = [];
    try {
      const allowed = await mobileSupabase.from("properties").select("id").eq("id", editing.id).eq("agency_id", agencyId).eq("broker_id", brokerId).maybeSingle();
      if (allowed.error || !allowed.data) throw new Error("Este imóvel não pertence ao corretor desta imobiliária.");

      const nextPosition = photos.length ? Math.max(...photos.map((photo) => photo.position)) + 1 : 0;
      for (const [offset, uri] of uris.entries()) {
        const prepared = await preparePropertyPhoto(uri);
        const [fullBlob, thumbnailBlob] = await Promise.all([blobFromUri(prepared.fullUri), blobFromUri(prepared.thumbnailUri)]);
        const paths = mobilePropertyPhotoPaths(agencyId, editing.id, "mobile-edit", `${Date.now()}-${offset}`);
        const storagePath = paths.full;
        const thumbnailPath = paths.thumbnail;

        const upload = await mobileSupabase.storage.from("property-photos").upload(storagePath, fullBlob, { upsert: false, contentType: "image/jpeg", cacheControl: "31536000" });
        if (upload.error) throw upload.error;
        createdPaths.push(storagePath);

        const thumbUpload = await mobileSupabase.storage.from("property-photos").upload(thumbnailPath, thumbnailBlob, { upsert: false, contentType: "image/jpeg", cacheControl: "31536000" });
        if (thumbUpload.error) throw thumbUpload.error;
        createdPaths.push(thumbnailPath);

        const insert = await mobileSupabase.from("property_photos").insert({
          property_id: editing.id,
          storage_path: storagePath,
          thumbnail_path: thumbnailPath,
          position: nextPosition + offset,
          is_cover: photos.length === 0 && offset === 0,
          alt_text: `${editing.title} - foto ${nextPosition + offset + 1}`,
        }).select("id").single();
        if (insert.error) throw insert.error;
        insertedPhotoIds.push(insert.data.id);
      }
      await loadPhotos(editing.id);
      setMessage("Fotos adicionadas e otimizadas.");
    } catch (error) {
      if (insertedPhotoIds.length) {
        await mobileSupabase.from("property_photos").delete().in("id", insertedPhotoIds).eq("property_id", editing.id);
      }
      if (createdPaths.length) await mobileSupabase.storage.from("property-photos").remove(createdPaths);
      await loadPhotos(editing.id);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function choosePhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permissão necessária", "Autorize o acesso às fotos.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 1 });
    if (!result.canceled) await addPhotoUris(result.assets.map((asset) => asset.uri));
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permissão necessária", "Autorize o uso da câmera.");
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled) await addPhotoUris([result.assets[0].uri]);
  }

  async function setCover(photo: Photo) {
    if (!mobileSupabase || !editing || !agencyId || !brokerId) return;
    setPhotoBusy(true);
    const allowed = await mobileSupabase.from("properties").select("id").eq("id", editing.id).eq("agency_id", agencyId).eq("broker_id", brokerId).maybeSingle();
    if (allowed.error || !allowed.data) { setPhotoBusy(false); return setMessage("Imóvel fora da imobiliária atual."); }
    const clear = await mobileSupabase.from("property_photos").update({ is_cover: false }).eq("property_id", editing.id);
    if (clear.error) { setPhotoBusy(false); return setMessage(clear.error.message); }
    const apply = await mobileSupabase.from("property_photos").update({ is_cover: true }).eq("id", photo.id).eq("property_id", editing.id);
    setPhotoBusy(false);
    if (apply.error) return setMessage(apply.error.message);
    await loadPhotos(editing.id);
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    if (!mobileSupabase || !editing || !agencyId || !brokerId) return;
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const allowed = await mobileSupabase.from("properties").select("id").eq("id", editing.id).eq("agency_id", agencyId).eq("broker_id", brokerId).maybeSingle();
    if (allowed.error || !allowed.data) return setMessage("Imóvel fora da imobiliária atual.");
    const a = photos[index]; const b = photos[target];
    setPhotoBusy(true);
    const first = await mobileSupabase.from("property_photos").update({ position: b.position }).eq("id", a.id).eq("property_id", editing.id);
    const second = first.error ? null : await mobileSupabase.from("property_photos").update({ position: a.position }).eq("id", b.id).eq("property_id", editing.id);
    setPhotoBusy(false);
    if (first.error || second?.error) return setMessage(first.error?.message || second?.error?.message || "Erro ao reordenar fotos.");
    await loadPhotos(editing.id);
  }

  async function removePhoto(photo: Photo) {
    if (!mobileSupabase || !editing || !agencyId || !brokerId) return;
    Alert.alert("Excluir foto?", "A foto será removida deste imóvel.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => void (async () => {
        setPhotoBusy(true);
        const allowed = await mobileSupabase!.from("properties").select("id").eq("id", editing.id).eq("agency_id", agencyId).eq("broker_id", brokerId).maybeSingle();
        if (allowed.error || !allowed.data) { setPhotoBusy(false); return setMessage("Imóvel fora da imobiliária atual."); }
        const paths = [photo.storage_path, photo.thumbnail_path].filter(Boolean) as string[];
        const storage = paths.length ? await mobileSupabase!.storage.from("property-photos").remove(paths) : null;
        if (storage?.error) { setPhotoBusy(false); return setMessage(storage.error.message); }
        const row = await mobileSupabase!.from("property_photos").delete().eq("id", photo.id).eq("property_id", editing.id);
        setPhotoBusy(false);
        if (row.error) return setMessage(row.error.message);
        await loadPhotos(editing.id);
      })() },
    ]);
  }

  if (editing) return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}><Pressable onPress={() => setEditing(null)}><Text style={styles.backLight}>← Voltar</Text></Pressable><Text style={styles.kicker}>GESTÃO DO IMÓVEL</Text><Text style={styles.heroTitle}>Editar imóvel</Text><Text style={styles.heroText}>Atualize dados, preço e fotos sem sair do aplicativo.</Text></View>
      {agencyName ? <Text style={styles.tenantName}>{agencyName}</Text> : null}
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
        <View style={styles.photoHeader}><View><Text style={styles.sectionTitle}>Fotos do imóvel</Text><Text style={styles.meta}>{photos.length}/20 · imagens otimizadas + miniaturas</Text></View><View style={styles.photoActions}><Pressable style={styles.smallButton} disabled={photoBusy} onPress={() => void takePhoto()}><Text style={styles.smallButtonText}>📷 Câmera</Text></Pressable><Pressable style={styles.smallButton} disabled={photoBusy} onPress={() => void choosePhotos()}><Text style={styles.smallButtonText}>🖼 Galeria</Text></Pressable></View></View>
        {photoBusy ? <ActivityIndicator color="#07182d" /> : null}
        {photos.length === 0 ? <Text style={styles.emptyText}>Nenhuma foto cadastrada.</Text> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>{photos.map((photo, index) => <View style={styles.photoCard} key={photo.id}>{photo.signedUrl ? <Image source={{ uri: photo.signedUrl }} style={styles.photo} /> : <View style={styles.photoFallback} />}<View style={styles.photoBadges}>{photo.is_cover ? <Text style={styles.cover}>CAPA</Text> : null}</View><View style={styles.photoControls}><Pressable disabled={index === 0 || photoBusy} onPress={() => void movePhoto(index, -1)}><Text style={styles.photoControl}>←</Text></Pressable><Pressable disabled={index === photos.length - 1 || photoBusy} onPress={() => void movePhoto(index, 1)}><Text style={styles.photoControl}>→</Text></Pressable><Pressable disabled={photo.is_cover || photoBusy} onPress={() => void setCover(photo)}><Text style={styles.photoControl}>Capa</Text></Pressable><Pressable disabled={photoBusy} onPress={() => void removePhoto(photo)}><Text style={[styles.photoControl, styles.danger]}>Excluir</Text></Pressable></View></View>)}</ScrollView>}
      </View>
    </ScrollView>
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.hero}><View style={styles.heroTop}><Pressable onPress={onClose}><Text style={styles.backLight}>← Voltar</Text></Pressable><Pressable onPress={() => void load()}><Text style={styles.refreshLight}>↻ Atualizar</Text></Pressable></View><Text style={styles.kicker}>PORTFÓLIO DO CORRETOR</Text><Text style={styles.heroTitle}>Meus imóveis</Text><Text style={styles.heroText}>Gerencie publicação, situação, dados e fotos dos seus imóveis.</Text></View>
      {agencyName ? <Text style={styles.tenantName}>{agencyName}</Text> : null}
      {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
      {loading ? <ActivityIndicator size="large" color="#07182d" /> : items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyIcon}>⌂</Text><Text style={styles.emptyTitle}>Nenhum imóvel cadastrado</Text><Text style={styles.emptyText}>Os imóveis enviados por este corretor aparecerão aqui.</Text></View> : items.map((item) => <View style={styles.card} key={item.id}>
        <View style={styles.cardHead}><View style={styles.info}><Text style={styles.code}>{item.code}</Text><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.meta}>{item.purpose === "sale" ? "Venda" : "Locação"} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.price || 0))}</Text></View><Text style={[styles.publication,item.publication_state === "published" && styles.publicationActive]}>{item.publication_state === "draft" ? "RASCUNHO" : "PUBLICADO"}</Text></View>
        <View style={styles.statusRow}>{Object.entries(labels).map(([value, label]) => <Pressable key={value} style={[styles.pill, item.status === value && styles.pillActive]} onPress={() => void setStatus(item, value as Item["status"])}><Text style={[styles.pillText, item.status === value && styles.pillTextActive]}>{label}</Text></Pressable>)}</View>
        <View style={styles.actions}><Pressable style={styles.secondary} onPress={() => void openEdit(item)}><Text style={styles.secondaryText}>Editar dados e fotos</Text></Pressable><Pressable style={styles.secondary} onPress={() => void togglePublication(item)}><Text style={styles.secondaryText}>{item.publication_state === "draft" ? "Publicar" : "Virar rascunho"}</Text></Pressable></View>
      </View>)}
    </ScrollView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; numeric?: boolean }) { return <View><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value} onChangeText={props.onChangeText} keyboardType={props.numeric ? "decimal-pad" : "default"} /></View>; }
function Mini(props: { label: string; value?: number | null; onChange: (value: number) => void }) { return <View style={{ flex: 1 }}><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} value={props.value == null ? "" : String(props.value)} keyboardType="decimal-pad" onChangeText={(value) => props.onChange(Number(value.replace(",", ".")) || 0)} /></View>; }

const styles = StyleSheet.create({
  screen:{padding:18,gap:14,backgroundColor:"#f4f1eb",minHeight:"100%"},
  hero:{backgroundColor:"#07182d",borderRadius:24,padding:21,borderWidth:1,borderColor:"#102c4c"},heroTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:18},backLight:{fontWeight:"900",color:"#d6ac58",fontSize:12},refreshLight:{fontWeight:"900",color:"#d6ac58",fontSize:12},kicker:{fontSize:9,fontWeight:"900",letterSpacing:1.5,color:"#d6ac58"},heroTitle:{fontSize:30,fontWeight:"900",color:"#fff",marginTop:6},heroText:{fontSize:13,lineHeight:19,color:"#bdc9d4",marginTop:7,maxWidth:300},
  tenantName:{fontSize:10,fontWeight:"900",color:"#8a7447",textAlign:"center",letterSpacing:.5},message:{backgroundColor:"#fff8e7",borderRadius:13,padding:13,borderWidth:1,borderColor:"#ead8aa"},messageText:{color:"#6e581d",fontSize:12,fontWeight:"700"},
  empty:{backgroundColor:"#fff",borderRadius:20,padding:26,alignItems:"center",borderWidth:1,borderColor:"#e5ded3"},emptyIcon:{fontSize:31,color:"#d6ac58"},emptyTitle:{fontSize:18,fontWeight:"900",color:"#07182d",marginTop:8},emptyText:{marginTop:6,color:"#687785",textAlign:"center"},
  card:{backgroundColor:"#fff",borderRadius:20,padding:17,gap:14,borderWidth:1,borderColor:"#e5ded3"},cardHead:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:12},info:{flex:1},code:{fontSize:9,fontWeight:"900",letterSpacing:1.2,color:"#a1772c"},itemTitle:{fontSize:19,fontWeight:"900",color:"#07182d",marginTop:5},meta:{fontSize:11,color:"#6e7b87",marginTop:5},publication:{fontSize:8,fontWeight:"900",paddingHorizontal:8,paddingVertical:5,borderRadius:999,backgroundColor:"#eef1f3",color:"#5e6974"},publicationActive:{backgroundColor:"#edf6ef",color:"#2e7349"},
  statusRow:{flexDirection:"row",flexWrap:"wrap",gap:7},pill:{paddingHorizontal:10,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:"#dbe1e5",backgroundColor:"#fff"},pillActive:{backgroundColor:"#07182d",borderColor:"#07182d"},pillText:{fontSize:10,fontWeight:"800",color:"#62707c"},pillTextActive:{color:"#fff"},actions:{flexDirection:"row",gap:8},secondary:{flex:1,minHeight:44,borderWidth:1,borderColor:"#d6d0c7",backgroundColor:"#fff",borderRadius:11,alignItems:"center",justifyContent:"center",paddingHorizontal:8},secondaryText:{fontWeight:"900",color:"#07182d",textAlign:"center",fontSize:11},
  editCard:{backgroundColor:"#fff",borderRadius:20,padding:19,gap:14,borderWidth:1,borderColor:"#e5ded3"},label:{fontSize:10,fontWeight:"900",color:"#596979",marginBottom:6,letterSpacing:.4},input:{borderWidth:1,borderColor:"#dbe1e5",borderRadius:11,minHeight:46,paddingHorizontal:12,color:"#10233a",backgroundColor:"#fff"},textarea:{minHeight:120,paddingTop:12},row:{flexDirection:"row",gap:8},primary:{minHeight:50,backgroundColor:"#07182d",borderRadius:12,alignItems:"center",justifyContent:"center",marginTop:6},primaryText:{color:"#fff",fontWeight:"900"},sectionTitle:{fontSize:18,fontWeight:"900",color:"#07182d"},
  photoHeader:{gap:10},photoActions:{flexDirection:"row",gap:8},smallButton:{borderWidth:1,borderColor:"#d7d1c8",backgroundColor:"#f7f2e8",borderRadius:10,paddingHorizontal:12,paddingVertical:9},smallButtonText:{fontWeight:"900",color:"#765a27",fontSize:11},photoStrip:{gap:10},photoCard:{width:190,backgroundColor:"#f7f5f1",borderRadius:14,overflow:"hidden",borderWidth:1,borderColor:"#e5ded3"},photo:{width:"100%",height:130},photoFallback:{width:"100%",height:130,backgroundColor:"#e6eaed"},photoBadges:{position:"absolute",left:7,top:7},cover:{fontSize:8,fontWeight:"900",backgroundColor:"#d6ac58",color:"#07182d",paddingHorizontal:7,paddingVertical:4,borderRadius:999},photoControls:{flexDirection:"row",flexWrap:"wrap",gap:6,padding:9},photoControl:{fontSize:10,fontWeight:"900",borderWidth:1,borderColor:"#d8dee3",backgroundColor:"#fff",borderRadius:8,paddingHorizontal:8,paddingVertical:6,color:"#07182d"},danger:{color:"#a13b3b"}
});