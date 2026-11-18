import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useRootNavigationState } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
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
import Colors from "@/constants/colors";
import { useMesh, Group, Conversation } from "@/context/MeshContext";
import { TopologyMap } from "@/components/TopologyMap";

const C = Colors.dark;

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function OnlinePulse({ color }: { color: string }) {
  const scale = useSharedValue(1);
  useEffect(() => { scale.value = withRepeat(withTiming(1.35, { duration: 1200 }), -1, true); }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: 1.5 - scale.value }));
  return (
    <View style={styles.pulseWrapper}>
      <Animated.View style={[styles.pulseRing, { borderColor: color }, style]} />
      <View style={[styles.pulseCore, { backgroundColor: color }]} />
    </View>
  );
}

function ConvRow({ conv, onPress }: { conv: Conversation; onPress: () => void }) {
  const { peers } = useMesh();
  const peer = peers.find((p) => p.id === conv.peerId);
  if (!peer) return null;
  const statusColor = peer.status === "online" ? C.online : peer.status === "relay" ? C.relay : C.offline;
  const isTyping = conv.typingUntil ? conv.typingUntil > Date.now() : false;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.convRow, pressed && { backgroundColor: C.surfaceElevated }]}
    >
      <View style={styles.convAvatarWrap}>
        <View style={[styles.convAvatar, { backgroundColor: peer.avatarColor + "20", borderColor: peer.avatarColor + "50" }]}>
          <Text style={[styles.convAvatarText, { color: peer.avatarColor }]}>{peer.avatar}</Text>
        </View>
        {peer.status === "online" && <OnlinePulse color={statusColor} />}
        {peer.status !== "online" && (
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]} />
        )}
      </View>
      <View style={styles.convBody}>
        <View style={styles.convTop}>
          <Text style={styles.convName}>{peer.displayName}</Text>
          <Text style={styles.convTime}>
            {conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : ""}
          </Text>
        </View>
        <View style={styles.convBottom}>
          {isTyping ? (
            <Text style={[styles.convPreview, { color: C.accent }]}>typing…</Text>
          ) : (
            <Text style={styles.convPreview} numberOfLines={1}>
              {conv.lastMessage?.type === "image" ? "📷 Photo"
                : conv.lastMessage?.type === "voice" ? "🎙 Voice message"
                : conv.lastMessage?.content ?? "Tap to start chatting"}
            </Text>
          )}
          {conv.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{conv.unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.convTags}>
          <Text style={styles.convTag}>{peer.hops}h</Text>
          <Text style={styles.convTag}>{peer.signalStrength}%</Text>
          {peer.isRelay && <Text style={[styles.convTag, styles.relayTag]}>RELAY</Text>}
        </View>
      </View>
    </Pressable>
  );
}

