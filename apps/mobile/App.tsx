import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { getOfflineQueue, processOfflineQueue, startNetworkSyncListener } from "./src/services/offlineQueue";

export default function App() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  async function refreshQueue() {
    const queue = await getOfflineQueue();
    setPending(queue.length);
  }

  async function syncNow() {
    setSyncing(true);
    await processOfflineQueue();
    await refreshQueue();
    setSyncing(false);
  }

  useEffect(() => {
    void refreshQueue();
    const unsubscribe = startNetworkSyncListener();
    const timer = setInterval(() => void refreshQueue(), 5000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>IMOBILIARIAS</Text>
            <Text style={styles.title}>Painel do corretor</Text>
            <Text style={styles.text}>Cadastre imóveis em campo, mesmo sem internet.</Text>
          </View>
          <View style={styles.syncBadge}>
            <Text style={styles.syncNumber}>{pending}</Text>
            <Text style={styles.syncLabel}>pendentes</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Pressable style={styles.primaryCard}>
            <Text style={styles.primaryCardIcon}>＋</Text>
            <Text style={styles.primaryCardTitle}>Novo imóvel</Text>
            <Text style={styles.primaryCardText}>Cadastrar dados, fotos e salvar offline.</Text>
          </Pressable>
          <Pressable style={styles.card}>
            <Text style={styles.cardIcon}>⌂</Text>
            <Text style={styles.cardTitle}>Meus imóveis</Text>
            <Text style={styles.cardText}>Acompanhar publicados e rascunhos.</Text>
          </Pressable>
          <Pressable style={styles.card}>
            <Text style={styles.cardIcon}>▧</Text>
            <Text style={styles.cardTitle}>Rascunhos</Text>
            <Text style={styles.cardText}>Continuar cadastros iniciados em campo.</Text>
          </Pressable>
          <Pressable style={styles.card} onPress={() => void syncNow()}>
            <Text style={styles.cardIcon}>↻</Text>
            <Text style={styles.cardTitle}>{syncing ? "Sincronizando..." : "Sincronizar agora"}</Text>
            <Text style={styles.cardText}>Enviar automaticamente o que ficou offline.</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Modo offline preparado</Text>
          <Text style={styles.infoText}>
            Se a conexão cair durante um cadastro, os dados entram em uma fila local. Quando a internet voltar, o aplicativo tenta novamente sem duplicar a operação.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f6f8" },
  content: { padding: 20, gap: 18 },
  header: { backgroundColor: "#17202a", borderRadius: 24, padding: 24, flexDirection: "row", justifyContent: "space-between", gap: 16 },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 2, color: "#aeb7c0" },
  title: { fontSize: 32, lineHeight: 36, fontWeight: "800", marginTop: 10, color: "#ffffff" },
  text: { fontSize: 15, lineHeight: 22, marginTop: 10, color: "#cbd2d8", maxWidth: 260 },
  syncBadge: { minWidth: 78, alignSelf: "flex-start", backgroundColor: "#ffffff", borderRadius: 18, padding: 12, alignItems: "center" },
  syncNumber: { fontSize: 26, fontWeight: "900", color: "#17202a" },
  syncLabel: { fontSize: 11, color: "#69737d" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  primaryCard: { width: "48%", minHeight: 160, backgroundColor: "#17202a", borderRadius: 20, padding: 20 },
  card: { width: "48%", minHeight: 160, backgroundColor: "#ffffff", borderRadius: 20, padding: 20 },
  primaryCardIcon: { fontSize: 30, color: "#ffffff" },
  primaryCardTitle: { fontSize: 19, fontWeight: "800", color: "#ffffff", marginTop: 22 },
  primaryCardText: { fontSize: 13, lineHeight: 19, color: "#cbd2d8", marginTop: 6 },
  cardIcon: { fontSize: 28, color: "#17202a" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#17202a", marginTop: 22 },
  cardText: { fontSize: 13, lineHeight: 19, color: "#68737e", marginTop: 6 },
  infoCard: { backgroundColor: "#ffffff", borderRadius: 20, padding: 20 },
  infoTitle: { fontSize: 18, fontWeight: "800", color: "#17202a" },
  infoText: { fontSize: 14, lineHeight: 22, color: "#65717c", marginTop: 8 },
});
