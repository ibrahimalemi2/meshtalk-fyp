import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Rect, Path } from "react-native-svg";
import Colors from "@/constants/colors";
import { useMesh } from "@/context/MeshContext";

const C = Colors.dark;
const { width } = Dimensions.get("window");
const QR_SIZE = Math.min(width - 80, 280);

function MockQRCode({ publicKey }: { publicKey: string }) {
  const cells: boolean[][] = [];
  for (let r = 0; r < 21; r++) {
    cells[r] = [];
    for (let c = 0; c < 21; c++) {
      const isFinderRow = r < 7 || r > 13;
      const isFinderCol = c < 7 || c > 13;
      const inFinder = (r < 7 || r > 13) && (c < 7 || c > 13);
      const seedChar = publicKey.charCodeAt((r * 21 + c) % publicKey.length);
      cells[r][c] = inFinder
        ? ((r === 0 || r === 6 || c === 0 || c === 6) ? true : (r > 0 && r < 6 && c > 1 && c < 5) ? true : false)
        : (seedChar + r + c) % 3 === 0;
    }
  }

  const cellSize = QR_SIZE / 21;

  return (
    <Svg width={QR_SIZE} height={QR_SIZE}>
      {cells.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <Rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize - 0.5}
              height={cellSize - 0.5}
              fill={C.accent}
              rx={1}
            />
          ) : null
        )
      )}
    </Svg>
  );
}

export default function QRCodeScreen() {
  const insets = useSafeAreaInsets();
  const { myNode } = useMesh();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const glowOpacity = useSharedValue(0.4);
  useEffect(() => {
    glowOpacity.value = withRepeat(withTiming(0.8, { duration: 2000 }), -1, true);
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!myNode) return null;

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Identity</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={24} color={C.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.qrWrapper}>
          <Animated.View style={[styles.qrGlow, glowStyle]} />
          <View style={styles.qrCard}>
            <MockQRCode publicKey={myNode.publicKey} />
          </View>
        </View>

        <Text style={styles.nodeName}>{myNode.displayName}</Text>
        <Text style={styles.nodeKey} numberOfLines={2}>
          {myNode.publicKey}
        </Text>

        <View style={styles.infoCards}>
          <View style={styles.infoCard}>
            <Ionicons name="lock-closed" size={18} color={C.accent} />
            <Text style={styles.infoLabel}>Ed25519</Text>
            <Text style={styles.infoDesc}>Key Algorithm</Text>
          </View>
          <View style={styles.infoCard}>
            <Feather name="shield" size={18} color={C.accent} />
            <Text style={styles.infoLabel}>Offline</Text>
            <Text style={styles.infoDesc}>Generated</Text>
          </View>
          <View style={styles.infoCard}>
            <Feather name="maximize" size={18} color={C.accent} />
            <Text style={styles.infoLabel}>QR Verify</Text>
            <Text style={styles.infoDesc}>Out-of-band</Text>
          </View>
        </View>

        <Text style={styles.instructions}>
          Have another MeshTalk user scan this code to verify your identity out-of-band, establishing trust without relying on the network.
        </Text>

        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
        >
          <Feather name="share" size={16} color={C.background} />
          <Text style={styles.shareBtnText}>Share Identity</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
  },
  qrWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  qrGlow: {
    position: "absolute",
    width: QR_SIZE + 40,
    height: QR_SIZE + 40,
    borderRadius: 24,
    backgroundColor: C.accent,
    opacity: 0.08,
  },
  qrCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.accent + "30",
  },
  nodeName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  nodeKey: {
    fontSize: 11,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    letterSpacing: 0.5,
    lineHeight: 17,
  },
  infoCards: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  infoCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  infoDesc: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
  },
  instructions: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  shareBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.background,
  },
});
