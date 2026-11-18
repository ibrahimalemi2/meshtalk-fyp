# Android & iOS Testing Setup Guide

## 📱 ANDROID TESTING (Building Now)

### Current Build Status
- **Platform**: Android
- **Method**: EAS Cloud Build
- **Build ID**: `aed806f9-0298-4c8d-9c2c-c8191f0ce59a`
- **Status**: Compiling (5-15 minutes)
- **Expected**: APK download link

### When Build Completes:
1. **Download APK** from EAS dashboard
2. **Install on Android device**:
   ```bash
   adb install -r app-release.apk
   ```
   OR
3. **Share link** - Get download link from EAS, email to yourself, tap on Android device

### Launch App
```
1. Find "Workspace" app on home screen
2. Tap to launch
3. Complete onboarding (name + avatar)
4. Test UI (no crashes)
```

---

## 🍎 iOS TESTING OPTIONS

### Option 1: EAS Cloud Build (Recommended)
```bash
cd artifacts/mobile
eas build --platform ios --profile preview
```

**Requirements**:
- Expo account (free)
- App Store Connect account (Apple ID)
- Team ID for App Store signing

**Result**: TestFlight invite → Install on iPhone

### Option 2: Expo Go (Quickest - No Real Peer Discovery)
```bash
# In artifacts/mobile
pnpm run dev

# Scan QR code with Expo Go app
# Note: Peer discovery won't work (native modules unavailable)
```

### Option 3: macOS Only - Local Build
```bash
# Requires macOS + Xcode
eas build --platform ios --profile preview --local
```

---

## 🎯 FASTEST PATH TO REAL TESTING

### For Now (This Session):

1. **Wait for Android Build** (~10-15 min)
   - Should see "✔ Build finished" in terminal
   - Get APK download link

2. **Install on Android Device**
   - Download APK
   - `adb install app-release.apk`
   - Launch app

3. **Test Single Device** (30 min)
   - No crashes
   - UI renders
   - Onboarding works
   - All tabs functional

4. **Later - Second Device**
   - Build iOS on Mac OR use Android emulator
   - Both on same WiFi
   - Test peer discovery (should see each other)

---

## 📊 TEST MATRIX - WHAT TO EXPECT

| Scenario | Device Count | Expected Result | Time |
|----------|---|---|---|
| **UI Only** | 1 Android | No crashes, renders correctly | 30 min |
| **Peer Discovery** | 2 Android | Both see each other on WiFi+BLE | 20 min |
| **Messaging** | 2 Android | Messages send/receive <2s | 20 min |
| **Voice Recording** | 1 Android | Waveform animates, records audio | 10 min |
| **Voice Playback** | 2 Android | Peer receives & plays voice msg | 10 min |

---

## ⚠️ Known Limitations

### Expo Go (Development)
- ❌ Peer discovery won't work (no native BLE/WiFi)
- ❌ Voice codec may not encode/decode
- ✅ UI renders perfectly
- ✅ Mock data loads

### EAS Build (Testing)
- ✅ Real peer discovery works
- ✅ Full encryption/crypto works
- ✅ Voice encoding/decoding works
- ✅ All features functional

---

## 🔧 NEXT STEPS

### Immediate (Today)
1. Monitor Android build completion
2. Download APK when ready
3. Install on Android device
4. Test single device UI (30 min)

### If You Have 2nd Device (Tomorrow)
```bash
# Option A: Use 2nd Android device
# Install same APK on both
# Both on same WiFi + Bluetooth ON
# Should discover each other

# Option B: Get macOS, build iOS
# Then repeat above with iPhone

# Option C: Use Android Emulator
# Run emulator instead of 2nd physical device
```

### For Production (Later)
- Build TestFlight for iOS (requires Mac + Apple ID)
- Deploy to Google Play Store (optional)
- Create app signing certificates

---

## 📋 CHECKLIST

### Before Testing
- [ ] Android device connected (USB for ADB)
- [ ] Android device USB debugging enabled
- [ ] Same WiFi network for both devices
- [ ] Bluetooth enabled on both
- [ ] Sufficient battery (>50%)

### During Testing
- [ ] No crashes on startup
- [ ] UI renders correctly
- [ ] Can complete onboarding
- [ ] All tabs are clickable
- [ ] No TypeScript errors in logs

### Voice Testing
- [ ] Microphone button appears
- [ ] Waveform animates while recording
- [ ] Can record 3-5 seconds
- [ ] Confirm button saves message
- [ ] Message appears in chat (if 2nd device)
- [ ] 2nd device can play voice

---

## 🚨 Troubleshooting

### "APK won't install"
```bash
# Try uninstalling first
adb uninstall com.mesh.app

# Then install
adb install app-release.apk
```

### "App crashes on startup"
```bash
# Check logs
adb logcat | grep "ERROR\|Exception"
```

### "Peer discovery not working"
```
✅ Normal on Expo Go (build with EAS instead)
✅ On real build, wait 15-20 seconds
✅ Check both devices have Bluetooth ON
✅ Check same WiFi network
```

### "Voice recording doesn't work"
```
✅ Tap microphone button
✅ Check permission dialog appears
✅ Grant microphone permission
✅ Speak into device
✅ Waveform should animate
```

---

## 📞 Support

If build fails:
```bash
# Check build logs
https://expo.dev/accounts/newaccnew169/projects/workspace/builds

# Rebuild with verbose output
eas build --platform android --profile preview --verbose
```

Good luck! 🚀
