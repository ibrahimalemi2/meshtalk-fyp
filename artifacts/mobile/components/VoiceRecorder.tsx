import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  Animated,
  GestureResponderEvent,
  Dimensions,
} from "react-native";
import { useMesh } from "@/context/MeshContext";
import { audio } from "@/modules";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface VoiceRecorderProps {
  onRecordingComplete: (audioData: Uint8Array, duration: number) => void;
  onCancel: () => void;
  peerId: string;
}

export function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  peerId,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(20).fill(0.3));
  const recordingSessionRef = useRef<string | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Update waveform bars with random animation
  useEffect(() => {
    if (!isRecording) return;

    waveformIntervalRef.current = setInterval(() => {
      setWaveformBars((bars) =>
        bars.map(() => 0.3 + Math.random() * 0.7)
      );
    }, 100);

    return () => {
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
    };
  }, [isRecording]);

  // Update recording time
  useEffect(() => {
    if (!isRecording) return;

    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);

    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();
      setRecordingTime(0);
      setWaveformBars(Array(20).fill(0.3));

      const sessionId = await audio.startRecording();
      recordingSessionRef.current = sessionId;
      console.log("[VoiceRecorder] Recording started:", sessionId);
    } catch (err) {
      console.error("[VoiceRecorder] Failed to start recording:", err);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recordingSessionRef.current) return;

    try {
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);

      const audioData = await audio.stopRecording(recordingSessionRef.current);
      const duration = Date.now() - recordingStartTimeRef.current;

      recordingSessionRef.current = null;
      onRecordingComplete(audioData, duration);
    } catch (err) {
      console.error("[VoiceRecorder] Failed to stop recording:", err);
      setIsRecording(false);
    }
  };

  const handlePressIn = () => {
    startRecording();
  };

  const handlePressOut = () => {
    stopRecording();
  };

  const handleCancel = async () => {
    if (recordingSessionRef.current) {
      try {
        await audio.cancelRecording(recordingSessionRef.current);
        recordingSessionRef.current = null;
      } catch (err) {
        console.error("[VoiceRecorder] Failed to cancel recording:", err);
      }
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isRecording) {
    return null;
  }

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: C.surfaceElevated,
        borderTopWidth: 1,
        borderTopColor: C.surfaceBorder,
        paddingVertical: 16,
        paddingHorizontal: 16,
      }}
    >
      {/* Recording Header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Animated.View
          style={[
            {
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: "#FF4757",
              marginRight: 8,
            },
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Text style={{ color: C.text, fontSize: 14, fontWeight: "600", flex: 1 }}>
          Recording...
        </Text>
        <Text style={{ color: C.textSecondary, fontSize: 13 }}>
          {formatTime(recordingTime)}
        </Text>
      </View>

      {/* Waveform Visualization */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
          height: 40,
          marginBottom: 12,
          gap: 2,
        }}
      >
        {waveformBars.map((bar, i) => (
          <View
            key={i}
            style={{
              width: 3,
              height: `${bar * 100}%`,
              backgroundColor: "#00FF87",
              borderRadius: 2,
              opacity: 0.7,
            }}
          />
        ))}
      </View>

      {/* Controls */}
      <View style={{ flexDirection: "row", gap: 12, justifyContent: "center" }}>
        {/* Cancel Button */}
        <TouchableOpacity
          onPress={handleCancel}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: C.surface,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: C.surfaceBorder,
          }}
        >
          <Text style={{ fontSize: 20 }}>✕</Text>
        </TouchableOpacity>

        {/* Send Button */}
        <TouchableOpacity
          onPressIn={handlePressOut}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: "#00FF87",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 20 }}>✓</Text>
        </TouchableOpacity>
      </View>

      {/* Slide to Cancel Hint */}
      <Text
        style={{
          color: C.textSecondary,
          fontSize: 12,
          textAlign: "center",
          marginTop: 8,
        }}
      >
        Release to send • Tap ✕ to cancel
      </Text>
    </View>
  );
}
