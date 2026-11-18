import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMesh } from "@/context/MeshContext";
import { GroupMessageBubble } from "@/components/GroupMessageBubble";

const C = Colors.dark;

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const insets = useSafeAreaInsets();
  const { peers, getGroup, sendGroupMessage, markGroupRead, addGroupReaction, myNode } = useMesh();
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const group = getGroup(groupId ?? "");
  const messages = group?.messages ?? [];

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (groupId) markGroupRead(groupId);
  }, [groupId, messages.length]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !groupId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText("");
    await sendGroupMessage(groupId, "text", text);
  }, [inputText, groupId, sendGroupMessage]);

  const handleImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendGroupMessage(groupId!, "image", "📷 Photo", result.assets[0].uri);
    }
  }, [groupId, sendGroupMessage]);

  const startRecording = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimer.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  }, []);

  const stopRecording = useCallback(async () => {
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    const duration = recordingSeconds;
    setIsRecording(false);
    setRecordingSeconds(0);
    if (duration >= 1 && groupId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await sendGroupMessage(groupId, "voice", String(Math.min(duration, 60)));
    }
  }, [recordingSeconds, groupId, sendGroupMessage]);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    if (!groupId) return;
    addGroupReaction(groupId, messageId, emoji);
  }, [groupId, addGroupReaction]);

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Group not found</Text>
        </View>
      </View>
    );
  }

  const memberNames = group.memberIds
    .map((id) => peers.find((p) => p.id === id)?.displayName)
    .filter(Boolean)
    .join(", ");

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={[styles.groupAvatar, { backgroundColor: group.avatarColor + "20", borderColor: group.avatarColor + "60" }]}>
          <Text style={[styles.groupAvatarText, { color: group.avatarColor }]}>{group.avatar}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{group.name}</Text>
          <Text style={styles.headerMeta} numberOfLines={1}>
            {group.memberIds.length + 1} members · {memberNames}
          </Text>
        </View>
        <Pressable
          onPress={() => Alert.alert("Group", `Members: You, ${memberNames}`)}
          style={({ pressed }) => [styles.infoBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="people" size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.encryptBanner}>
        <Ionicons name="lock-closed" size={10} color={C.accentDim} />
        <Text style={styles.encryptText}>Group E2EE · {group.memberIds.length + 1} nodes · Double Ratchet</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isOwn = item.senderId === myNode?.id;
            const sender = isOwn ? myNode : peers.find((p) => p.id === item.senderId);
            return (
              <GroupMessageBubble
                message={item}
                isOwn={isOwn}
                senderName={sender?.displayName ?? "Unknown"}
                senderColor={isOwn ? myNode?.avatarColor ?? C.accent : (peers.find((p) => p.id === item.senderId)?.avatarColor ?? C.textMuted)}
                onReaction={(emoji) => handleReaction(item.id, emoji)}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyAvatar, { backgroundColor: group.avatarColor + "20", borderColor: group.avatarColor + "40" }]}>
                <Text style={[styles.emptyAvatarText, { color: group.avatarColor }]}>{group.avatar}</Text>
              </View>
              <Text style={styles.emptyTitle}>{group.name}</Text>
              <Text style={styles.emptySubtitle}>
                {group.memberIds.length + 1} members · Encrypted group chat{"\n"}No internet required.
              </Text>
            </View>
          }
        />

        {isRecording ? (
          <View style={[styles.recordingBar, { paddingBottom: bottomInset + 8 }]}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                Recording {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
              </Text>
            </View>
            <Pressable onPress={stopRecording} style={styles.stopBtn}>
              <Ionicons name="stop-circle" size={32} color={C.danger} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: bottomInset + 8 }]}>
            <Pressable onPress={handleImage} style={styles.attachBtn}>
              <Feather name="image" size={20} color={C.textSecondary} />
            </Pressable>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Group message..."
                placeholderTextColor={C.textMuted}
                multiline
                maxLength={2000}
              />
            </View>
            {inputText.trim().length > 0 ? (
              <Pressable
                onPress={handleSend}
                style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  groupAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headerInfo: { flex: 1, gap: 2 },
  headerName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text },
  headerMeta: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  infoBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  encryptBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.surfaceBorder,
  },
  encryptText: { fontSize: 10, color: C.textMuted, fontFamily: "Inter_400Regular" },
  msgList: { paddingTop: 12, paddingBottom: 8, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyAvatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: C.text },
  emptySubtitle: { fontSize: 13, color: C.textMuted, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: C.surfaceBorder,
  },
  attachBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  inputContainer: {
    flex: 1,
    backgroundColor: C.surfaceElevated,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    maxHeight: 120,
  },
  input: { color: C.text, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  sendBtn: {
    width: 44, height: 44, backgroundColor: C.accent, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  voiceBtn: {
    width: 44, height: 44, backgroundColor: C.surfaceElevated, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.surfaceBorder,
    backgroundColor: C.danger + "08",
  },
  recordingIndicator: { flexDirection: "row", alignItems: "center", gap: 10 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.danger },
  recordingText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: C.danger },
  stopBtn: { padding: 4 },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 16, color: C.textSecondary, fontFamily: "Inter_400Regular" },
});
