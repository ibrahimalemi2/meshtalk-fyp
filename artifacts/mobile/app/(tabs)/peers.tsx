import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { Peer, useMesh, AVATAR_COLOR_OPTIONS } from "@/context/MeshContext";

const C = Colors.dark;

function RadarScan() {
  const rotation = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 3000, easing: Easing.linear }), -1);
    ring1.value = withRepeat(withTiming(1.8, { duration: 2000 }), -1, false);
    setTimeout(() => {
      ring2.value = withRepeat(withTiming(1.8, { duration: 2000 }), -1, false);
    }, 1000);
  }, []);

  const rotStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1.value }],
    opacity: 1 - (ring1.value - 1) / 0.8,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2.value }],
    opacity: 1 - (ring2.value - 1) / 0.8,
  }));

  return (
    <View style={styles.radar}>
      <Animated.View style={[styles.radarRing, ring1Style]} />
      <Animated.View style={[styles.radarRing, ring2Style]} />
      <View style={styles.radarCircle}>
        <Animated.View style={[styles.radarSweep, rotStyle]} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.radarGrid, { transform: [{ rotate: `${i * 60}deg` }] }]} />
        ))}
      </View>
      <View style={styles.radarCenter}>
        <Feather name="radio" size={20} color={C.accent} />
      </View>
    </View>
  );
}

