import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { Peer } from "@/context/MeshContext";
import { NodeAvatar } from "@/components/NodeAvatar";
import { SignalBar } from "@/components/SignalBar";

const C = Colors.dark;

interface Props {
  peer: Peer;
  unreadCount?: number;
  lastMessage?: string;
  lastTime?: number;
}

function formatLastTime(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

export function PeerCard({ peer, unreadCount = 0, lastMessage, lastTime }: Props) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/chat/[peerId]", params: { peerId: peer.id } });
  };

  const batteryColor =
    peer.batteryLevel > 40 ? C.accent : peer.batteryLevel > 15 ? C.warning : C.danger;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <NodeAvatar avatar={peer.avatar} status={peer.status} size={50} showPulse />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {peer.displayName}
          </Text>
          <View style={styles.topRight}>
            {lastTime && (
              <Text style={styles.time}>{formatLastTime(lastTime)}</Text>
            )}
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.bottomRow}>
          {lastMessage ? (
            <Text style={styles.preview} numberOfLines={1}>
              {lastMessage}
            </Text>
          ) : (
            <Text style={styles.previewMuted}>Tap to send a message</Text>
          )}
          <View style={styles.statusRow}>
            <SignalBar strength={peer.signalStrength} />
            <Text style={styles.hops}>{peer.hops}hop{peer.hops > 1 ? "s" : ""}</Text>
            {peer.isRelay && (
              <View style={styles.relayBadge}>
                <Feather name="radio" size={9} color={C.relay} />
                <Text style={styles.relayText}>relay</Text>
              </View>
            )}
            <Ionicons name="battery-half" size={12} color={batteryColor} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.surfaceBorder,
  },
  pressed: {
    backgroundColor: C.accentMuted,
  },
  body: {
    flex: 1,
    gap: 5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    flex: 1,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  time: {
    fontSize: 11,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  badge: {
    backgroundColor: C.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: C.background,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preview: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    flex: 1,
    marginRight: 8,
  },
  previewMuted: {
    fontSize: 13,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    flex: 1,
    marginRight: 8,
    fontStyle: "italic",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  hops: {
    fontSize: 10,
    color: C.textMuted,
    fontFamily: "Inter_500Medium",
  },
  relayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: C.relay + "20",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  relayText: {
    fontSize: 9,
    color: C.relay,
    fontFamily: "Inter_600SemiBold",
  },
});
