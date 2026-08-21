import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getMobileAgencyContext } from "../lib/currentAgency";
import { mobileSupabase } from "../lib/supabase";

type Props = { onClose: () => void };
type LeadStatus = "new" | "contacted" | "visit_scheduled" | "won" | "lost";
type LeadQualification = "unclassified" | "potential_buyer" | "follow_up" | "price_only" | "no_current_interest" | "other";
type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: LeadStatus;
  qualification: LeadQualification;
  created_at: string;
  properties?: { code?: string; title?: string } | null;
};

const labels: Record<LeadStatus, string> = {
  new: "Novo",
  contacted: "Contatado",
  visit_scheduled: "Visita",
  won: "Fechado",
  lost: "Perdido",
};

const qualificationLabels: Record<LeadQualification, string> = {
  unclassified: "Não classificado",
  potential_buyer: "Possível comprador",
  follow_up: "Acompanhar",
  price_only: "Só consultou preço",
  no_current_interest: "Sem interesse agora",
  other: "Outro",
};

export default function BrokerLeads({ onClose }: Props) {
  const [items, setItems] = useState<Lead[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [qualificationFilter, setQualificationFilter] = useState<LeadQualification | "all">("all");

  async function load() {
    if (!mobileSupabase) return;
    setLoading(true);
    setMessage("");
    const context = await getMobileAgencyContext();
    if (!context || context.role !== "broker" || !context.brokerId) {
      setItems([]);
      setLoading(false);
      setMessage("Não foi possível identificar seu corretor dentro da imobiliária atual.");
      return;
    }
    setAgencyId(context.agencyId);
    setBrokerId(context.brokerId);
    const { data, error } = await mobileSupabase
      .from("leads")
      .select("id,name,phone,email,message,status,qualification,created_at,properties(code,title)")
      .eq("agency_id", context.agencyId)
      .eq("broker_id", context.brokerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setMessage(error.message);
    else setItems((data || []) as unknown as Lead[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const visibleItems = useMemo(() => qualificationFilter === "all" ? items : items.filter((item) => item.qualification === qualificationFilter), [items, qualificationFilter]);

  async function updateStatus(id: string, status: LeadStatus) {
    if (!mobileSupabase || !agencyId || !brokerId) return;
    const { error } = await mobileSupabase
      .from("leads")
      .update({ status })
      .eq("id", id)
      .eq("agency_id", agencyId)
      .eq("broker_id", brokerId);
    if (error) return setMessage(error.message);
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  async function updateQualification(id: string, qualification: LeadQualification) {
    if (!mobileSupabase || !agencyId || !brokerId) return;
    setMessage("");
    const { error } = await mobileSupabase
      .from("leads")
      .update({ qualification })
      .eq("id", id)
      .eq("agency_id", agencyId)
      .eq("broker_id", brokerId);
    if (error) return setMessage(error.message);
    setItems((current) => current.map((item) => item.id === id ? { ...item, qualification } : item));
  }

  function openWhatsApp(phone: string, lead: Lead) {
    const number = phone.replace(/\D/g, "");
    const code = lead.properties?.code ? ` sobre o imóvel ${lead.properties.code}` : "";
    void Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(`Olá${lead.name ? ` ${lead.name}` : ""}, estou retornando seu contato${code}.`)}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.head}><Pressable onPress={onClose}><Text style={styles.back}>← Voltar</Text></Pressable><Text style={styles.title}>Contatos recebidos</Text><Pressable onPress={() => void load()}><Text style={styles.refresh}>Atualizar</Text></Pressable></View>
      <View style={styles.filterBox}><Text style={styles.filterTitle}>Classificar / filtrar compradores</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}><Pressable style={[styles.pill, qualificationFilter === "all" && styles.pillActive]} onPress={() => setQualificationFilter("all")}><Text style={[styles.pillText, qualificationFilter === "all" && styles.pillTextActive]}>Todos</Text></Pressable>{(Object.entries(qualificationLabels) as Array<[LeadQualification,string]>).map(([value,label]) => <Pressable key={value} style={[styles.pill, qualificationFilter === value && styles.pillActive]} onPress={() => setQualificationFilter(value)}><Text style={[styles.pillText, qualificationFilter === value && styles.pillTextActive]}>{label}</Text></Pressable>)}</ScrollView></View>
      {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
      {loading ? <ActivityIndicator size="large" /> : visibleItems.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nenhum contato</Text><Text style={styles.emptyText}>{items.length ? "Nenhum contato corresponde a esta classificação." : "Quando alguém pedir informações sobre seus imóveis, aparecerá aqui."}</Text></View> : visibleItems.map((lead) => <View style={styles.card} key={lead.id}>
        <View style={styles.cardHead}><View style={{ flex: 1 }}><Text style={styles.name}>{lead.name || "Contato sem nome"}</Text><Text style={styles.meta}>{lead.properties?.code || "Contato geral"}{lead.properties?.title ? ` · ${lead.properties.title}` : ""}</Text><Text style={styles.date}>{new Date(lead.created_at).toLocaleString("pt-BR")}</Text></View><View style={styles.badges}><Text style={styles.badge}>{labels[lead.status]}</Text><Text style={styles.qualificationBadge}>{qualificationLabels[lead.qualification || "unclassified"]}</Text></View></View>
        {lead.message ? <Text style={styles.body}>{lead.message}</Text> : null}
        <View style={styles.actions}>{lead.phone ? <Pressable style={styles.primary} onPress={() => openWhatsApp(lead.phone!, lead)}><Text style={styles.primaryText}>WhatsApp</Text></Pressable> : null}{lead.phone ? <Pressable style={styles.secondary} onPress={() => void Linking.openURL(`tel:${lead.phone}`)}><Text style={styles.secondaryText}>Ligar</Text></Pressable> : null}{lead.email ? <Pressable style={styles.secondary} onPress={() => void Linking.openURL(`mailto:${lead.email}`)}><Text style={styles.secondaryText}>E-mail</Text></Pressable> : null}</View>
        <View><Text style={styles.groupLabel}>Etapa do atendimento</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>{(Object.entries(labels) as Array<[LeadStatus,string]>).map(([value,label]) => <Pressable key={value} style={[styles.pill, lead.status === value && styles.pillActive]} onPress={() => void updateStatus(lead.id, value)}><Text style={[styles.pillText, lead.status === value && styles.pillTextActive]}>{label}</Text></Pressable>)}</ScrollView></View>
        <View><Text style={styles.groupLabel}>Perfil deste contato</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>{(Object.entries(qualificationLabels) as Array<[LeadQualification,string]>).map(([value,label]) => <Pressable key={value} style={[styles.pill, lead.qualification === value && styles.qualificationActive]} onPress={() => void updateQualification(lead.id, value)}><Text style={[styles.pillText, lead.qualification === value && styles.pillTextActive]}>{label}</Text></Pressable>)}</ScrollView></View>
      </View>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:{padding:20,gap:14,backgroundColor:"#f4f6f8",minHeight:"100%"},head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},back:{fontWeight:"900",color:"#5e6974"},title:{fontSize:22,fontWeight:"900",color:"#17202a"},refresh:{fontWeight:"900",color:"#245f9b"},filterBox:{backgroundColor:"#fff",borderRadius:16,padding:14,gap:9},filterTitle:{fontSize:12,fontWeight:"900",color:"#56616c"},message:{backgroundColor:"#eef5ff",borderRadius:12,padding:12},messageText:{color:"#31577e"},empty:{backgroundColor:"#fff",borderRadius:18,padding:22},emptyTitle:{fontSize:18,fontWeight:"900",color:"#17202a"},emptyText:{marginTop:6,color:"#68737e"},card:{backgroundColor:"#fff",borderRadius:18,padding:18,gap:13},cardHead:{flexDirection:"row",alignItems:"flex-start",gap:10},name:{fontSize:18,fontWeight:"900",color:"#17202a"},meta:{fontSize:12,color:"#697580",marginTop:4},date:{fontSize:10,color:"#9099a1",marginTop:4},badges:{alignItems:"flex-end",gap:5},badge:{fontSize:10,fontWeight:"900",backgroundColor:"#eef1f3",paddingHorizontal:8,paddingVertical:5,borderRadius:999},qualificationBadge:{fontSize:9,fontWeight:"900",backgroundColor:"#eaf4ff",color:"#285a8d",paddingHorizontal:8,paddingVertical:5,borderRadius:999,maxWidth:130},body:{fontSize:14,lineHeight:20,color:"#56636f"},actions:{flexDirection:"row",flexWrap:"wrap",gap:8},primary:{backgroundColor:"#25d366",paddingHorizontal:14,paddingVertical:10,borderRadius:10},primaryText:{fontWeight:"900",color:"#092d18"},secondary:{borderWidth:1,borderColor:"#d8dee3",paddingHorizontal:14,paddingVertical:10,borderRadius:10},secondaryText:{fontWeight:"900",color:"#17202a"},groupLabel:{fontSize:11,fontWeight:"900",color:"#68737e",marginBottom:7},statusRow:{gap:7},pill:{paddingHorizontal:11,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:"#dbe1e5"},pillActive:{backgroundColor:"#17202a",borderColor:"#17202a"},qualificationActive:{backgroundColor:"#245f9b",borderColor:"#245f9b"},pillText:{fontSize:11,fontWeight:"800",color:"#65717c"},pillTextActive:{color:"#fff"}
});
