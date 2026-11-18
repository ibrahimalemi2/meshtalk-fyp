import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMesh } from "@/context/MeshContext";

const C = Colors.dark;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} · ${d.getMonth() + 1}/${d.getDate()}`;
}

interface SearchResult {
  type: "message" | "peer" | "group";
  id: string;
  title: string;
  subtitle: string;
  avatarText: string;
  avatarColor: string;
  timestamp?: number;
  routeTo: string;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { peers, conversations, groups } = useMesh();
  const [query, setQuery] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 84;

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const out: SearchResult[] = [];

    peers.forEach((peer) => {
      if (peer.displayName.toLowerCase().includes(q) || peer.id.toLowerCase().includes(q)) {
        out.push({
          type: "peer",
          id: peer.id,
          title: peer.displayName,
          subtitle: `${peer.hops} hops · ${peer.signalStrength}% · ${peer.status}`,
          avatarText: peer.avatar,
          avatarColor: peer.avatarColor,
          routeTo: `/chat/${peer.id}`,
        });
      }
    });

    groups.forEach((g) => {
      if (g.name.toLowerCase().includes(q)) {
        out.push({
          type: "group",
          id: g.id,
          title: g.name,
          subtitle: `${g.memberIds.length + 1} members`,
          avatarText: g.avatar,
          avatarColor: g.avatarColor,
          routeTo: `/group/${g.id}`,
        });
        g.messages.forEach((m) => {
          if (m.content.toLowerCase().includes(q)) {
            out.push({
              type: "message",
              id: m.id,
              title: g.name,
              subtitle: m.content,
              avatarText: g.avatar,
              avatarColor: g.avatarColor,
              timestamp: m.timestamp,
              routeTo: `/group/${g.id}`,
            });
          }
        });
      }
    });

    conversations.forEach((conv) => {
      const peer = peers.find((p) => p.id === conv.peerId);
      if (!peer) return;
      conv.messages.forEach((m) => {
        if (m.content.toLowerCase().includes(q) || peer.displayName.toLowerCase().includes(q)) {
          out.push({
            type: "message",
            id: m.id,
            title: peer.displayName,
            subtitle: m.content,
            avatarText: peer.avatar,
            avatarColor: peer.avatarColor,
            timestamp: m.timestamp,
            routeTo: `/chat/${peer.id}`,
          });
        }
      });
    });

    return out.slice(0, 50);
  }, [query, peers, conversations, groups]);

  const typeLabel: Record<string, string> = { message: "MSG", peer: "NODE", group: "GROUP" };
  const typeColor: Record<string, string> = { message: C.accent, peer: C.relay, group: "#FFA502" };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={18} color={C.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search peers, groups, messages..."
          placeholderTextColor={C.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && Platform.OS !== "ios" && (
          <Pressable onPress={() => setQuery("")}>
            <Feather name="x" size={18} color={C.textSecondary} />
          </Pressable>
        )}
      </View>

      {query.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="search" size={52} color={C.textMuted} />
          <Text style={styles.emptyTitle}>Find anything</Text>
          <Text style={styles.emptySubtitle}>Search across peers, groups, and messages in the mesh</Text>
          <View style={styles.recentSection}>
            <Text style={styles.recentLabel}>All Nodes</Text>
            {peers.slice(0, 4).map((peer) => (
              <Pressable
                key={peer.id}
                onPress={() => { Haptics.selectionAsync(); router.push(`/chat/${peer.id}` as any); }}
                style={({ pressed }) => [styles.recentRow, pressed && { backgroundColor: C.surfaceElevated }]}
              >
                <View style={[styles.recentAvatar, { backgroundColor: peer.avatarColor + "20", borderColor: peer.avatarColor + "50" }]}>
                  <Text style={[styles.recentAvatarText, { color: peer.avatarColor }]}>{peer.avatar}</Text>
                </View>
                <View style={styles.recentBody}>
                  <Text style={styles.recentName}>{peer.displayName}</Text>
                  <Text style={styles.recentSub}>{peer.hops} hops · {peer.signalStrength}% signal</Text>
                </View>
                <View style={[styles.statusDot, {
                  backgroundColor: peer.status === "online" ? C.online : peer.status === "relay" ? C.relay : C.offline,
                }]} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => `${r.type}-${r.id}`}
          contentContainerStyle={styles.resultsList}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { Haptics.selectionAsync(); router.push(item.routeTo as any); }}
              style={({ pressed }) => [styles.resultRow, pressed && { backgroundColor: C.surfaceElevated }]}
            >
              <View style={[styles.resultAvatar, { backgroundColor: item.avatarColor + "20", borderColor: item.avatarColor + "50" }]}>
                <Text style={[styles.resultAvatarText, { color: item.avatarColor }]}>{item.avatarText}</Text>
              </View>
              <View style={styles.resultBody}>
                <View style={styles.resultTop}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: typeColor[item.type] + "20", borderColor: typeColor[item.type] + "40" }]}>
                    <Text style={[styles.typeText, { color: typeColor[item.type] }]}>{typeLabel[item.type]}</Text>
                  </View>
                </View>
                <Text style={styles.resultSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                {item.timestamp && (
                  <Text style={styles.resultTime}>{formatTime(item.timestamp)}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="search" size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptySubtitle}>Nothing matched "{query}"</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: C.text, letterSpacing: -0.5 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: C.surfaceElevated, borderRadius: 16,
    borderWidth: 1, borderColor: C.surfaceBorder,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: {
    flex: 1, fontSize: 15, color: C.text,
    fontFamily: "Inter_400Regular", padding: 0,
  },
  resultsList: { paddingBottom: 20 },
  resultRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.surfaceBorder,
  },
  resultAvatar: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  resultAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  resultBody: { flex: 1, gap: 3 },
  resultTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.text, flex: 1 },
  typeBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1,
  },
  typeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  resultSubtitle: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  resultTime: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  empty: { flex: 1, alignItems: "center", paddingTop: 48, gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: C.textSecondary, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center" },
  recentSection: { width: "100%", marginTop: 24, gap: 4 },
  recentLabel: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_600SemiBold", marginBottom: 8, letterSpacing: 0.5 },
  recentRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12,
  },
  recentAvatar: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  recentAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  recentBody: { flex: 1, gap: 2 },
  recentName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  recentSub: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
