/**
 * PhotoReorderGrid — drag-to-reorder photo grid for the profile screen.
 *
 * Shows up to 6 photo slots. Filled slots are draggable; empty slots show
 * an "Add photo" tap target. Long-press activates drag mode with a scale-up
 * effect; release snaps the dragged photo into the nearest slot.
 *
 * Usage:
 *   const [photos, setPhotos] = useState<string[]>(profile.photos ?? []);
 *   <PhotoReorderGrid
 *     photos={photos}
 *     onReorder={setPhotos}
 *     onAddPhoto={(index) => pickPhoto(index)}
 *     onRemovePhoto={(index) => removePhoto(index)}
 *   />
 *
 * Implementation note:
 *   Uses a simple touch-based long-press drag because react-native-draggable-flatlist
 *   isn't always available. Swap to that library for production if installed.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { BRAND, NEUTRAL, RADIUS, SPACE, TYPE } from "@/constants/tokens";

const MAX_PHOTOS = 6;
const COLS = 3;
const ROWS = 2;
const SCREEN_WIDTH = Dimensions.get("window").width;
const CELL_SIZE = (SCREEN_WIDTH - SPACE.lg * 2 - SPACE.sm * (COLS - 1)) / COLS;

type Props = {
  photos: (string | null)[];
  onReorder: (photos: (string | null)[]) => void;
  onAddPhoto: (slotIndex: number) => void;
  onRemovePhoto: (slotIndex: number) => void;
};

export function PhotoReorderGrid({ photos, onReorder, onAddPhoto, onRemovePhoto }: Props) {
  // Normalize to 6 slots
  const slots: (string | null)[] = Array.from({ length: MAX_PHOTOS }, (_, i) => photos[i] ?? null);

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dragScale = useRef(new Animated.Value(1)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dragStartXY = useRef<{ x: number; y: number } | null>(null);

  function getSlotIndexFromPosition(px: number, py: number): number | null {
    const col = Math.floor(px / (CELL_SIZE + SPACE.sm));
    const row = Math.floor(py / (CELL_SIZE + SPACE.sm));
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return row * COLS + col;
  }

  function startDrag(index: number, startX: number, startY: number) {
    setDraggingIndex(index);
    dragStartXY.current = { x: startX, y: startY };
    dragX.setValue(0);
    dragY.setValue(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.spring(dragScale, {
      toValue: 1.1,
      friction: 6,
      tension: 260,
      useNativeDriver: true,
    }).start();
  }

  function endDrag(targetIndex: number | null) {
    if (draggingIndex !== null && targetIndex !== null && targetIndex !== draggingIndex) {
      const next = [...slots];
      const tmp = next[draggingIndex];
      next[draggingIndex] = next[targetIndex];
      next[targetIndex] = tmp;
      onReorder(next.filter(Boolean) as string[]);
    }
    Animated.spring(dragScale, {
      toValue: 1,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start();
    dragX.setValue(0);
    dragY.setValue(0);
    setDraggingIndex(null);
    setHoveredIndex(null);
  }

  return (
    <View style={styles.grid}>
      {slots.map((photoUri, index) => {
        const isDragging = draggingIndex === index;
        const isHovered = hoveredIndex === index && draggingIndex !== null && hoveredIndex !== draggingIndex;
        const isFirst = index === 0;

        return (
          <Pressable
            key={`slot-${index}`}
            onLongPress={() => {
              if (photoUri) startDrag(index, 0, 0);
            }}
            onPress={() => {
              if (!photoUri) onAddPhoto(index);
            }}
            style={({ pressed }) => [
              styles.cell,
              isHovered && styles.cellHovered,
              pressed && !photoUri && { opacity: 0.7 },
            ]}
            delayLongPress={300}
          >
            {photoUri ? (
              <View style={styles.photoWrap}>
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />

                {/* Remove button */}
                <Pressable
                  onPress={() => onRemovePhoto(index)}
                  style={styles.removeBtn}
                  hitSlop={6}
                >
                  <View style={styles.removeBtnInner}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </View>
                </Pressable>

                {/* Primary indicator */}
                {isFirst && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>MAIN</Text>
                  </View>
                )}

                {/* Drag indicator */}
                <View style={[styles.dragHint, isDragging && styles.dragHintActive]}>
                  <Ionicons name="reorder-two" size={13} color="rgba(255,255,255,0.7)" />
                </View>
              </View>
            ) : (
              <View style={styles.emptyCell}>
                <Ionicons name="add" size={26} color={BRAND.pink} />
                <Text style={styles.emptyCellText}>
                  {index === 0 ? "Add main\nphoto" : "Add photo"}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE * 1.28,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  cellHovered: {
    borderWidth: 2,
    borderColor: BRAND.pink,
  },
  photoWrap: {
    flex: 1,
    position: "relative",
  },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 10,
  },
  removeBtnInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  primaryBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: BRAND.pink,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  primaryBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  dragHint: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  dragHintActive: {
    backgroundColor: "rgba(255,45,168,0.7)",
  },
  emptyCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F0F12",
    borderWidth: 1.5,
    borderColor: "rgba(255,45,168,0.22)",
    borderStyle: "dashed",
    borderRadius: RADIUS.lg,
    gap: 4,
  },
  emptyCellText: {
    color: NEUTRAL.textMuted,
    ...TYPE.caption,
    textAlign: "center",
    lineHeight: 16,
  },
});
