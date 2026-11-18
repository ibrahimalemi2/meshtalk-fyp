import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { Message, useMesh } from "@/context/MeshContext";
import { VoiceRecorder } from "@/components/VoiceRecorder";

const C = Colors.dark;
const REACTIONS = ["👍", "❤️", "😂", "😮", "🔥", "💯"];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatExpiry(expiresAt: number): string {
  const hrs = Math.max(0, Math.floor((expiresAt - Date.now()) / 3600000));
  if (hrs < 1) return "<1h";
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function TypingIndicator() {
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const d3 = useSharedValue(0);
  useEffect(() => {
    d1.value = withRepeat(withTiming(-5, { duration: 400 }), -1, true);
    setTimeout(() => { d2.value = withRepeat(withTiming(-5, { duration: 400 }), -1, true); }, 140);
    setTimeout(() => { d3.value = withRepeat(withTiming(-5, { duration: 400 }), -1, true); }, 280);
  }, []);
  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: d1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: d2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: d3.value }] }));
  return (
    <View style={styles.typingOuter}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, s1]} />
        <Animated.View style={[styles.typingDot, s2]} />
        <Animated.View style={[styles.typingDot, s3]} />
      </View>
    </View>
  );
}

function BubbleItem({
  message, isOwn, onDelete, onReaction, onReply, replyMsg,
}: {
  message: Message;
  isOwn: boolean;
  onDelete: () => void;
  onReaction: (emoji: string) => void;
  onReply: (msg: Message) => void;
  replyMsg?: Message | null;
}) {
  const [showOptions, setShowOptions] = useState(false);

  const grouped = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
          <View style={styles.optionsMenu}>
            <View style={styles.emojiRow}>
              {REACTIONS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => { onReaction(e); setShowOptions(false); }}
                  style={styles.emojiBtn}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.optsDivider} />
            <Pressable style={styles.optsRow} onPress={() => { onReply(message); setShowOptions(false); }}>
              <Feather name="corner-up-left" size={16} color={C.text} />
              <Text style={styles.optsText}>Reply</Text>
            </Pressable>
            {isOwn && (
              <Pressable style={styles.optsRow} onPress={() => { setShowOptions(false); setTimeout(onDelete, 200); }}>
                <Feather name="trash-2" size={16} color={C.danger} />
                <Text style={[styles.optsText, { color: C.danger }]}>Delete</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      <View style={[styles.msgRow, isOwn ? styles.rowOwn : styles.rowOther]}>
        <Pressable
          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowOptions(true); }}
          style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}
        >
          {replyMsg && (
            <View style={[styles.replyPreview, { borderLeftColor: isOwn ? C.accentDim : C.relay }]}>
              <Text style={styles.replyPreviewText} numberOfLines={1}>{replyMsg.content}</Text>
            </View>
          )}

          {message.type === "image" && message.imageUri ? (
            <View style={styles.imgWrapper}>
              <Image source={{ uri: message.imageUri }} style={styles.msgImage} resizeMode="cover" />
            </View>
          ) : message.type === "voice" ? (
            <View style={styles.voiceRow}>
              <Ionicons name="mic" size={14} color={isOwn ? C.accentDim : C.textSecondary} />
              <View style={styles.voiceWave}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.voiceBar, {
                      height: 4 + Math.abs(Math.sin(i * 0.7 + 1)) * 10,
                      backgroundColor: isOwn ? C.accentDim : C.textSecondary,
                    }]}
                  />
                ))}
              </View>
              <Text style={[styles.voiceDur, isOwn ? styles.textOwn : styles.textOther]}>
                0:{Number(message.content).toString().padStart(2, "0")}s
              </Text>
            </View>
          ) : (
            <Text style={[styles.msgText, isOwn ? styles.textOwn : styles.textOther]}>
              {message.content}
            </Text>
          )}

          <View style={styles.msgMeta}>
            <Text style={[styles.timeText, isOwn ? styles.timeOwn : styles.timeOther]}>
              {formatTime(message.timestamp)}
            </Text>
            <Text style={[styles.expiryText]}>⏱{formatExpiry(message.expiresAt)}</Text>
            {message.encrypted && (
              <Ionicons name="lock-closed" size={9} color={isOwn ? C.accentDim + "90" : C.textMuted} />
            )}
            {isOwn && (
              <Ionicons
                name={message.status === "delivered" ? "checkmark-done" : message.status === "sent" ? "checkmark" : "time-outline"}
                size={12}
                color={message.status === "delivered" ? C.accentDim : C.textMuted}
              />
            )}
          </View>

          {Object.keys(grouped).length > 0 && (
            <View style={styles.reactRow}>
              {Object.entries(grouped).map(([emoji, count]) => (
                <Pressable key={emoji} onPress={() => onReaction(emoji)} style={styles.reactChip}>
                  <Text style={styles.reactEmoji}>{emoji}</Text>
                  {count > 1 && <Text style={styles.reactCount}>{count}</Text>}
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </View>
    </>
  );
}

export default function ChatScreen() {
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const insets = useSafeAreaInsets();
  const { peers, myNode, getConversation, sendMessage, markRead, deleteMessage, addReaction } = useMesh();

  const peer = peers.find((p) => p.id === peerId);
  const conv = getConversation(peerId ?? "");
  const messages = conv?.messages ?? [];
  const isTyping = conv?.typingUntil ? conv.typingUntil > Date.now() : false;

  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const botInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (peerId) markRead(peerId);
  }, [peerId, messages.length]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !peerId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText("");
    const replyId = replyTo?.id;
    setReplyTo(null);
    await sendMessage(peerId, "text", text, undefined, replyId);
  }, [inputText, peerId, sendMessage, replyTo]);

  const handleImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.75 });
    if (!result.canceled && result.assets[0] && peerId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendMessage(peerId, "image", "📷 Photo", result.assets[0].uri);
    }
  }, [peerId, sendMessage]);

  const startRecording = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowVoiceRecorder(true);
  }, []);

  const stopRecording = useCallback(async () => {
    // Handled by VoiceRecorder component
  }, []);

  const handleVoiceRecordingComplete = useCallback(
    async (audioData: Uint8Array, duration: number) => {
      if (!peerId) return;
      setShowVoiceRecorder(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Send through ProtocolEngine
      const durationSecs = Math.floor(duration / 1000);
      await sendMessage(peerId, "voice", String(Math.min(durationSecs, 60)));
    },
    [peerId, sendMessage]
  );

  const handleVoiceRecorderCancel = useCallback(() => {
    setShowVoiceRecorder(false);
  }, []);

  const handleReaction = useCallback((emoji: string, msgId: string) => {
    if (!peerId) return;
    Haptics.selectionAsync();
    addReaction(peerId, msgId, emoji);
  }, [peerId, addReaction]);

  const handleDelete = useCallback((msgId: string) => {
    Alert.alert("Delete Message", "Remove this message?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMessage(peerId!, msgId) },
    ]);
  }, [peerId, deleteMessage]);

  if (!peer) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtnAlt}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Peer not found</Text>
        </View>
      </View>
    );
  }

  const statusColor = peer.status === "online" ? C.online : peer.status === "relay" ? C.relay : C.offline;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={[styles.peerAvatar, { backgroundColor: peer.avatarColor + "20", borderColor: peer.avatarColor + "60" }]}>
          <Text style={[styles.peerAvatarTxt, { color: peer.avatarColor }]}>{peer.avatar}</Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{peer.displayName}</Text>
          <Text style={[styles.headerMeta, { color: statusColor }]}>
            {peer.status === "online" ? "Online" : peer.status === "relay" ? "Relaying" : "Offline"} · {peer.hops}h · {peer.signalStrength}%
          </Text>
        </View>
        <Pressable onPress={() => router.push("/topology" as any)} style={styles.headerBtn}>
          <Ionicons name="radio-outline" size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.encBanner}>
        <Ionicons name="lock-closed" size={10} color={C.accentDim} />
        <Text style={styles.encText}>E2E Encrypted · {peer.hops} hop relay · Double Ratchet</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={styles.listPad}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
          renderItem={({ item }) => {
            const isOwn = item.senderId === myNode?.id;
            const reply = item.replyTo ? messages.find((m) => m.id === item.replyTo) : null;
            return (
              <BubbleItem
                message={item}
                isOwn={isOwn}
                onDelete={() => handleDelete(item.id)}
                onReaction={(emoji) => handleReaction(emoji, item.id)}
                onReply={(msg) => setReplyTo(msg)}
                replyMsg={reply}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyAvatar, { backgroundColor: peer.avatarColor + "20", borderColor: peer.avatarColor + "40" }]}>
                <Text style={[styles.emptyAvatarTxt, { color: peer.avatarColor }]}>{peer.avatar}</Text>
              </View>
              <Text style={styles.emptyName}>{peer.displayName}</Text>
              <Text style={styles.emptySub}>
                {peer.hops} hop{peer.hops !== 1 ? "s" : ""} · {peer.signalStrength}% signal{"\n"}All messages end-to-end encrypted.
              </Text>
            </View>
          }
        />

        {replyTo && (
          <View style={styles.replyBar}>
            <Feather name="corner-up-left" size={14} color={C.accent} />
            <Text style={styles.replyBarTxt} numberOfLines={1}>↩ {replyTo.content}</Text>
            <Pressable onPress={() => setReplyTo(null)}>
              <Feather name="x" size={18} color={C.textSecondary} />
            </Pressable>
          </View>
        )}

        {showVoiceRecorder ? (
          <VoiceRecorder
            peerId={peerId!}
            onRecordingComplete={handleVoiceRecordingComplete}
            onCancel={handleVoiceRecorderCancel}
          />
        ) : (
          <View style={[styles.inputBar, { paddingBottom: botInset + 8 }]}>
            <Pressable onPress={handleImage} style={styles.attachBtn}>
              <Feather name="image" size={20} color={C.textSecondary} />
            </Pressable>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={`Message ${peer.displayName}…`}
                placeholderTextColor={C.textMuted}
                multiline
                maxLength={2000}
              />
            </View>
            {inputText.trim().length > 0 ? (
              <Pressable
                onPress={handleSend}
                style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.93 }] }]}
              >
                <Ionicons name="send" size={18} color={C.background} />
              </Pressable>
            ) : (
              <Pressable
                onPressIn={startRecording}
                onPressOut={stopRecording}
                style={({ pressed }) => [styles.voiceBtn, pressed && { backgroundColor: C.danger + "20", borderColor: C.danger + "50" }]}
              >
                <Ionicons name="mic" size={20} color={C.accent} />
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.surfaceBorder, gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backBtnAlt: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  peerAvatar: {
    width: 38, height: 38, borderRadius: 12, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  peerAvatarTxt: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statusDot: {
    position: "absolute", bottom: -2, right: -2,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: C.background,
  },
  headerInfo: { flex: 1, gap: 2 },
  headerName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text },
  headerMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  encBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 5, gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.surfaceBorder,
  },
  encText: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" },
  listPad: { paddingTop: 12, paddingBottom: 8, flexGrow: 1 },
  msgRow: { paddingHorizontal: 14, marginVertical: 2, flexDirection: "row" },
  rowOwn: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%", borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  bubbleOwn: {
    backgroundColor: C.messageBubbleOwn, borderBottomRightRadius: 4,
    borderWidth: 1, borderColor: C.accentDim + "40",
  },
  bubbleOther: {
    backgroundColor: C.messageBubble, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  msgText: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  textOwn: { color: C.messageTextOwn },
  textOther: { color: C.text },
  msgMeta: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  timeOwn: { color: C.accentDim + "80" },
  timeOther: { color: C.textMuted },
  expiryText: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" },
  imgWrapper: { borderRadius: 12, overflow: "hidden" },
  msgImage: { width: 200, height: 150 },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  voiceWave: { flexDirection: "row", alignItems: "center", gap: 2, flex: 1 },
  voiceBar: { width: 3, borderRadius: 2, opacity: 0.8 },
  voiceDur: { fontSize: 12, fontFamily: "Inter_500Medium" },
  replyPreview: {
    borderLeftWidth: 3, paddingLeft: 8, marginBottom: 4,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 4, paddingVertical: 4,
  },
  replyPreviewText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  reactRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  reactChip: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: C.surfaceElevated, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  reactEmoji: { fontSize: 14 },
  reactCount: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_600SemiBold" },
  typingOuter: { paddingHorizontal: 14, paddingVertical: 6 },
  typingBubble: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.messageBubble, borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 12, alignSelf: "flex-start",
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.textSecondary },
  replyBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: C.surfaceElevated,
    borderTopWidth: 1, borderTopColor: C.surfaceBorder,
  },
  replyBarTxt: { flex: 1, fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  recBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: C.surfaceBorder, backgroundColor: C.danger + "08",
  },
  recLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.danger },
  recTime: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.danger },
  recHint: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingTop: 8,
    gap: 8, borderTopWidth: 1, borderTopColor: C.surfaceBorder,
  },
  attachBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  inputWrap: {
    flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: C.surfaceBorder, maxHeight: 120,
  },
  input: { color: C.text, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  sendBtn: {
    width: 44, height: 44, backgroundColor: C.accent,
    borderRadius: 22, alignItems: "center", justifyContent: "center",
  },
  voiceBtn: {
    width: 44, height: 44, backgroundColor: C.surfaceElevated,
    borderRadius: 22, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyAvatar: {
    width: 64, height: 64, borderRadius: 18, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  emptyAvatarTxt: { fontSize: 28, fontFamily: "Inter_700Bold" },
  emptyName: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: C.text },
  emptySub: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 16, color: C.textSecondary },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center",
  },
  optionsMenu: {
    backgroundColor: C.surfaceElevated, borderRadius: 20, padding: 8,
    minWidth: 220, borderWidth: 1, borderColor: C.surfaceBorder, gap: 2,
  },
  emojiRow: { flexDirection: "row", gap: 2, padding: 8, justifyContent: "center" },
  emojiBtn: { padding: 4 },
  emojiText: { fontSize: 28 },
  optsDivider: { height: 1, backgroundColor: C.surfaceBorder, marginHorizontal: 8 },
  optsRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  optsText: { fontSize: 15, color: C.text, fontFamily: "Inter_500Medium" },
});
