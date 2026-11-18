import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useMesh, AVATAR_COLOR_OPTIONS } from "@/context/MeshContext";
import { ProfileAvatar } from "@/components/ProfileAvatar";

const C = Colors.dark;
const TTL_OPTIONS = [1, 6, 12, 24, 48, 72];

function SettingRow({
  icon, label, value, onPress, color, danger,
}: {
  icon: string; label: string; value?: string; onPress?: () => void; color?: string; danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.settingRow, pressed && onPress && { backgroundColor: C.surfaceBorder }]}
    >
      <View style={[styles.settingIcon, { backgroundColor: (color ?? C.accent) + "15" }]}>
        <Feather name={icon as any} size={16} color={color ?? C.accent} />
      </View>
      <Text style={[styles.settingLabel, danger && { color: C.danger }]}>{label}</Text>
      {value !== undefined && <Text style={styles.settingValue}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={C.textMuted} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { myNode, isRelayMode, defaultTtl, setRelayMode, setDefaultTtl, updateProfile, clearConversation, conversations } = useMesh();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 84;

  const [editProfile, setEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(C.accent);
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);
  const [photoChanged, setPhotoChanged] = useState(false);

  const photoScale = useSharedValue(1);
  const photoStyle = useAnimatedStyle(() => ({ transform: [{ scale: photoScale.value }] }));

  useEffect(() => {
    if (myNode) {
      setEditName(myNode.displayName);
      setEditColor(myNode.avatarColor);
      setEditPhoto(myNode.profilePhoto);
      setPhotoChanged(false);
    }
  }, [myNode]);

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      photoScale.value = withSpring(1.08, {}, () => { photoScale.value = withSpring(1); });
      setEditPhoto(result.assets[0].uri);
      setPhotoChanged(true);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Camera access needed", "Please allow camera access in settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      photoScale.value = withSpring(1.08, {}, () => { photoScale.value = withSpring(1); });
      setEditPhoto(result.assets[0].uri);
      setPhotoChanged(true);
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert("Remove Photo", "Remove your profile photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setEditPhoto(undefined);
          setPhotoChanged(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      },
    ]);
  };

  const handlePhotoOptions = () => {
    const options: any[] = [
      { text: "Choose from Library", onPress: handlePickPhoto },
      { text: "Take Photo", onPress: handleTakePhoto },
    ];
    if (editPhoto) {
      options.push({ text: "Remove Photo", style: "destructive", onPress: handleRemovePhoto });
    }
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Profile Photo", "Update your photo", options);
  };

  const handleSaveProfile = async () => {
    if (editName.trim().length < 2) {
      Alert.alert("Name too short", "Display name must be at least 2 characters.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateProfile(
      editName.trim(),
      editColor,
      photoChanged ? (editPhoto ?? null) : undefined
    );
    setPhotoChanged(false);
    setEditProfile(false);
  };

  const handleClearAll = () => {
    Alert.alert("Clear All Conversations", "This will delete all local messages. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: () => {
          conversations.forEach((c) => clearConversation(c.peerId));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  if (!myNode) return null;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <Modal visible={editProfile} animationType="slide" transparent onRequestClose={() => setEditProfile(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditProfile(false)}>
          <Pressable style={styles.editSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit Profile</Text>

            <View style={styles.photoSection}>
              <Pressable onPress={handlePhotoOptions}>
                <Animated.View style={[styles.photoWrap, photoStyle]}>
                  <ProfileAvatar
                    photo={editPhoto}
                    letter={editName.charAt(0) || myNode.displayName.charAt(0)}
                    color={editColor}
                    size={90}
                    borderRadius={28}
                    showBorder
                  />
                  <View style={styles.cameraOverlay}>
                    <Ionicons name="camera" size={18} color="#fff" />
                  </View>
                </Animated.View>
              </Pressable>
              <View style={styles.photoActions}>
                <Pressable onPress={handlePickPhoto} style={styles.photoActionBtn}>
                  <Feather name="image" size={15} color={C.accent} />
                  <Text style={styles.photoActionText}>Library</Text>
                </Pressable>
                <Pressable onPress={handleTakePhoto} style={styles.photoActionBtn}>
                  <Ionicons name="camera-outline" size={15} color={C.accent} />
                  <Text style={styles.photoActionText}>Camera</Text>
                </Pressable>
                {editPhoto && (
                  <Pressable onPress={handleRemovePhoto} style={[styles.photoActionBtn, styles.photoActionDanger]}>
                    <Feather name="trash-2" size={15} color={C.danger} />
                    <Text style={[styles.photoActionText, { color: C.danger }]}>Remove</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Text style={styles.sheetLabel}>Callsign</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Display name..."
                placeholderTextColor={C.textMuted}
                maxLength={24}
              />
            </View>

            <Text style={styles.sheetLabel}>Node Color</Text>
            <View style={styles.colorGrid}>
              {AVATAR_COLOR_OPTIONS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => { Haptics.selectionAsync(); setEditColor(color); }}
                  style={[styles.colorSwatch, { backgroundColor: color + "20", borderColor: color + (editColor === color ? "CC" : "40") }]}
                >
                  <View style={[styles.colorInner, { backgroundColor: color }]} />
                  {editColor === color && (
                    <View style={styles.colorCheck}>
                      <Feather name="check" size={10} color="#000" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleSaveProfile}
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <Pressable
            onPress={() => setEditProfile(true)}
            style={styles.profileAvatarWrap}
          >
            <ProfileAvatar
              photo={myNode.profilePhoto}
              letter={myNode.displayName.charAt(0)}
              color={myNode.avatarColor}
              size={60}
              borderRadius={18}
              showBorder
            />
            <View style={styles.editPhotoPin}>
              <Ionicons name="camera" size={10} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{myNode.displayName}</Text>
            <Text style={styles.profileId} numberOfLines={1}>{myNode.publicKey}</Text>
            {myNode.profilePhoto ? (
              <View style={styles.photoBadge}>
                <Ionicons name="image" size={10} color={C.accent} />
                <Text style={styles.photoBadgeText}>Photo set</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => setEditProfile(true)}
            style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="edit-2" size={16} color={C.accent} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NODE SETTINGS</Text>
          <View style={styles.sectionCard}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: C.relay + "15" }]}>
                <Feather name="radio" size={16} color={C.relay} />
              </View>
              <View style={styles.settingLabelGroup}>
                <Text style={styles.settingLabel}>Relay Mode</Text>
                <Text style={styles.settingHint}>Forward packets for nearby nodes</Text>
              </View>
              <Switch
                value={isRelayMode}
                onValueChange={(v) => { Haptics.selectionAsync(); setRelayMode(v); }}
                trackColor={{ false: C.surfaceBorder, true: C.relay + "60" }}
                thumbColor={isRelayMode ? C.relay : C.textMuted}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: C.accent + "15" }]}>
                <Feather name="clock" size={16} color={C.accent} />
              </View>
              <View style={styles.settingLabelGroup}>
                <Text style={styles.settingLabel}>Message TTL</Text>
                <Text style={styles.settingHint}>Time before messages expire</Text>
              </View>
            </View>
            <View style={styles.ttlRow}>
              {TTL_OPTIONS.map((ttl) => (
                <Pressable
                  key={ttl}
                  onPress={() => { Haptics.selectionAsync(); setDefaultTtl(ttl); }}
                  style={[styles.ttlBtn, defaultTtl === ttl && styles.ttlBtnActive]}
                >
                  <Text style={[styles.ttlText, defaultTtl === ttl && styles.ttlTextActive]}>
                    {ttl < 24 ? `${ttl}h` : `${ttl / 24}d`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NETWORK</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="share-2" label="Topology Map" onPress={() => router.push("/topology" as any)} />
            <View style={styles.divider} />
            <SettingRow icon="wifi-off" label="Offline Mode" value="Active" />
            <View style={styles.divider} />
            <SettingRow icon="battery-charging" label="Battery Level" value={`${myNode.batteryLevel}%`} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY & IDENTITY</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="lock" label="Encryption" value="Double Ratchet" color={C.accent} />
            <View style={styles.divider} />
            <SettingRow icon="key" label="Identity Key" onPress={() => router.push("/qrcode" as any)} />
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: C.accent + "15" }]}>
                <Feather name="shield" size={16} color={C.accent} />
              </View>
              <View style={styles.settingLabelGroup}>
                <Text style={styles.settingLabel}>Forward Secrecy</Text>
                <Text style={styles.settingHint}>Keys rotate after each message</Text>
              </View>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>ON</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          <View style={styles.sectionCard}>
            <SettingRow icon="trash-2" label="Clear All Conversations" onPress={handleClearAll} danger color={C.danger} />
            <View style={styles.divider} />
            <SettingRow
              icon="refresh-cw"
              label="Reset Onboarding"
              onPress={() =>
                Alert.alert("Reset", "This will restart the onboarding flow.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Reset", style: "destructive", onPress: () => router.replace("/onboarding") },
                ])
              }
              color={C.warning}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Feather name="radio" size={20} color={C.accent} />
          <Text style={styles.footerText}>MeshTalk v1.0</Text>
          <Text style={styles.footerSub}>No servers. No surveillance. Pure mesh.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: C.text, letterSpacing: -0.5 },

  profileCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: C.surfaceElevated, borderRadius: 20,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, borderColor: C.surfaceBorder,
  },
  profileAvatarWrap: { position: "relative" },
  editPhotoPin: {
    position: "absolute", bottom: -3, right: -3,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: C.accent, borderWidth: 2, borderColor: C.background,
    alignItems: "center", justifyContent: "center",
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontFamily: "Inter_700Bold", color: C.text },
  profileId: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  photoBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.accentMuted, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3, alignSelf: "flex-start",
    borderWidth: 1, borderColor: C.accent + "30",
  },
  photoBadgeText: { fontSize: 10, color: C.accent, fontFamily: "Inter_600SemiBold" },
  editBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.accentMuted, borderWidth: 1, borderColor: C.accent + "30",
    alignItems: "center", justifyContent: "center",
  },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, color: C.textMuted, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, marginHorizontal: 20, marginBottom: 8,
  },
  sectionCard: {
    marginHorizontal: 16, backgroundColor: C.surfaceElevated,
    borderRadius: 16, borderWidth: 1, borderColor: C.surfaceBorder, overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  settingIcon: {
    width: 34, height: 34, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  settingLabelGroup: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.text },
  settingHint: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular" },
  settingValue: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.surfaceBorder, marginLeft: 62 },
  ttlRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 14, flexWrap: "wrap" },
  ttlBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.surfaceBorder,
  },
  ttlBtnActive: { backgroundColor: C.accentMuted, borderColor: C.accent + "50" },
  ttlText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_500Medium" },
  ttlTextActive: { color: C.accent, fontFamily: "Inter_600SemiBold" },
  activePill: {
    backgroundColor: C.accentMuted, borderWidth: 1, borderColor: C.accent + "40",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  activePillText: { fontSize: 11, color: C.accent, fontFamily: "Inter_700Bold" },
  footer: { alignItems: "center", gap: 6, paddingVertical: 32 },
  footerText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  footerSub: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  editSheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, gap: 14, borderTopWidth: 1, borderTopColor: C.surfaceBorder,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.surfaceBorder,
    alignSelf: "center", marginBottom: 8,
  },
  sheetTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: C.text },
  sheetLabel: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },

  photoSection: { flexDirection: "row", alignItems: "center", gap: 20, paddingVertical: 4 },
  photoWrap: { position: "relative" },
  cameraOverlay: {
    position: "absolute", bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.accent, borderWidth: 2.5, borderColor: C.surface,
    alignItems: "center", justifyContent: "center",
  },
  photoActions: { flex: 1, gap: 8 },
  photoActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.surfaceElevated, borderRadius: 10, borderWidth: 1,
    borderColor: C.surfaceBorder, paddingHorizontal: 14, paddingVertical: 10,
  },
  photoActionDanger: { borderColor: C.danger + "30", backgroundColor: C.danger + "08" },
  photoActionText: { fontSize: 14, color: C.accent, fontFamily: "Inter_500Medium" },

  inputWrapper: {
    backgroundColor: C.surfaceElevated, borderRadius: 14,
    borderWidth: 1, borderColor: C.surfaceBorder, paddingHorizontal: 16,
  },
  input: { fontSize: 16, color: C.text, fontFamily: "Inter_500Medium", paddingVertical: 14 },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  colorInner: { width: 22, height: 22, borderRadius: 7 },
  colorCheck: {
    position: "absolute", top: 3, right: 3, width: 14, height: 14,
    borderRadius: 7, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center",
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: C.background },
});
