import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { Message } from "@/context/MeshContext";

const C = Colors.dark;
const REACTIONS = ["👍", "❤️", "😂", "😮", "🔥", "💯"];

interface Props {
  message: Message;
  isOwn: boolean;
  senderName: string;
  senderColor: string;
  onReaction: (emoji: string) => void;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function GroupMessageBubble({ message, isOwn, senderName, senderColor, onReaction }: Props) {
  const [showReactions, setShowReactions] = useState(false);

  const grouped = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <Modal visible={showReactions} transparent animationType="fade" onRequestClose={() => setShowReactions(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowReactions(false)}>
          <View style={styles.reactionPicker}>
            {REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => { onReaction(emoji); setShowReactions(false); }}
                style={styles.reactionOption}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
        {!isOwn && (
          <View style={[styles.senderDot, { backgroundColor: senderColor }]} />
        )}
        <Pressable
          onLongPress={() => setShowReactions(true)}
          style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}
        >
          {!isOwn && (
            <Text style={[styles.senderName, { color: senderColor }]}>{senderName}</Text>
          )}
          {message.type === "image" && message.imageUri ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: message.imageUri }} style={styles.messageImage} resizeMode="cover" />
            </View>
          ) : message.type === "voice" ? (
            <View style={styles.voiceRow}>
              <Ionicons name="mic" size={14} color={isOwn ? C.accentDim : C.textSecondary} />
              <View style={styles.voiceWave}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <View key={i} style={[styles.voiceBar, { height: 4 + Math.sin(i) * 6, backgroundColor: isOwn ? C.accentDim : C.textSecondary }]} />
                ))}
              </View>
              <Text style={[styles.voiceDuration, isOwn ? styles.textOwn : styles.textOther]}>
                0:{message.content.padStart(2, "0")}
              </Text>
            </View>
          ) : (
            <Text style={[styles.content, isOwn ? styles.textOwn : styles.textOther]}>
              {message.content}
            </Text>
          )}
          <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
            {formatTime(message.timestamp)}
          </Text>
          {Object.keys(grouped).length > 0 && (
            <View style={styles.reactionsRow}>
              {Object.entries(grouped).map(([emoji, count]) => (
                <Pressable key={emoji} onPress={() => onReaction(emoji)} style={styles.reactionBubble}>
                  <Text style={styles.reactionBubbleEmoji}>{emoji}</Text>
                  {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, marginVertical: 2, flexDirection: "row", alignItems: "flex-end", gap: 6 },
  rowOwn: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  senderDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 8 },
  bubble: {
    maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  bubbleOwn: {
    backgroundColor: C.messageBubbleOwn,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: C.accentDim + "40",
  },
  bubbleOther: {
    backgroundColor: C.messageBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  senderName: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  content: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  textOwn: { color: C.messageTextOwn },
  textOther: { color: C.text },
  time: { fontSize: 10, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  timeOwn: { color: C.accentDim + "80" },
  timeOther: { color: C.textMuted },
  imageContainer: { borderRadius: 12, overflow: "hidden" },
  messageImage: { width: 200, height: 150 },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  voiceWave: { flexDirection: "row", alignItems: "center", gap: 2, flex: 1 },
  voiceBar: { width: 3, borderRadius: 2, opacity: 0.7 },
  voiceDuration: { fontSize: 12, fontFamily: "Inter_500Medium" },
  reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  reactionBubble: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: C.surfaceElevated, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  reactionBubbleEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_600SemiBold" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  reactionPicker: {
    flexDirection: "row", gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 24, padding: 12,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  reactionOption: { padding: 6 },
  reactionEmoji: { fontSize: 28 },
});