function GroupRow({ group, onPress }: { group: Group; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.convRow, pressed && { backgroundColor: C.surfaceElevated }]}
    >
      <View style={styles.convAvatarWrap}>
        <View style={[styles.convAvatar, { backgroundColor: group.avatarColor + "20", borderColor: group.avatarColor + "50", borderRadius: 14 }]}>
          <Text style={[styles.convAvatarText, { color: group.avatarColor }]}>{group.avatar}</Text>
        </View>
      </View>
      <View style={styles.convBody}>
        <View style={styles.convTop}>
          <View style={styles.groupNameRow}>
            <Ionicons name="people" size={12} color={C.textSecondary} />
            <Text style={styles.convName}>{group.name}</Text>
          </View>
          <Text style={styles.convTime}>
            {group.lastMessage ? formatTime(group.lastMessage.timestamp) : ""}
          </Text>
        </View>
        <View style={styles.convBottom}>
          <Text style={styles.convPreview} numberOfLines={1}>
            {group.lastMessage?.content ?? `${group.memberIds.length + 1} members`}
          </Text>
          {group.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{group.unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.convTags}>
          <Text style={styles.convTag}>{group.memberIds.length + 1} nodes</Text>
          <Text style={[styles.convTag, { color: C.accent + "80", borderColor: C.accent + "30" }]}>GROUP</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { peers, conversations, groups, broadcasts, myNode, isInitialized } = useMesh();
  const [tab, setTab] = useState<"direct" | "groups" | "broadcasts">("direct");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 84;

  useEffect(() => {
    if (myNode && !myNode.hasOnboarded) {
      router.replace("/onboarding");
    }
  }, [myNode]);

  const sortedConvs = useMemo(
    () => [...conversations].sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0)),
    [conversations]
  );

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0)),
    [groups]
  );

  const onlinePeers = peers.filter((p) => p.status === "online").length;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MeshTalk</Text>
          <Text style={styles.headerSub}>
            <Text style={[styles.dot, { color: C.accent }]}>● </Text>
            {onlinePeers} node{onlinePeers !== 1 ? "s" : ""} online
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/broadcast" as any)}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="megaphone-outline" size={22} color={C.danger} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/topology" as any)}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="share-2" size={20} color={C.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.mapSection}>
        <TopologyMap peers={peers} myNode={myNode} />
      </View>

      <View style={styles.segmentRow}>
        {(["direct", "groups", "broadcasts"] as const).map((t) => {
          const labels: Record<string, string> = { direct: "Direct", groups: "Groups", broadcasts: "Broadcast" };
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentBtn, tab === t && styles.segmentActive]}>
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>{labels[t]}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "direct" && (
        <FlatList
          data={sortedConvs}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ConvRow conv={item} onPress={() => router.push(`/chat/${item.peerId}` as any)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={52} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>Tap a node below to start chatting</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.peerChips}
              >
                {peers.filter((p) => p.status !== "offline").slice(0, 4).map((peer) => (
                  <Pressable
                    key={peer.id}
                    onPress={() => router.push(`/chat/${peer.id}` as any)}
                    style={[styles.peerChip, { borderColor: peer.avatarColor + "50", backgroundColor: peer.avatarColor + "10" }]}
                  >
                    <Text style={[styles.peerChipAvatar, { color: peer.avatarColor }]}>{peer.avatar}</Text>
                    <Text style={styles.peerChipName}>{peer.displayName}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          }
        />
      )}

      {tab === "groups" && (
        <FlatList
          data={sortedGroups}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => (
            <GroupRow group={item} onPress={() => router.push(`/group/${item.id}` as any)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={52} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No groups yet</Text>
              <Text style={styles.emptySubtitle}>Go to Nodes tab to create a group</Text>
            </View>
          }
        />
      )}

      {tab === "broadcasts" && (
        <FlatList
          data={broadcasts}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => (
            <View style={styles.broadcastRow}>
              <View style={styles.broadcastIcon}>
                <Ionicons name="megaphone" size={16} color={C.danger} />
              </View>
              <View style={styles.broadcastBody}>
                <Text style={styles.broadcastContent}>{item.content}</Text>
                <Text style={styles.broadcastMeta}>
                  {formatTime(item.timestamp)} · {item.hops} hops · TTL {item.ttl}h
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={52} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No broadcasts</Text>
              <Text style={styles.emptySubtitle}>Emergency alerts will appear here</Text>
              <Pressable
                onPress={() => router.push("/broadcast" as any)}
                style={({ pressed }) => [styles.broadcastCta, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="megaphone" size={16} color={C.danger} />
                <Text style={styles.broadcastCtaText}>Send Broadcast</Text>
              </Pressable>
            </View>
          }
        />
      )}
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
  dot: { fontSize: 10 },
  headerActions: { flexDirection: "row", gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  mapSection: { marginHorizontal: 16, marginBottom: 12 },
  segmentRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 9 },
  segmentActive: { backgroundColor: C.surface },
  segmentText: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_500Medium" },
  segmentTextActive: { color: C.text, fontFamily: "Inter_600SemiBold" },
  convRow: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12,
    gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.surfaceBorder,
  },
  convAvatarWrap: { width: 48, height: 48, position: "relative" },
  convAvatar: {
    width: 48, height: 48, borderRadius: 16, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  convAvatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statusBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: C.background,
  },
  pulseWrapper: {
    position: "absolute", bottom: 0, right: 0,
    width: 14, height: 14, alignItems: "center", justifyContent: "center",
  },
  pulseRing: {
    position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 1.5,
  },
  pulseCore: { width: 8, height: 8, borderRadius: 4 },
  convBody: { flex: 1, gap: 3 },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  groupNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  convName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text },
  convTime: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  convBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  convPreview: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", flex: 1 },
  unreadBadge: {
    backgroundColor: C.accent, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, color: C.background, fontFamily: "Inter_700Bold" },
  convTags: { flexDirection: "row", gap: 6, marginTop: 2 },
  convTag: {
    fontSize: 10, color: C.textMuted + "CC", fontFamily: "Inter_500Medium",
    borderWidth: 1, borderColor: C.surfaceBorder, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  relayTag: { color: C.relay + "CC", borderColor: C.relay + "30" },
  empty: {
    alignItems: "center", paddingTop: 48, gap: 8, paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
  peerChips: { paddingHorizontal: 4, gap: 8, marginTop: 12 },
  peerChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10,
  },
  peerChipAvatar: { fontSize: 18, fontFamily: "Inter_700Bold" },
  peerChipName: { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  broadcastRow: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 14,
    gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.surfaceBorder,
    alignItems: "flex-start",
  },
  broadcastIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.danger + "15", borderWidth: 1, borderColor: C.danger + "30",
    alignItems: "center", justifyContent: "center",
  },
  broadcastBody: { flex: 1, gap: 4 },
  broadcastContent: { fontSize: 14, color: C.text, fontFamily: "Inter_500Medium", lineHeight: 20 },
  broadcastMeta: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  broadcastCta: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: C.danger + "50",
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12,
    backgroundColor: C.danger + "08",
  },
  broadcastCtaText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.danger },
});
