import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type LegalSection = {
  heading: string;
  body: string;
};

export type LegalDocument = {
  title: string;
  effectiveLabel: string;
  intro: string;
  sections: LegalSection[];
};

export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{document.title}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.effectiveDate}>{document.effectiveLabel}</Text>
        <Text style={styles.intro}>{document.intro}</Text>

        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const DARK_BG = "#0A0A0F";
const CARD_BG = "#13131A";
const TEXT = "#E4E4E7";
const MUTED = "rgba(228,228,231,0.55)";
const ACCENT = "#EC4899";
const BORDER = "rgba(255,255,255,0.08)";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: TEXT,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  effectiveDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    marginBottom: 10,
  },
  intro: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: TEXT,
    lineHeight: 22,
    marginBottom: 28,
  },
  section: {
    marginBottom: 28,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionHeading: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: ACCENT,
    marginBottom: 10,
  },
  sectionBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: TEXT,
    lineHeight: 22,
  },
});
