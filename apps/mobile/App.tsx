import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.kicker}>IMOBILIARIAS</Text>
        <Text style={styles.title}>Aplicativo do corretor</Text>
        <Text style={styles.text}>
          A base do aplicativo está pronta para receber login, cadastro de imóveis,
          fotos e sincronização offline automática.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f6f8",
    padding: 20,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#66717d",
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    marginTop: 10,
    color: "#17202a",
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    color: "#66717d",
  },
});
