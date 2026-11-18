# Real-World Testing Guide - Phase 6 Mesh Networking App

## Overview
This guide covers deploying Phase 6 to real Android/iOS devices and testing actual mesh networking functionality.

---

## PART 1: PREPARATION

### System Requirements
- **2+ Physical Devices** (Android or iOS)
- **Same Local WiFi Network** (for WiFi P2P)
- **Bluetooth Enabled** (for BLE discovery)
- **Same Building/Room** (for BLE signal strength)
- **EAS Account** (for managed builds)

### Prerequisites
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login
# Enter credentials (create account at https://expo.dev if needed)
```

---

## PART 2: BUILD FOR REAL DEVICES

### Option A: EAS Development Build (Recommended for Testing)
```bash
cd artifacts/mobile

# Build for Android
eas build --platform android --profile preview

# Build for iOS
eas build --platform ios --profile preview
```

**Wait for build to complete (~15-20 min)**
- You'll get a download link
- Download `.apk` (Android) or `.ipa` (iOS) file

### Option B: Expo Go (Limited - No Native Modules)
```bash
# Already running on http://localhost:3001
# Scan QR from Metro bundler with Expo Go app
# ⚠️ No BLE/WiFi discovery - UI only
```

### Option C: Manual Native Build
```bash
# Android
cd artifacts/mobile
pnpm exec eas build --platform android --local

