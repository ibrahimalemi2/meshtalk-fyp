import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMesh, AVATAR_COLOR_OPTIONS } from "@/context/MeshContext";
import { ProfileAvatar } from "@/components/ProfileAvatar";

const C = Colors.dark;
const TOTAL_STEPS = 3;

function PulsingMesh() {
  const s1 = useSharedValue(1);
  const s2 = useSharedValue(1);
  const s3 = useSharedValue(1);
  React.useEffect(() => {
    s1.value = withRepeat(withTiming(1.6, { duration: 1800 }), -1, true);
    setTimeout(() => { s2.value = withRepeat(withTiming(1.6, { duration: 1800 }), -1, true); }, 600);
    setTimeout(() => { s3.value = withRepeat(withTiming(1.6, { duration: 1800 }), -1, true); }, 1200);
  }, []);
  const a1 = useAnimatedStyle(() => ({ transform: [{ scale: s1.value }], opacity: 1.7 - s1.value }));
  const a2 = useAnimatedStyle(() => ({ transform: [{ scale: s2.value }], opacity: 1.7 - s2.value }));
  const a3 = useAnimatedStyle(() => ({ transform: [{ scale: s3.value }], opacity: 1.7 - s3.value }));
  const ring = { position: "absolute" as const, width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, borderColor: C.accent };
  return (
    <View style={styles.meshContainer}>
      <Animated.View style={[ring, a3]} />
      <Animated.View style={[ring, a2]} />
      <Animated.View style={[ring, a1]} />
      <View style={styles.meshCore}>
        <Feather name="radio" size={36} color={C.accent} />
      </View>
    </View>
  );
}

