import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import Colors from "@/constants/colors";
import { Message } from "@/context/MeshContext";
import { audio } from "@/modules";

const C = Colors.dark;

interface Props {
  message: Message;
  isOwn: boolean;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  if (status === "sending") {
    return <Ionicons name="time-outline" size={10} color={C.textMuted} />;
  }
  if (status === "sent") {
    return <Ionicons name="checkmark" size={10} color={C.textSecondary} />;
  }
  if (status === "delivered") {
    return <Ionicons name="checkmark-done" size={10} color={C.accent} />;
  }
  if (status === "failed") {
    return <Ionicons name="alert-circle" size={10} color={C.danger} />;
  }
  return null;
}

export function MessageBubble({ message, isOwn }: Props) {
  const isBroadcast = message.type === "broadcast";
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const playVoiceMessage = async () => {
    try {
      if (isPlaying) {
        await audio.pausePlayback();
        setIsPlaying(false);
      } else {
        // Parse voice data from message content if needed
        await audio.startPlayback(message.content as any);
        setIsPlaying(true);
        
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setPlaybackProgress((p) => {
            if (p >= 100) {
              clearInterval(progressInterval);
              setIsPlaying(false);
              return 0;
            }
            return p + 1;
          });
        }, 100);
      }
    } catch (err) {
      console.error("[MessageBubble] Voice playback failed:", err);
      setIsPlaying(false);
    }
  };

  if (isBroadcast) {
    return (
      <View style={styles.broadcastContainer}>
        <View style={styles.broadcastBubble}>
          <View style={styles.broadcastHeader}>
            <Ionicons name="radio" size={12} color={C.danger} />
            <Text style={styles.broadcastLabel}>EMERGENCY BROADCAST</Text>
          </View>
          <Text style={styles.broadcastContent}>{message.content}</Text>
          <Text style={styles.broadcastTime}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
        ]}
      >
        {message.type === "voice" ? (
          <TouchableOpacity onPress={playVoiceMessage} activeOpacity={0.7}>
            <View style={styles.voiceRow}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={16}
                color={isOwn ? C.accentDim : C.textSecondary}
              />
              <View style={styles.voiceWave}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.voiceBar,
                      {
                        height: 4 + Math.sin(i * 0.9) * 8 + Math.random() * 4,
                        backgroundColor: isOwn ? C.accentDim : C.textSecondary,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.voiceDuration, isOwn ? styles.textOwn : styles.textOther]}>
                0:{message.content.padStart(2, "0")}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.content, isOwn ? styles.textOwn : styles.textOther]}>
            {message.content}
          </Text>
        )}
        <View style={styles.meta}>
          {message.hops > 0 && (
            <View style={styles.hopBadge}>
              <Ionicons name="git-merge-outline" size={9} color={C.textMuted} />
              <Text style={styles.hopText}>{message.hops}</Text>
            </View>
          )}
          {message.encrypted && (
            <Ionicons name="lock-closed" size={9} color={C.textMuted} />
          )}
          <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
            {formatTime(message.timestamp)}
          </Text>
          {isOwn && <StatusIcon status={message.status} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    marginVertical: 2,
    flexDirection: "row",
  },
  rowOwn: {
    justifyContent: "flex-end",
  },
  rowOther: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
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
  content: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  textOwn: {
    color: C.messageTextOwn,
  },
  textOther: {
    color: C.text,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
  },
  time: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  timeOwn: {
    color: C.accentDim + "80",
  },
  timeOther: {
    color: C.textMuted,
  },
  hopBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  hopText: {
    fontSize: 9,
    color: C.textMuted,
    fontFamily: "Inter_500Medium",
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceWave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  voiceBar: {
    width: 3,
    borderRadius: 2,
    opacity: 0.7,
  },
  voiceDuration: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  broadcastContainer: {
    paddingHorizontal: 16,
    marginVertical: 8,
    alignItems: "center",
  },
  broadcastBubble: {
    backgroundColor: C.danger + "15",
    borderWidth: 1,
    borderColor: C.danger + "50",
    borderRadius: 12,
    padding: 12,
    width: "100%",
    gap: 6,
  },
  broadcastHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  broadcastLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: C.danger,
    letterSpacing: 1,
  },
  broadcastContent: {
    fontSize: 14,
    color: C.text,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  broadcastTime: {
    fontSize: 10,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    alignSelf: "flex-end",
  },
});
