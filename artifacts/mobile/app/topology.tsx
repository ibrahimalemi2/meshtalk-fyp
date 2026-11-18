import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMesh } from "@/context/MeshContext";
import { TopologyMap } from "@/components/TopologyMap";
import { NodeAvatar } from "@/components/NodeAvatar";
import { SignalBar } from "@/components/SignalBar";

const C = Colors.dark;

export default function TopologyScreen() {
  const insets = useSafeAreaInsets();
  const { peers } = useMesh();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const online = peers.filter((p) => p.status !== "offline").length;
  const avgSignal = Math.round(peers.reduce((s, p) => s + p.signalStrength, 0) / peers.length);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Topology Map</Text>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        <View style={styles.mapCard}>
          <TopologyMap peers={peers} />
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: C.online }]} />
              <Text style={styles.legendText}>Online</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: C.relay }]} />
              <Text style={styles.legendText}>Relay</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: C.offline }]} />
              <Text style={styles.legendText}>Offline</Text>
            </View>
            <View style={styles.legendItem}>
              <Feather name="radio" size={10} color={C.accent} />
              <Text style={styles.legendText}>You</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{online}</Text>
            <Text style={styles.statLbl}>Active Nodes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{avgSignal}%</Text>
            <Text style={styles.statLbl}>Avg Signal</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{peers.filter((p) => p.isRelay).length}</Text>
            <Text style={styles.statLbl}>Relays</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{Math.max(...peers.map((p) => p.hops), 0)}</Text>
            <Text style={styles.statLbl}>Max Hops</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hop Paths</Text>
        </View>

        {peers.map((peer) => {
          const statusColor =
            peer.status === "online" ? C.online : peer.status === "relay" ? C.relay : C.offline;
          return (
            <View key={peer.id} style={styles.pathRow}>
              <NodeAvatar avatar={peer.avatar} status={peer.status} size={36} />
              <View style={styles.pathMiddle}>
                <View style={styles.pathLine}>
                  {Array.from({ length: peer.hops }).map((_, i) => (
                    <React.Fragment key={i}>
                      <View style={[styles.pathNode, { borderColor: C.accent + "40" }]} />
                      {i < peer.hops - 1 && (
                        <View style={[styles.pathConnector, { borderColor: C.accent + "25" }]} />
                      )}
                    </React.Fragment>
                  ))}
                  <View style={[styles.pathNodeEnd, { borderColor: statusColor + "80", backgroundColor: statusColor + "20" }]}>
                    <Text style={[styles.pathNodeText, { color: statusColor }]}>{peer.avatar}</Text>
                  </View>
                </View>
                <Text style={styles.pathHopText}>{peer.hops} hop{peer.hops !== 1 ? "s" : ""} · {peer.displayName}</Text>
              </View>
              <SignalBar strength={peer.signalStrength} size="md" />
            </View>
          );
        })}
      </ScrollView>
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
    color: C.text,
    flex: 1,
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.accentMuted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.accent + "30",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  liveText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: C.accent,
    letterSpacing: 1,
  },
  mapCard: {
    margin: 16,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    overflow: "hidden",
    padding: 12,
  },
  mapLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.surfaceBorder,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 11,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    minWidth: "40%",
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    padding: 14,
    alignItems: "center",
  },
  statVal: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: C.accent,
  },
  statLbl: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  pathRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.surfaceBorder,
  },
  pathMiddle: {
    flex: 1,
    gap: 4,
  },
  pathLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pathNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1.5,
  },
  pathConnector: {
    width: 14,
    height: 0,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  pathNodeEnd: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  pathNodeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  pathHopText: {
    fontSize: 11,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
  },
});
