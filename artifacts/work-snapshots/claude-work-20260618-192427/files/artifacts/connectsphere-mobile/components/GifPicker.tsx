/**
 * GifPicker
 * ──────────
 * Minimal GIPHY search tray rendered above the keyboard.
 * Uses the GIPHY public API (free tier, 100 req/min).
 *
 * Env: EXPO_PUBLIC_GIPHY_API_KEY
 * Falls back to trending GIFs when no key is set (demo mode).
 *
 * onSelect(gif) → parent adds a { type: "gif", gifUrl: gif.url } message.
 */
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

// ─── Types ─────────────────────────────────���─────────────────────────────���───

type GifItem = {
  id: string;
  url: string;           // full size
  previewUrl: string;    // downsized still
  width: number;
  height: number;
};

type GiphyResponse = {
  data: Array<{
    id: string;
    images: {
      downsized: { url: string; width: string; height: string };
      fixed_width: { url: string; width: string; height: string };
    };
  }>;
};

// ─── GIPHY helper ────────────────────────────────────────────────────────────

const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? "dc6zaTOxFJmzC"; // public test key

async function fetchGifs(query: string): Promise<GifItem[]> {
  const endpoint = query.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=pg-13`;

  try {
    const resp = await fetch(endpoint);
    const json = (await resp.json()) as GiphyResponse;
    return json.data.map((item) => ({
      id: item.id,
      url: item.images.fixed_width.url,
      previewUrl: item.images.downsized.url,
      width: parseInt(item.images.fixed_width.width, 10),
      height: parseInt(item.images.fixed_width.height, 10),
    }));
  } catch {
    return [];
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface GifPickerProps {
  visible: boolean;
  onSelect: (gif: GifItem) => void;
  onClose: () => void;
}

export type { GifItem };

export default function GifPicker({ visible, onSelect, onClose }: GifPickerProps) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const results = await fetchGifs(q);
    setGifs(results);
    setLoading(false);
  }, []);

  // Load trending on open
  useEffect(() => {
    if (visible) void load("");
  }, [visible, load]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, load]);

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search GIFs…"
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
        <Pressable onPress={onClose} hitSlop={8} style={{ marginLeft: 4 }}>
          <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Grid */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={gifs}
          keyExtractor={(item) => item.id}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 2 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect(item);
              }}
              style={({ pressed }) => [styles.gifCell, { opacity: pressed ? 0.75 : 1 }]}
            >
              <Image
                source={{ uri: item.previewUrl }}
                style={styles.gifImage}
                contentFit="cover"
              />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No GIFs found</Text>
            </View>
          }
        />
      )}

      {/* GIPHY attribution — required by ToS */}
      <View style={styles.poweredBy}>
        <Text style={[styles.poweredByText, { color: colors.mutedForeground }]}>Powered by GIPHY</Text>
      </View>
    </View>
  );
}

const CELL_SIZE = 110;

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: 320,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  loadingWrap: { height: 160, alignItems: "center", justifyContent: "center" },
  grid: { paddingHorizontal: 2, paddingBottom: 8, gap: 2 },
  gifCell: { width: CELL_SIZE, height: CELL_SIZE },
  gifImage: { width: CELL_SIZE, height: CELL_SIZE },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  poweredBy: { alignItems: "center", paddingVertical: 4 },
  poweredByText: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