# iOS (Mac only)
eas build --platform ios --local
```

---

## PART 3: DEPLOY TO REAL DEVICES

### For Android (EAS Build)
1. **Download APK** from EAS build link
2. **Install on Device**:
   ```bash
   adb install downloaded.apk
   ```
3. **Or manually**: Transfer APK → open on phone → Install
4. **Launch**: Tap app icon "Mesh Networking"

### For iOS (EAS Build)
1. **Option A - Direct Install**:
   - Use TestFlight (easier)
   - EAS manages distribution
   - Accept invite on phone

2. **Option B - Manual Install**:
   ```bash
   # Need Mac + Xcode
   xcode-select --install
   eas build --platform ios --local
   ```

---

## PART 4: REAL-WORLD TEST SCENARIOS

### 🧪 Scenario 1: Single Device - Basic UI Testing
**Setup**: 1 Android or 1 iOS device

**Test Steps**:
1. Open app
2. Complete onboarding (pick display name, avatar color)
3. Navigate through tabs:
   - ✅ Conversations tab
   - ✅ Peers tab (should be empty, that's normal)
   - ✅ Search tab
   - ✅ Settings tab
4. Send text message to self (if supported)
5. Check all UI renders correctly

**Passing Criteria**:
- ✅ App launches
- ✅ No crashes
- ✅ All tabs navigate
- ✅ Settings save preferences

---

### 🧪 Scenario 2: Two Devices - Peer Discovery Testing
**Setup**: 2 devices (Android + Android, iOS + iOS, or mixed)
- **Same WiFi network**
- **Bluetooth enabled**
- **Close proximity** (same room)

**Test Steps**:

#### Device A:
1. Launch app
2. Complete onboarding
3. Go to **Peers** tab
4. **Wait 10-15 seconds** for BLE/WiFi discovery
5. Watch console logs:
   ```
   [BLEScanner] Started scanning
   [WiFiP2P] Started discovery
   ```

#### Device B:
1. Simultaneously launch app
2. Complete onboarding with **different name** (e.g., "Alice", "Bob")
3. Go to **Peers** tab

**Expected Results** (after 15-30 seconds):
- ✅ Device A sees Device B in peers list
- ✅ Device B sees Device A in peers list
- ✅ Signal strength shows (0-100%)
- ✅ Status shows "online"

**If peers DON'T appear**:
- Check WiFi is same network
- Check Bluetooth is ON
- Check location permissions granted
- Check logs for errors

---

### 🧪 Scenario 3: Messaging Between Devices
**Setup**: 2+ devices with peers discovered (from Scenario 2)

#### Device A Sends to Device B:
1. Go to **Conversations** tab
2. See Device B in list (or search for it)
3. Tap to open chat
4. Type message: "Hello from Device A"
5. Tap **Send** button
6. Watch status change:
   - ⏳ "sending" (blue)
   - ✅ "sent" (green)
   - 📦 "delivered" (confirmed)

#### Device B Receives:
1. Should see chat notification
2. Go to **Conversations** 
3. Message appears: "Hello from Device A"
4. Can tap to reply

**Expected Results**:
- ✅ Message delivers in <2 seconds
- ✅ Status updates correctly
- ✅ Both devices show same message
- ✅ Delivery confirmed

---

### 🧪 Scenario 4: Voice Message Testing
**Setup**: 2 devices, discovered and connected (from Scenario 2-3)

#### Device A Records Voice:
1. Open chat with Device B
2. Tap **Microphone button** (🎙️)
3. VoiceRecorder overlay appears
4. **Speak clearly** for 3-5 seconds
   - Watch waveform animate
   - See duration countdown
5. Tap **Confirm checkmark** (✅)
6. Voice message sends

#### Device B Hears Voice:
1. Should receive voice message notification
2. Open chat
3. See voice message bubble with:
   - Waveform visualization
   - Duration "3s"
   - Play button (▶️)
4. **Tap to play**
5. **Hear your voice message** (if audio codec works)

**Expected Results**:
- ✅ Recording UI appears
- ✅ Voice encodes successfully
- ✅ Message sends to peer
- ✅ Peer receives & plays back
- ✅ No audio distortion

**If Audio Doesn't Work**:
- Check expo-av permissions
- Check device volume (not muted)
- Check audio codec phase 5 implementation
- Check browser console for errors

---

### 🧪 Scenario 5: Multi-Device Mesh (3+ Devices)
**Setup**: 3+ devices on same network

**Test Steps**:
1. Launch app on all devices
2. Let discover for 20-30 seconds
3. Each device should see **all other devices**
4. Send messages in a **triangle**:
   - Device A → Device B
   - Device B → Device C
   - Device C → Device A
5. All messages should deliver

**Expected Mesh Behavior**:
- ✅ A can message B and C directly
- ✅ B can relay messages for C if needed
- ✅ Routing algorithm handles multiple paths
- ✅ Messages reach correct recipients

**If devices don't all connect**:
- BLE range may be limited (~20-30m)
- WiFi P2P works better for range
- Check router doesn't block P2P
- Verify all devices have location permission

---

### 🧪 Scenario 6: Network Edge Cases
**Setup**: 2+ devices with various network conditions

#### Test Case 6A: Device Out of Range
1. Devices A & B discovered and messaging
2. Move Device A **far away** (>30m or different building)
3. Try to send message
4. Watch status:
   - Will show "sending" but may timeout
   - Should NOT crash
   - App remains responsive

**Expected**: Graceful timeout, no crash

#### Test Case 6B: Bluetooth Disabled Mid-Session
1. Devices A & B messaging
2. Go to Device B settings
3. **Turn OFF Bluetooth**
4. Device A tries to message Device B
5. Message may fail but app stays responsive

**Expected**: Error handling, no crash

#### Test Case 6C: WiFi Disconnected
1. Devices on same WiFi
2. Device B switches to mobile hotspot
3. Try to send WiFi P2P message
4. Should fail gracefully or switch to BLE

**Expected**: Graceful fallback or timeout

---

### 🧪 Scenario 7: Performance & Battery Testing
**Setup**: 2 devices running app for extended time

**Monitoring** (on real device):
- **Battery usage**: Settings → Battery → check app % drain
- **CPU usage**: Monitor for overheating
- **Network usage**: Data Plan settings
- **Memory**: Should be <150MB

**Test Duration**: 
- Run for 30 minutes with constant messaging
- Monitor for memory leaks
- Check battery drain rate

**Expected Results**:
- ✅ <5% battery drain per 30 min
- ✅ Device doesn't overheat
- ✅ <100MB RAM used
- ✅ Responsive throughout

---

### 🧪 Scenario 8: Permissions Testing
**Setup**: 1 device, test permission flows

**Test Each Permission**:

1. **Location Permission**
   - App requests on first launch
   - Grant/Deny
   - Verify peer discovery works with permission
   - Verify fails gracefully without

2. **Bluetooth Permission**
   - Required for BLE scanning
   - Grant/Deny
   - Check app behavior

3. **WiFi P2P Permission** (Android)
   - Required for direct WiFi
   - Grant/Deny
   - Test discovery works/fails accordingly

**Expected**:
- ✅ Clear permission prompts
- ✅ App works with or without permissions
- ✅ No crashes when denied
- ✅ Graceful degradation

---

## PART 5: DEBUGGING ON REAL DEVICES

### Android Debugging
```bash
# View device logs
adb logcat | grep -i "mesh\|protocol\|transport"

