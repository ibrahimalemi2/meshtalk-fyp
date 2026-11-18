import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMesh } from "@/context/MeshContext";

const C = Colors.dark;

function RadarPulse() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  React.useEffect(() => {
    scale.value = withRepeat(withTiming(2.5, { duration: 2000 }), -1);
    opacity.value = withRepeat(withTiming(0, { duration: 2000 }), -1);
  }, []);

  const style1 = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const scale2 = useSharedValue(1);
  const opacity2 = useSharedValue(0.6);
  React.useEffect(() => {
    setTimeout(() => {
      scale2.value = withRepeat(withTiming(2.5, { duration: 2000 }), -1);
      opacity2.value = withRepeat(withTiming(0, { duration: 2000 }), -1);
    }, 666);
  }, []);
  const style2 = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: opacity2.value,
  }));

  const scale3 = useSharedValue(1);
  const opacity3 = useSharedValue(0.4);
  React.useEffect(() => {
    setTimeout(() => {
      scale3.value = withRepeat(withTiming(2.5, { duration: 2000 }), -1);
      opacity3.value = withRepeat(withTiming(0, { duration: 2000 }), -1);
    }, 1333);
  }, []);
  const style3 = useAnimatedStyle(() => ({
    transform: [{ scale: scale3.value }],
    opacity: opacity3.value,
  }));

  const containerSize = 60;
  const circleStyle = {
    width: containerSize,
    height: containerSize,
    borderRadius: containerSize / 2,
    borderWidth: 1.5,
    borderColor: C.danger,
    position: "absolute" as const,
  };

  return (
    <View style={styles.radarContainer}>
      <Animated.View style={[circleStyle, style3]} />
      <Animated.View style={[circleStyle, style2]} />
      <Animated.View style={[circleStyle, style1]} />
      <View style={styles.radarCenter}>
        <Ionicons name="radio" size={24} color={C.danger} />
      </View>
    </View>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function BroadcastScreen() {
  const insets = useSafeAreaInsets();
  const { broadcasts, sendBroadcast, peers } = useMesh();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg) return;
    Alert.alert(
      "Emergency Broadcast",
      "This message will be sent UNENCRYPTED to ALL nodes in range. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Broadcast",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setIsSending(true);
            await sendBroadcast(msg);
            setText("");
            setIsSending(false);
          },
        },
      ]
    );
  };

  const reachableNodes = peers.filter((p) => p.status !== "offline").length;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Global Shout</Text>
      </View>

      <FlatList
        data={broadcasts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.heroSection}>
              <RadarPulse />
              <Text style={styles.heroTitle}>Emergency Broadcast</Text>
              <Text style={styles.heroSubtitle}>
                Bypasses E2EE · Reaches all {reachableNodes} nodes in range
              </Text>
            </View>

            <View style={styles.warningCard}>
              <Ionicons name="warning" size={16} color={C.warning} />
              <Text style={styles.warningText}>
                Broadcasts are unencrypted and visible to every node in the mesh. Use only for genuine emergencies.
              </Text>
            </View>

            <View style={styles.composeBox}>
              <TextInput
                style={styles.composeInput}
                value={text}
                onChangeText={setText}
                placeholder="Emergency message..."
                placeholderTextColor={C.textMuted}
                multiline
                maxLength={500}
              />
              <Pressable
                onPress={handleSend}
                disabled={!text.trim() || isSending}
                style={({ pressed }) => [
                  styles.broadcastBtn,
                  (!text.trim() || isSending) && styles.broadcastBtnDisabled,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="radio" size={18} color={C.text} />
                <Text style={styles.broadcastBtnText}>
                  {isSending ? "Broadcasting..." : "Broadcast Now"}
                </Text>
              </Pressable>
            </View>

            {broadcasts.length > 0 && (
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Broadcast History</Text>
              </View>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
        renderItem={({ item }) => (
          <View style={styles.broadcastItem}>
            <View style={styles.broadcastItemHeader}>
              <View style={styles.broadcastBadge}>
                <Ionicons name="radio" size={10} color={C.danger} />
                <Text style={styles.broadcastBadgeText}>SHOUT</Text>
              </View>
              <Text style={styles.broadcastTime}>{formatTime(item.timestamp)}</Text>
            </View>
            <Text style={styles.broadcastContent}>{item.content}</Text>
            <Text style={styles.broadcastMeta}>
              {item.hops} hops · unencrypted
            </Text>
          </View>
        )}
        ListEmptyComponent={<View />}
      />
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: C.danger,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 14,
  },
  radarContainer: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  radarCenter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.danger + "15",
    borderWidth: 2,
    borderColor: C.danger + "50",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
  },
  warningCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: C.warning + "10",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.warning + "30",
    padding: 12,
    gap: 10,
    alignItems: "flex-start",
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.warning,
    lineHeight: 19,
  },
  composeBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.danger + "30",
    overflow: "hidden",
  },
  composeInput: {
    padding: 14,
    fontSize: 15,
    color: C.text,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
  },
  broadcastBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.danger,
    margin: 12,
    marginTop: 0,
    borderRadius: 12,
    paddingVertical: 14,
  },
  broadcastBtnDisabled: {
    opacity: 0.4,
  },
  broadcastBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  historyHeader: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  historyTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  broadcastItem: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: C.danger + "08",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.danger + "25",
    padding: 14,
    gap: 6,
  },
  broadcastItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  broadcastBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  broadcastBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: C.danger,
    letterSpacing: 1,
  },
  broadcastTime: {
    fontSize: 11,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
  },
  broadcastContent: {
    fontSize: 14,
    color: C.text,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  broadcastMeta: {
    fontSize: 11,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
  },
});
