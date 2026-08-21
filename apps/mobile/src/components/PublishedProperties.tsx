import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { mobileSupabase } from "../lib/supabase";

type Props = { onClose: () => void };
type Item = { id: string; code: string; title: string; status: "available" | "reserved" | "rented" | "sold" | "inactive"; purpose: "sale" | "rent"; price: number; publication_state?: "draft" | "published" };

const labels: Record<Item["status"], string> = { available: "Disponível", reserved: "Reservado", rented: "Alugado", sold: "Vendido", inactive: "Inativo" };

export default function PublishedProperties({ onClose }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    if (!mobileSupabase) return;
    setLoading(true); setMessage("");
    const { data: sessionData } = await mobileSupabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) { setMessage("Sessão inválida."); setLoading(false); return; }
    const { data: broker } = await mobileSupabase.from("brokers").select("id").eq("user_id", userId).eq("active", true).maybeSingle();
    if (!broker) { setMessage("Corretor ativo não encontrado."); setLoading(false); return; }
    const { data, error } = await mobileSupabase.from("properties").select("id,code,title,status,purpose,price,publication_state").eq("broker_id", broker.id).order("updated_at", { ascending: false });
    if (error) setMessage(error.message);
    else setItems((data || []) as Item[]);
    setLoading(false);
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

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.head}><Pressable onPress={onClose}><Text style={styles.back}>← Voltar</Text></Pressable><Text style={styles.title}>Meus imóveis</Text><Pressable onPress={() => void load()}><Text style={styles.refresh}>Atualizar</Text></Pressable></View>
      {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
      {loading ? <ActivityIndicator size="large" /> : items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhum imóvel publicado</Text><Text style={styles.emptyText}>Os imóveis enviados pelo aplicativo aparecerão aqui.</Text></View> : items.map((item) => <View style={styles.card} key={item.id}>
        <View style={styles.cardHead}><View style={styles.info}><Text style={styles.code}>{item.code}</Text><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.meta}>{item.purpose === "sale" ? "Venda" : "Locação"} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(item.price || 0))}</Text></View><Text style={styles.publication}>{item.publication_state === "draft" ? "RASCUNHO" : "PUBLICADO"}</Text></View>
        <View style={styles.statusRow}>{Object.entries(labels).map(([value, label]) => <Pressable key={value} style={[styles.pill, item.status === value && styles.pillActive]} onPress={() => void setStatus(item, value as Item["status"])}><Text style={[styles.pillText, item.status === value && styles.pillTextActive]}>{label}</Text></Pressable>)}</View>
        <Pressable style={styles.secondary} onPress={() => void togglePublication(item)}><Text style={styles.secondaryText}>{item.publication_state === "draft" ? "Publicar no catálogo" : "Salvar como rascunho"}</Text></Pressable>
      </View>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:{padding:20,gap:14,backgroundColor:"#f4f6f8",minHeight:"100%"},head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:4},back:{fontWeight:"900",color:"#5e6974"},title:{fontSize:24,fontWeight:"900",color:"#17202a"},refresh:{fontWeight:"900",color:"#245f9b"},message:{backgroundColor:"#eef5ff",borderRadius:12,padding:12},messageText:{color:"#31577e",fontSize:13},empty:{backgroundColor:"#fff",borderRadius:18,padding:22},emptyTitle:{fontSize:18,fontWeight:"900",color:"#17202a"},emptyText:{marginTop:6,color:"#68737e"},card:{backgroundColor:"#fff",borderRadius:18,padding:18,gap:14},cardHead:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:12},info:{flex:1},code:{fontSize:10,fontWeight:"900",letterSpacing:1.2,color:"#89939c"},itemTitle:{fontSize:19,fontWeight:"900",color:"#17202a",marginTop:5},meta:{fontSize:12,color:"#6e7983",marginTop:5},publication:{fontSize:9,fontWeight:"900",paddingHorizontal:8,paddingVertical:5,borderRadius:999,backgroundColor:"#eef1f3",color:"#5e6974"},statusRow:{flexDirection:"row",flexWrap:"wrap",gap:7},pill:{paddingHorizontal:10,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:"#dbe1e5"},pillActive:{backgroundColor:"#17202a",borderColor:"#17202a"},pillText:{fontSize:11,fontWeight:"800",color:"#62707c"},pillTextActive:{color:"#fff"},secondary:{minHeight:44,borderWidth:1,borderColor:"#d6dde2",borderRadius:11,alignItems:"center",justifyContent:"center"},secondaryText:{fontWeight:"900",color:"#17202a"}
});