# Open DevTools
adb shell input keyevent 82  # Opens menu
# Select "Debug with DevTools"

# Or use built-in debugger
npx react-native-debugger
```

### iOS Debugging
```bash
# View console logs (requires Mac)
xcrun simctl spawn booted log stream --predicate "eventMessage contains[cd] 'mesh'"

# Or use physical device
Xcode → Product → Scheme → Edit Scheme → Run → Console
```

### Check Logs for Errors
```
[MeshProvider] ✅ Initializing protocol
[ProtocolEngine] ✅ Storage initialized
[ProtocolEngine] ✅ Crypto initialized
[ProtocolEngine] ✅ Routing initialized
[Transport] ✅ BLE scanning started
[Transport] ✅ WiFi P2P discovery started
[BLEScanner] ✅ Found peer: Alice (RSSI: -65)
```

### Watch for These Errors
```
❌ Cannot find module '@/modules'
❌ Native module BLE not available (should handle gracefully)
❌ Memory leak: listeners not cleaned up
❌ Uncaught error in packet routing
❌ Audio playback failed
```

---

## PART 6: TEST CHECKLIST - REAL DEVICES

### ✅ Deployment
- [ ] Created EAS account
- [ ] Built APK or IPA successfully
- [ ] Installed on real device(s)
- [ ] App launches without crash
- [ ] Onboarding completes

### ✅ Single Device
- [ ] All tabs navigate correctly
- [ ] Settings save and persist
- [ ] No memory leaks over 10 min
- [ ] Battery drain <1% per minute
- [ ] Console shows initialization logs

### ✅ Two Device - Discovery
- [ ] Both devices on same WiFi
- [ ] Both have Bluetooth enabled
- [ ] Device A sees Device B after 15 sec
- [ ] Device B sees Device A after 15 sec
- [ ] Signal strength displays (0-100%)
- [ ] Status shows "online"

### ✅ Messaging
- [ ] Can send text message between devices
- [ ] Message status: sending → sent → delivered
- [ ] Received message shows on peer
- [ ] Timestamp is correct
- [ ] Message history persists

### ✅ Voice
- [ ] Microphone button appears in chat
- [ ] VoiceRecorder UI opens
- [ ] Can record 3-5 seconds
- [ ] Voice message sends
- [ ] Peer receives voice message
- [ ] Can play back received voice
- [ ] Waveform shows during playback

### ✅ Performance
- [ ] No crashes after 30 min usage
- [ ] Battery drain <5% per 30 min
- [ ] Device doesn't overheat
- [ ] Messaging latency <1 second
- [ ] Voice codec completes in <2 sec

### ✅ Error Handling
- [ ] Device out of range → graceful timeout
- [ ] Bluetooth disabled → app continues
- [ ] WiFi disconnected → graceful degradation
- [ ] No console errors
- [ ] No white screen crashes

### ✅ Multi-Device (3+)
- [ ] All devices discover each other
- [ ] Messages route through intermediate devices
- [ ] No message loss
- [ ] Relay node selection works

---

## PART 7: PRODUCTION READINESS CHECKLIST

### Code Quality
- [ ] No TypeScript errors (`pnpm exec tsc --noEmit`)
- [ ] No console warnings
- [ ] Error boundaries working
- [ ] Proper error messages

### Security
- [ ] Crypto layer encrypts messages
- [ ] Keys generated securely
- [ ] No plaintext in logs
- [ ] Permissions handled correctly

### Performance
- [ ] Bundle size <50MB APK
- [ ] App opens in <3 seconds
- [ ] Messaging latency <2 seconds
- [ ] Voice codec latency <3 seconds
- [ ] Memory stable (no leaks)

### Data Persistence
- [ ] Messages saved to SQLite
- [ ] Settings persist across restarts
- [ ] No data loss on app crash
- [ ] Conversations reconstruct properly

### User Experience
- [ ] Clear error messages
- [ ] Loading indicators
- [ ] No frozen UI
- [ ] Intuitive navigation
- [ ] Accessible buttons/text

---

## PART 8: REAL-WORLD SCENARIOS

### Scenario: Home Network with 3 Family Members
**Setup**: 3 phones, home WiFi
**Test**:
1. Alice, Bob, Charlie each launch app
2. All discover each other
3. Send group messages back and forth
4. One person leaves room (out of BLE range)
5. Can still message via WiFi relay

**Success**: All messages deliver, no crashes

---

### Scenario: Office Building Testing
**Setup**: 2 devices, different floors
**Test**:
1. Device A on floor 1
2. Device B on floor 2
3. Try to message (BLE won't work, WiFi P2P might)
4. If WiFi available, should connect
5. Messages may fail but app graceful

**Success**: App handles distance gracefully

---

### Scenario: Emergency Broadcast
**Setup**: 2+ devices
**Test**:
1. One device sends emergency broadcast
2. All nearby devices receive
3. Message marked as broadcast
4. No need to individually route

**Success**: Broadcast reaches all peers

---

## PART 9: MONITORING & ANALYTICS

### What to Track
```javascript
// Add to app for real-world testing
log({
  event: 'peer_discovered',
  peerId: 'xyz',
  distance: rssi,
  method: 'BLE' | 'WiFi'
});