function StepDots({ active }: { active: number }) {
  return (
    <View style={styles.stepDots}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={[styles.dot, i <= active && styles.dotActive]} />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile, completeOnboarding } = useMesh();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(C.accent);
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const photoScale = useSharedValue(1);

  const slideX = useSharedValue(0);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));
  const photoAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: photoScale.value }] }));

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    slideX.value = withSpring(0);
    setStep((s) => s + 1);
  };

  const handleNameContinue = () => {
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    setError("");
    goNext();
  };

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateProfile(name.trim() || "My Node", selectedColor, profilePhoto ?? null);
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  const handlePickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      photoScale.value = withSpring(1.12, {}, () => { photoScale.value = withSpring(1); });
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Camera Access", "Please allow camera access in Settings to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      photoScale.value = withSpring(1.12, {}, () => { photoScale.value = withSpring(1); });
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const handlePhotoOptions = () => {
    Alert.alert("Profile Photo", "Choose how to add your photo", [
      { text: "Choose from Library", onPress: handlePickFromLibrary },
      { text: "Take Photo", onPress: handleTakePhoto },
      ...(profilePhoto ? [{ text: "Remove Photo", style: "destructive" as const, onPress: () => setProfilePhoto(undefined) }] : []),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {step === 0 && (
        <Animated.View style={[styles.step, slideStyle]}>
          <View style={styles.heroSection}>
            <PulsingMesh />
          </View>
          <Text style={styles.headline}>Welcome to{"\n"}MeshTalk</Text>
          <Text style={styles.subtext}>
            Communicate without internet. Your phone becomes part of a peer-to-peer mesh network — no servers, no surveillance.
          </Text>
          <View style={styles.featureList}>
            {[
              { icon: "lock", text: "End-to-end encrypted with Double Ratchet" },
              { icon: "radio", text: "Multi-hop relay through nearby devices" },
              { icon: "wifi-off", text: "Works completely offline" },
            ].map((f) => (
              <View key={f.icon} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Feather name={f.icon as any} size={16} color={C.accent} />
                </View>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={goNext} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.primaryBtnText}>Get Started</Text>
            <Feather name="arrow-right" size={18} color={C.background} />
          </Pressable>
        </Animated.View>
      )}

      {step === 1 && (
        <Animated.View style={[styles.step, slideStyle]}>
          <View style={styles.stepHeader}>
            <StepDots active={0} />
          </View>
          <Text style={styles.headline}>Who are{"\n"}you on the mesh?</Text>
          <Text style={styles.subtext}>Set your callsign and add an optional profile photo — visible to nearby nodes.</Text>

          <View style={styles.photoRow}>
            <Pressable onPress={handlePhotoOptions} style={styles.photoButton}>
              <Animated.View style={photoAnimStyle}>
                <ProfileAvatar
                  photo={profilePhoto}
                  letter={name.charAt(0) || "?"}
                  color={selectedColor}
                  size={88}
                  borderRadius={26}
                  showBorder
                />
              </Animated.View>
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </Pressable>
            <View style={styles.photoHints}>
              <Pressable onPress={handlePickFromLibrary} style={styles.photoHintBtn}>
                <Feather name="image" size={15} color={C.accent} />
                <Text style={styles.photoHintText}>Library</Text>
              </Pressable>
              <Pressable onPress={handleTakePhoto} style={styles.photoHintBtn}>
                <Ionicons name="camera-outline" size={15} color={C.accent} />
                <Text style={styles.photoHintText}>Camera</Text>
              </Pressable>
              {profilePhoto && (
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setProfilePhoto(undefined); }}
                  style={[styles.photoHintBtn, styles.photoRemoveBtn]}
                >
                  <Feather name="x" size={15} color={C.danger} />
                  <Text style={[styles.photoHintText, { color: C.danger }]}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={(t) => { setName(t); setError(""); }}
              placeholder="e.g. Alpha Rider, Nova Base..."
              placeholderTextColor={C.textMuted}
              maxLength={24}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleNameContinue}
            />
            <Text style={styles.charCount}>{name.length}/24</Text>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={handleNameContinue} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.primaryBtnText}>Continue</Text>
            <Feather name="arrow-right" size={18} color={C.background} />
          </Pressable>
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View style={[styles.step, slideStyle]}>
          <View style={styles.stepHeader}>
            <StepDots active={1} />
          </View>
          <Text style={styles.headline}>Pick your{"\n"}node color</Text>
          <Text style={styles.subtext}>Your accent color is shown on the topology map and in chat bubbles.</Text>

          <View style={styles.avatarPreview}>
            <Pressable onPress={handlePhotoOptions}>
              <ProfileAvatar
                photo={profilePhoto}
                letter={name.charAt(0) || "?"}
                color={selectedColor}
                size={96}
                borderRadius={28}
                showBorder
              />
              <View style={styles.cameraBadgeSmall}>
                <Ionicons name="camera" size={11} color="#fff" />
              </View>
            </Pressable>
            <Text style={styles.avatarName}>{name || "Your Node"}</Text>
          </View>

          <View style={styles.colorGrid}>
            {AVATAR_COLOR_OPTIONS.map((color) => (
              <Pressable
                key={color}
                onPress={() => { Haptics.selectionAsync(); setSelectedColor(color); }}
                style={[styles.colorSwatch, { backgroundColor: color + "20", borderColor: color }]}
              >
                <View style={[styles.colorInner, { backgroundColor: color }]} />
                {selectedColor === color && (
                  <View style={styles.colorCheck}>
                    <Feather name="check" size={10} color="#000" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleFinish} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.primaryBtnText}>Join the Mesh</Text>
            <Feather name="radio" size={18} color={C.background} />
          </Pressable>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  step: { flex: 1, paddingHorizontal: 28, paddingTop: 20, gap: 20 },
  stepHeader: { alignItems: "center" },
  stepDots: { flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.surfaceBorder },
  dotActive: { backgroundColor: C.accent, width: 18 },
  heroSection: { alignItems: "center", paddingVertical: 20 },
  meshContainer: { width: 140, height: 140, alignItems: "center", justifyContent: "center" },
  meshCore: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.accentMuted,
    borderWidth: 2, borderColor: C.accent + "60", alignItems: "center", justifyContent: "center",
  },
  headline: { fontSize: 36, fontFamily: "Inter_700Bold", color: C.text, lineHeight: 44, letterSpacing: -1 },
  subtext: { fontSize: 15, fontFamily: "Inter_400Regular", color: C.textSecondary, lineHeight: 23 },
  featureList: { gap: 14, flex: 1 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: C.accentMuted,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.accent + "30",
  },
  featureText: { fontSize: 14, fontFamily: "Inter_500Medium", color: C.text, flex: 1 },
  primaryBtn: {
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.background },

  photoRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  photoButton: { position: "relative" },
  cameraBadge: {
    position: "absolute", bottom: -2, right: -2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.accent, borderWidth: 2.5, borderColor: C.background,
    alignItems: "center", justifyContent: "center",
  },
  cameraBadgeSmall: {
    position: "absolute", bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.accent, borderWidth: 2, borderColor: C.background,
    alignItems: "center", justifyContent: "center",
  },
  photoHints: { flex: 1, gap: 8 },
  photoHintBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.surfaceElevated, borderRadius: 10, borderWidth: 1,
    borderColor: C.surfaceBorder, paddingHorizontal: 14, paddingVertical: 10,
  },
  photoRemoveBtn: { borderColor: C.danger + "30", backgroundColor: C.danger + "08" },
  photoHintText: { fontSize: 14, color: C.accent, fontFamily: "Inter_500Medium" },

  inputWrapper: {
    backgroundColor: C.surfaceElevated, borderRadius: 16, borderWidth: 1,
    borderColor: C.surfaceBorder, paddingHorizontal: 18, paddingVertical: 4,
    flexDirection: "row", alignItems: "center",
  },
  nameInput: { flex: 1, fontSize: 17, color: C.text, fontFamily: "Inter_500Medium", paddingVertical: 16 },
  charCount: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 13, color: C.danger, fontFamily: "Inter_500Medium", marginTop: -8 },

  avatarPreview: { alignItems: "center", gap: 10, paddingVertical: 8, position: "relative" },
  avatarName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  colorSwatch: { width: 56, height: 56, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  colorInner: { width: 28, height: 28, borderRadius: 8 },
  colorCheck: {
    position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
});