function PeerCard({ peer, onPress, onChat }: { peer: Peer; onPress: () => void; onChat: () => void }) {
  const statusColor = peer.status === "online" ? C.online : peer.status === "relay" ? C.relay : C.offline;
  const statusLabel = peer.status === "online" ? "ONLINE" : peer.status === "relay" ? "RELAY" : "OFFLINE";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.peerCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.peerCardLeft}>
        <View style={[styles.peerAvatar, { backgroundColor: peer.avatarColor + "20", borderColor: peer.avatarColor + "50" }]}>
          <Text style={[styles.peerAvatarText, { color: peer.avatarColor }]}>{peer.avatar}</Text>
        </View>
        <View style={styles.peerInfo}>
          <View style={styles.peerNameRow}>
            <Text style={styles.peerName}>{peer.displayName}</Text>
            {peer.isRelay && (
              <View style={styles.relayBadge}>
                <Text style={styles.relayBadgeText}>RELAY</Text>
              </View>
            )}
          </View>
          <View style={styles.peerMeta}>
            <View style={[styles.statusPill, { backgroundColor: statusColor + "15", borderColor: statusColor + "30" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <Text style={styles.metaText}>{peer.hops} hop{peer.hops !== 1 ? "s" : ""}</Text>
            <Text style={styles.metaText}>{peer.signalStrength}%</Text>
            <Text style={[styles.metaText, peer.batteryLevel < 20 && { color: C.danger }]}>
              🔋{peer.batteryLevel}%
            </Text>
          </View>
          <View style={styles.signalBar}>
            <View style={[styles.signalFill, {
              width: `${peer.signalStrength}%` as any,
              backgroundColor: peer.signalStrength > 60 ? C.accent : peer.signalStrength > 30 ? C.warning : C.danger,
            }]} />
          </View>
        </View>
      </View>
      <Pressable
        onPress={onChat}
        style={({ pressed }) => [styles.chatBtn, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="chatbubble" size={16} color={C.accent} />
      </Pressable>
    </Pressable>
  );
}

export default function PeersScreen() {
  const insets = useSafeAreaInsets();
  const { peers: contextPeers, createGroup, isInitialized } = useMesh();
  const [filter, setFilter] = useState<"all" | "online" | "relay">("all");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupColor, setGroupColor] = useState(AVATAR_COLOR_OPTIONS[0]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 84;

  const filtered = contextPeers.filter((p) => {
    if (filter === "online") return p.status === "online";
    if (filter === "relay") return p.isRelay;
    return true;
  });

  const onlinePeers = contextPeers.filter((p) => p.status === "online").length;
  const relayPeers = contextPeers.filter((p) => p.isRelay).length;

  const toggleMember = (peerId: string) => {
    Haptics.selectionAsync();
    setSelectedMembers((prev) =>
      prev.includes(peerId) ? prev.filter((id) => id !== peerId) : [...prev, peerId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Group Name", "Please enter a group name.");
      return;
    }
    if (selectedMembers.length === 0) {
      Alert.alert("Members", "Please select at least one member.");
      return;
    }
    const group = await createGroup(groupName.trim(), selectedMembers, groupColor);
    setShowCreateGroup(false);
    setGroupName("");
    setSelectedMembers([]);
    router.push(`/group/${group.id}` as any);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <Modal visible={showCreateGroup} transparent animationType="slide" onRequestClose={() => setShowCreateGroup(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreateGroup(false)}>
          <Pressable style={styles.createGroupSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New Group</Text>

            <View style={styles.sheetInput}>
              <TextInput
                style={styles.sheetTextInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Group name..."
                placeholderTextColor={C.textMuted}
                maxLength={32}
                autoFocus
              />
            </View>

            <Text style={styles.sheetLabel}>Node Color</Text>
            <View style={styles.colorRow}>
              {AVATAR_COLOR_OPTIONS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => { Haptics.selectionAsync(); setGroupColor(color); }}
                  style={[styles.colorSwatch, { backgroundColor: color + "20", borderColor: color + "60" }]}
                >
                  <View style={[styles.colorSwatchInner, { backgroundColor: color }]} />
                  {groupColor === color && <View style={styles.colorCheck}><Feather name="check" size={10} color="#000" /></View>}
                </Pressable>
              ))}
            </View>

            <Text style={styles.sheetLabel}>Add Members ({selectedMembers.length} selected)</Text>
            <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
              {contextPeers.map((peer) => {
                const isSelected = selectedMembers.includes(peer.id);
                return (
                  <Pressable
                    key={peer.id}
                    onPress={() => toggleMember(peer.id)}
                    style={[styles.memberRow, isSelected && { backgroundColor: peer.avatarColor + "10" }]}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: peer.avatarColor + "20", borderColor: peer.avatarColor + "50" }]}>
                      <Text style={[styles.memberAvatarText, { color: peer.avatarColor }]}>{peer.avatar}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{peer.displayName}</Text>
                      <Text style={styles.memberSub}>{peer.hops} hops · {peer.status}</Text>
                    </View>
                    <View style={[styles.memberCheck, isSelected && { backgroundColor: C.accent, borderColor: C.accent }]}>
                      {isSelected && <Feather name="check" size={12} color="#000" />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={handleCreateGroup}
              style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="people" size={18} color={C.background} />
              <Text style={styles.createBtnText}>Create Group</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Nodes</Text>
          <Text style={styles.headerSub}>
            {onlinePeers} online · {relayPeers} relay · {contextPeers.length} total
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setShowCreateGroup(true)}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="people-outline" size={22} color={C.accent} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/topology" as any)}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="share-2" size={20} color={C.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.radarSection}>
        <RadarScan />
        <View style={styles.radarStats}>
          {[
            { label: "NODES", value: contextPeers.length },
            { label: "ONLINE", value: onlinePeers, color: C.online },
            { label: "RELAY", value: relayPeers, color: C.relay },
            { label: "MAX HOPS", value: contextPeers.length > 0 ? Math.max(...contextPeers.map((p) => p.hops)) : 0 },
          ].map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={[styles.statValue, s.color ? { color: s.color } : {}]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.filterRow}>
        {(["all", "online", "relay"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => { Haptics.selectionAsync(); setFilter(f); }}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PeerCard
            peer={item}
            onPress={() => Alert.alert(
              item.displayName,
              `Status: ${item.status}\nHops: ${item.hops}\nSignal: ${item.signalStrength}%\nBattery: ${item.batteryLevel}%\nRelay: ${item.isRelay ? "Yes" : "No"}\nKey: ${item.publicKey.slice(0, 30)}...`
            )}
            onChat={() => { Haptics.selectionAsync(); router.push(`/chat/${item.id}` as any); }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
  },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: C.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  radarSection: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: C.surfaceElevated, borderRadius: 20,
    borderWidth: 1, borderColor: C.surfaceBorder,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 20,
  },
  radar: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  radarCircle: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 1, borderColor: C.accent + "30",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  radarSweep: {
    position: "absolute", left: "50%", top: "50%",
    width: 45, height: 45,
    backgroundColor: "transparent",
    borderTopWidth: 0, borderRightWidth: 0,
    borderBottomWidth: 0, borderLeftWidth: 0,
    shadowColor: C.accent, shadowOpacity: 0.6,
    shadowRadius: 12, elevation: 0,
    transformOrigin: "0% 0%",
    borderStyle: "solid",
  },
  radarGrid: {
    position: "absolute", width: "100%", height: 1,
    backgroundColor: C.accent + "15",
  },
  radarRing: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    borderWidth: 1, borderColor: C.accent,
  },
  radarCenter: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.accentMuted,
    borderWidth: 1, borderColor: C.accent + "50",
    alignItems: "center", justifyContent: "center",
  },
  radarStats: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statItem: { width: "46%", alignItems: "center", paddingVertical: 6 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.text },
  statLabel: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  filterRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  filterBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 9 },
  filterActive: { backgroundColor: C.surface },
  filterText: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_500Medium" },
  filterTextActive: { color: C.text, fontFamily: "Inter_600SemiBold" },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 8 },
  peerCard: {
    backgroundColor: C.surfaceElevated, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: C.surfaceBorder,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  peerCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  peerAvatar: {
    width: 48, height: 48, borderRadius: 14, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  peerAvatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  peerInfo: { flex: 1, gap: 5 },
  peerNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  peerName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  relayBadge: {
    backgroundColor: C.relay + "15", borderWidth: 1, borderColor: C.relay + "30",
    borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1,
  },
  relayBadgeText: { fontSize: 9, color: C.relay, fontFamily: "Inter_700Bold" },
  peerMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  metaText: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  signalBar: {
    height: 3, backgroundColor: C.surfaceBorder, borderRadius: 2, overflow: "hidden",
  },
  signalFill: { height: 3, borderRadius: 2 },
  chatBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.accentMuted, borderWidth: 1, borderColor: C.accent + "30",
    alignItems: "center", justifyContent: "center",
  },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  createGroupSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "80%",
    borderTopWidth: 1, borderTopColor: C.surfaceBorder,
    gap: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.surfaceBorder,
    alignSelf: "center", marginBottom: 8,
  },
  sheetTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text },
  sheetLabel: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  sheetInput: {
    backgroundColor: C.surfaceElevated, borderRadius: 14,
    borderWidth: 1, borderColor: C.surfaceBorder,
    paddingHorizontal: 16,
  },
  sheetTextInput: {
    fontSize: 16, color: C.text, fontFamily: "Inter_500Medium",
    paddingVertical: 14,
  },
  colorRow: { flexDirection: "row", gap: 8 },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  colorSwatchInner: { width: 18, height: 18, borderRadius: 5 },
  colorCheck: {
    position: "absolute", top: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  memberList: { maxHeight: 200 },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, marginBottom: 4,
  },
  memberAvatar: {
    width: 38, height: 38, borderRadius: 11, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  memberAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  memberInfo: { flex: 1, gap: 2 },
  memberName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  memberSub: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  memberCheck: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    borderColor: C.surfaceBorder, alignItems: "center", justifyContent: "center",
  },
  createBtn: {
    backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  createBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.background },
});