log({
  event: 'message_sent',
  recipient: 'xyz',
  latency: ms,
  encrypted: true
});

log({
  event: 'voice_message',
  duration: seconds,
  codec: 'delta+vle',
  size: bytes
});
```

---

## PART 10: KNOWN LIMITATIONS & WORKAROUNDS

### Limitation 1: BLE Range
- **Issue**: Bluetooth range ~20-30 meters
- **Workaround**: WiFi P2P for longer range
- **Real-World**: In office/home, BLE usually sufficient

### Limitation 2: No Internet Fallback
- **Issue**: App requires local WiFi/BLE
- **Workaround**: Won't work offline with server
- **Real-World**: Design for mesh, not internet dependency

### Limitation 3: Battery Drain
- **Issue**: Continuous scanning drains battery
- **Workaround**: Implement scan throttling
- **Real-World**: Background refresh trade-off

### Limitation 4: Android Permissions
- **Issue**: Requires location permission for WiFi scanning
- **Workaround**: Explain in app why it's needed
- **Real-World**: Users may deny, graceful fallback

---

## PART 11: SUCCESS METRICS

### Phase 6 Real-World Success = 
- ✅ App launches on real device (2+ devices)
- ✅ Devices discover each other (BLE/WiFi)
- ✅ Messages send and deliver <2 sec
- ✅ Voice messages encode, send, and playback
- ✅ No crashes over 1-hour session
- ✅ Battery drain acceptable
- ✅ All errors handled gracefully

---

## DEPLOYMENT COMMANDS SUMMARY

```bash
# 1. Prepare
npm install -g eas-cli
eas login

# 2. Build for Android
cd artifacts/mobile
eas build --platform android --profile preview

# 3. Build for iOS
eas build --platform ios --profile preview

# 4. Install & Test
adb install app.apk  # Android
# or distribute via TestFlight  # iOS

# 5. Monitor
adb logcat | grep -i mesh
npx react-native-debugger  # Android DevTools
```

---

## NEXT STEPS

1. ✅ **Build**: `eas build --platform android/ios --profile preview`
2. ✅ **Deploy**: Install on 2+ real devices
3. ✅ **Test**: Follow scenarios 1-8 above
4. ✅ **Monitor**: Watch logs and performance
5. ✅ **Iterate**: Fix issues, rebuild, repeat
6. ✅ **Release**: Submit to App Store / Play Store

---

**Phase 6 Real-World Testing Complete When**:
- 2+ devices running stably
- Messaging works end-to-end
- No fatal crashes
- Voice features functional
- All logs clean

---

Generated: May 11, 2026
Real-World Testing Guide v1.0
