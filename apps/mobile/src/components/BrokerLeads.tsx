import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { getMobileAgencyContext } from "../lib/currentAgency";
import { mobileSupabase } from "../lib/supabase";

type Props={onClose:()=>void};
type LeadStatus="new"|"contacted"|"visit_scheduled"|"won"|"lost";
type LeadQualification="unclassified"|"potential_buyer"|"follow_up"|"price_only"|"no_current_interest"|"other";
type Lead={id:string;name:string|null;phone:string|null;email:string|null;message:string|null;status:LeadStatus;qualification:LeadQualification;created_at:string;properties?:{code?:string;title?:string}|null};
type Followup={id:string;lead_id:string;title:string;due_at:string;completed_at:string|null};
type Note={id:string;lead_id:string;body:string;created_at:string};

const labels:Record<LeadStatus,string>={new:"Novo",contacted:"Contatado",visit_scheduled:"Visita",won:"Fechado",lost:"Perdido"};
const qualificationLabels:Record<LeadQualification,string>={unclassified:"Não classificado",potential_buyer:"Possível comprador",follow_up:"Acompanhar",price_only:"Só consultou preço",no_current_interest:"Sem interesse agora",other:"Outro"};

export default function BrokerLeads({onClose}:Props){
  const [items,setItems]=useState<Lead[]>([]); const [followups,setFollowups]=useState<Followup[]>([]); const [notes,setNotes]=useState<Note[]>([]);
  const [agencyId,setAgencyId]=useState(""); const [brokerId,setBrokerId]=useState(""); const [loading,setLoading]=useState(true); const [message,setMessage]=useState("");
  const [qualificationFilter,setQualificationFilter]=useState<LeadQualification|"all">("all"); const [expanded,setExpanded]=useState(""); const [noteText,setNoteText]=useState("");

  async function load(){
    if(!mobileSupabase)return; setLoading(true); setMessage("");
    const context=await getMobileAgencyContext();
    if(!context||context.role!=="broker"||!context.brokerId){setItems([]);setLoading(false);return setMessage("Não foi possível identificar seu corretor dentro da imobiliária atual.");}
    setAgencyId(context.agencyId); setBrokerId(context.brokerId);
    const [leadResult,followResult,noteResult]=await Promise.all([
      mobileSupabase.from("leads").select("id,name,phone,email,message,status,qualification,created_at,properties(code,title)").eq("agency_id",context.agencyId).eq("broker_id",context.brokerId).order("created_at",{ascending:false}).limit(100),
      mobileSupabase.from("lead_followups").select("id,lead_id,title,due_at,completed_at").eq("agency_id",context.agencyId).order("due_at",{ascending:true}).limit(200),
      mobileSupabase.from("lead_notes").select("id,lead_id,body,created_at").eq("agency_id",context.agencyId).order("created_at",{ascending:false}).limit(300),
    ]);
    if(leadResult.error)setMessage(leadResult.error.message); else setItems((leadResult.data||[]) as unknown as Lead[]);
    if(!followResult.error)setFollowups((followResult.data||[]) as Followup[]);
    if(!noteResult.error)setNotes((noteResult.data||[]) as Note[]);
    setLoading(false);
  }
  useEffect(()=>{void load();},[]);
  const visibleItems=useMemo(()=>qualificationFilter==="all"?items:items.filter(i=>i.qualification===qualificationFilter),[items,qualificationFilter]);

  async function updateStatus(id:string,status:LeadStatus){if(!mobileSupabase||!agencyId||!brokerId)return;const {error}=await mobileSupabase.from("leads").update({status}).eq("id",id).eq("agency_id",agencyId).eq("broker_id",brokerId);if(error)return setMessage(error.message);setItems(c=>c.map(i=>i.id===id?{...i,status}:i));}
  async function updateQualification(id:string,qualification:LeadQualification){if(!mobileSupabase||!agencyId||!brokerId)return;const {error}=await mobileSupabase.from("leads").update({qualification}).eq("id",id).eq("agency_id",agencyId).eq("broker_id",brokerId);if(error)return setMessage(error.message);setItems(c=>c.map(i=>i.id===id?{...i,qualification}:i));}
  function openWhatsApp(phone:string,lead:Lead){const number=phone.replace(/\D/g,"");const code=lead.properties?.code?` sobre o imóvel ${lead.properties.code}`:"";void Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(`Olá${lead.name?` ${lead.name}`:""}, estou retornando seu contato${code}.`)}`);}

  async function addQuickFollowup(lead:Lead,days:number,title:string){
    if(!mobileSupabase||!agencyId)return; const due=new Date(); due.setDate(due.getDate()+days); due.setHours(days===0?due.getHours()+2:9,0,0,0);
    const {error}=await mobileSupabase.from("lead_followups").insert({agency_id:agencyId,lead_id:lead.id,title,due_at:due.toISOString()});
    if(error)return setMessage(error.message); setMessage(`Acompanhamento de ${lead.name||"contato"} agendado.`); await load();
  }
  async function completeFollowup(item:Followup){if(!mobileSupabase||!agencyId)return;const {error}=await mobileSupabase.from("lead_followups").update({completed_at:new Date().toISOString()}).eq("id",item.id).eq("agency_id",agencyId);if(error)return setMessage(error.message);await load();}
  async function addNote(lead:Lead){if(!mobileSupabase||!agencyId||!noteText.trim())return;const {error}=await mobileSupabase.from("lead_notes").insert({agency_id:agencyId,lead_id:lead.id,body:noteText.trim()});if(error)return setMessage(error.message);setNoteText("");setMessage("Nota interna adicionada.");await load();}

  return <ScrollView contentContainerStyle={styles.screen}>
    <View style={styles.hero}><View style={{flex:1}}><Text style={styles.kicker}>CRM DO CORRETOR</Text><Text style={styles.title}>Contatos recebidos</Text><Text style={styles.heroText}>Organize retorno, etapa comercial e próxima ação sem sair do aplicativo.</Text></View><Pressable style={styles.heroAction} onPress={()=>void load()}><Text style={styles.heroActionText}>↻</Text></Pressable></View>
    <View style={styles.head}><Pressable onPress={onClose}><Text style={styles.back}>← Voltar ao início</Text></Pressable><Text style={styles.counter}>{visibleItems.length} contato(s)</Text></View>
    <View style={styles.filterBox}><Text style={styles.filterTitle}>Perfil do comprador</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}><Pressable style={[styles.pill,qualificationFilter==="all"&&styles.pillActive]} onPress={()=>setQualificationFilter("all")}><Text style={[styles.pillText,qualificationFilter==="all"&&styles.pillTextActive]}>Todos</Text></Pressable>{(Object.entries(qualificationLabels) as [LeadQualification,string][]).map(([v,l])=><Pressable key={v} style={[styles.pill,qualificationFilter===v&&styles.pillActive]} onPress={()=>setQualificationFilter(v)}><Text style={[styles.pillText,qualificationFilter===v&&styles.pillTextActive]}>{l}</Text></Pressable>)}</ScrollView></View>
    {message?<View style={styles.message}><Text style={styles.messageText}>{message}</Text></View>:null}
    {loading?<ActivityIndicator size="large" color="#07182d"/>:visibleItems.length===0?<View style={styles.empty}><Text style={styles.emptyIcon}>◎</Text><Text style={styles.emptyTitle}>Nenhum contato</Text><Text style={styles.emptyText}>Nenhum contato corresponde ao filtro atual.</Text></View>:visibleItems.map(lead=>{
      const pending=followups.filter(f=>f.lead_id===lead.id&&!f.completed_at); const leadNotes=notes.filter(n=>n.lead_id===lead.id).slice(0,3); const isOpen=expanded===lead.id;
      return <View style={styles.card} key={lead.id}>
        <View style={styles.cardHead}><View style={styles.avatar}><Text style={styles.avatarText}>{(lead.name||"C").slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.name}>{lead.name||"Contato sem nome"}</Text><Text style={styles.meta}>{lead.properties?.code||"Contato geral"}{lead.properties?.title?` · ${lead.properties.title}`:""}</Text><Text style={styles.date}>{new Date(lead.created_at).toLocaleString("pt-BR")}</Text></View><View style={styles.badges}><Text style={styles.badge}>{labels[lead.status]}</Text><Text style={styles.qualificationBadge}>{qualificationLabels[lead.qualification||"unclassified"]}</Text></View></View>
        {lead.message?<View style={styles.messageBody}><Text style={styles.body}>{lead.message}</Text></View>:null}
        {pending[0]?<View style={styles.nextAction}><Text style={styles.groupLabel}>PRÓXIMA AÇÃO</Text><Text style={styles.nextTitle}>{pending[0].title}</Text><Text style={styles.body}>{new Date(pending[0].due_at).toLocaleString("pt-BR")}</Text><Pressable style={styles.smallDone} onPress={()=>void completeFollowup(pending[0])}><Text style={styles.secondaryText}>Marcar como concluída</Text></Pressable></View>:null}
        <View style={styles.actions}>{lead.phone?<Pressable style={styles.primary} onPress={()=>openWhatsApp(lead.phone!,lead)}><Text style={styles.primaryText}>WhatsApp</Text></Pressable>:null}{lead.phone?<Pressable style={styles.secondary} onPress={()=>void Linking.openURL(`tel:${lead.phone}`)}><Text style={styles.secondaryText}>Ligar</Text></Pressable>:null}{lead.email?<Pressable style={styles.secondary} onPress={()=>void Linking.openURL(`mailto:${lead.email}`)}><Text style={styles.secondaryText}>E-mail</Text></Pressable>:null}<Pressable style={[styles.secondary,isOpen&&styles.secondaryOpen]} onPress={()=>setExpanded(isOpen?"":lead.id)}><Text style={[styles.secondaryText,isOpen&&styles.secondaryOpenText]}>{isOpen?"Fechar CRM":"Abrir CRM"}</Text></Pressable></View>
        <View style={styles.divider}/>
        <View><Text style={styles.groupLabel}>ETAPA DO ATENDIMENTO</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>{(Object.entries(labels) as [LeadStatus,string][]).map(([v,l])=><Pressable key={v} style={[styles.pill,lead.status===v&&styles.pillActive]} onPress={()=>void updateStatus(lead.id,v)}><Text style={[styles.pillText,lead.status===v&&styles.pillTextActive]}>{l}</Text></Pressable>)}</ScrollView></View>
        <View><Text style={styles.groupLabel}>PERFIL DESTE CONTATO</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>{(Object.entries(qualificationLabels) as [LeadQualification,string][]).map(([v,l])=><Pressable key={v} style={[styles.pill,lead.qualification===v&&styles.qualificationActive]} onPress={()=>void updateQualification(lead.id,v)}><Text style={[styles.pillText,lead.qualification===v&&styles.pillTextActive]}>{l}</Text></Pressable>)}</ScrollView></View>
        {isOpen?<View style={styles.crmBox}><Text style={styles.crmTitle}>Próxima ação</Text><View style={styles.actions}><Pressable style={styles.secondary} onPress={()=>void addQuickFollowup(lead,0,"Retornar contato")}><Text style={styles.secondaryText}>Em 2 horas</Text></Pressable><Pressable style={styles.secondary} onPress={()=>void addQuickFollowup(lead,1,"Retornar contato")}><Text style={styles.secondaryText}>Amanhã</Text></Pressable><Pressable style={styles.secondary} onPress={()=>void addQuickFollowup(lead,3,"Acompanhar interesse")}><Text style={styles.secondaryText}>3 dias</Text></Pressable><Pressable style={styles.secondary} onPress={()=>void addQuickFollowup(lead,7,"Acompanhar interesse")}><Text style={styles.secondaryText}>7 dias</Text></Pressable></View><Text style={styles.groupLabel}>NOTA INTERNA</Text><TextInput style={styles.noteInput} multiline value={noteText} onChangeText={setNoteText} placeholder="Observação sobre este cliente" placeholderTextColor="#9aa5ae"/><Pressable style={styles.crmSave} onPress={()=>void addNote(lead)}><Text style={styles.crmSaveText}>Salvar nota</Text></Pressable>{leadNotes.map(n=><View key={n.id} style={styles.note}><Text style={styles.body}>{n.body}</Text><Text style={styles.date}>{new Date(n.created_at).toLocaleString("pt-BR")}</Text></View>)}</View>:null}
      </View>;
    })}
  </ScrollView>;
}

const styles=StyleSheet.create({
  screen:{padding:18,gap:14,backgroundColor:"#f4f1eb",minHeight:"100%"},
  hero:{backgroundColor:"#07182d",borderRadius:24,padding:22,flexDirection:"row",alignItems:"flex-start",gap:12},kicker:{fontSize:9,fontWeight:"900",letterSpacing:1.7,color:"#d6ac58"},title:{fontSize:29,lineHeight:33,fontWeight:"900",color:"#fff",marginTop:7},heroText:{fontSize:13,lineHeight:19,color:"#bfcbd6",marginTop:8,maxWidth:280},heroAction:{width:46,height:46,borderRadius:14,backgroundColor:"#d6ac58",alignItems:"center",justifyContent:"center"},heroActionText:{fontSize:23,fontWeight:"900",color:"#07182d"},
  head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10,paddingHorizontal:2},back:{fontWeight:"900",color:"#40556c"},counter:{fontSize:11,fontWeight:"900",color:"#8a7447"},
  filterBox:{backgroundColor:"#fff",borderRadius:18,padding:15,gap:10,borderWidth:1,borderColor:"#e6dfd3"},filterTitle:{fontSize:11,fontWeight:"900",color:"#526273",letterSpacing:.5},
  message:{backgroundColor:"#fff8e7",borderRadius:13,padding:13,borderWidth:1,borderColor:"#ead8aa"},messageText:{color:"#6e581d",fontWeight:"700"},
  empty:{backgroundColor:"#fff",borderRadius:20,padding:28,alignItems:"center",borderWidth:1,borderColor:"#e6dfd3"},emptyIcon:{fontSize:32,color:"#d6ac58"},emptyTitle:{fontSize:19,fontWeight:"900",color:"#07182d",marginTop:8},emptyText:{marginTop:6,color:"#687785",textAlign:"center"},
  card:{backgroundColor:"#fff",borderRadius:20,padding:17,gap:13,borderWidth:1,borderColor:"#e6dfd3"},cardHead:{flexDirection:"row",alignItems:"flex-start",gap:10},avatar:{width:42,height:42,borderRadius:14,backgroundColor:"#f1e7d4",alignItems:"center",justifyContent:"center"},avatarText:{fontSize:17,fontWeight:"900",color:"#8d6825"},name:{fontSize:18,fontWeight:"900",color:"#07182d"},meta:{fontSize:11,color:"#687785",marginTop:4},date:{fontSize:9,color:"#929ba3",marginTop:4},badges:{alignItems:"flex-end",gap:5,maxWidth:130},badge:{fontSize:9,fontWeight:"900",backgroundColor:"#eef1f3",color:"#3f5061",paddingHorizontal:8,paddingVertical:5,borderRadius:999},qualificationBadge:{fontSize:8,fontWeight:"900",backgroundColor:"#fff5df",color:"#8b6826",paddingHorizontal:8,paddingVertical:5,borderRadius:999,maxWidth:130},
  messageBody:{backgroundColor:"#f8f6f2",borderRadius:13,padding:12},body:{fontSize:13,lineHeight:19,color:"#566572"},actions:{flexDirection:"row",flexWrap:"wrap",gap:8},primary:{backgroundColor:"#25d366",paddingHorizontal:14,paddingVertical:10,borderRadius:11},primaryText:{fontWeight:"900",color:"#092d18"},secondary:{borderWidth:1,borderColor:"#d9dfe3",backgroundColor:"#fff",paddingHorizontal:12,paddingVertical:9,borderRadius:10},secondaryText:{fontWeight:"900",color:"#18304a",fontSize:12},secondaryOpen:{backgroundColor:"#07182d",borderColor:"#07182d"},secondaryOpenText:{color:"#fff"},divider:{height:1,backgroundColor:"#eee9e1"},
  groupLabel:{fontSize:9,fontWeight:"900",color:"#7a8792",marginBottom:8,letterSpacing:.8},statusRow:{gap:7},pill:{paddingHorizontal:11,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:"#dbe1e5",backgroundColor:"#fff"},pillActive:{backgroundColor:"#07182d",borderColor:"#07182d"},qualificationActive:{backgroundColor:"#b98732",borderColor:"#b98732"},pillText:{fontSize:10,fontWeight:"800",color:"#65717c"},pillTextActive:{color:"#fff"},
  nextAction:{backgroundColor:"#f7f2e7",borderRadius:14,padding:13,gap:4,borderWidth:1,borderColor:"#eee0bd"},nextTitle:{fontSize:14,fontWeight:"900",color:"#07182d"},smallDone:{alignSelf:"flex-start",marginTop:7,borderWidth:1,borderColor:"#d8dee3",backgroundColor:"#fff",paddingHorizontal:10,paddingVertical:7,borderRadius:9},
  crmBox:{backgroundColor:"#f5f2ec",borderRadius:16,padding:14,gap:11,borderWidth:1,borderColor:"#e8e0d4"},crmTitle:{fontSize:16,fontWeight:"900",color:"#07182d"},noteInput:{backgroundColor:"#fff",borderWidth:1,borderColor:"#d8dee3",borderRadius:11,padding:12,minHeight:76,textAlignVertical:"top",color:"#17283a"},crmSave:{alignSelf:"flex-start",backgroundColor:"#d6ac58",paddingHorizontal:15,paddingVertical:10,borderRadius:10},crmSaveText:{fontWeight:"900",color:"#07182d"},note:{backgroundColor:"#fff",borderRadius:11,padding:11,borderWidth:1,borderColor:"#ebe5dc"}
});