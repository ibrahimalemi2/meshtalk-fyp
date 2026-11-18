# Phase 6 Feature Testing Guide

## Quick Start
1. **Web**: Open http://localhost:3001/ in browser
2. **Mobile**: Scan QR code from Metro bundler terminal with Expo Go

---

## TESTING CHECKLIST

### ✅ FEATURE 1: VOICE RECORDING & PLAYBACK

#### Test on Mobile (Expo Go):
1. Go to **Conversations** tab → Select any peer or create chat
2. Look for **microphone button** at bottom of chat
3. **Press & Hold Microphone** (or tap it)
   - Should show VoiceRecorder overlay
   - Red pulsing indicator should appear
   - Waveform bars should animate
4. **Speak into phone** for 3-5 seconds
5. **Release/Tap Stop** button
   - Recording should stop
   - Duration should display (e.g., "3s")
6. **Tap Confirm** (checkmark button)
   - Voice message should appear in chat
   - Status: "sending" → "sent" → "delivered"
7. **Tap voice message** to playback
   - Play button should appear
   - Waveform should show playback progress
   - Audio should play back (if audio codec works)

**Expected Result**: ✅ Voice messages send and playback controls appear

---

### ✅ FEATURE 2: REAL PEER DISCOVERY

#### Test on Mobile (Expo Go):
1. Go to **Peers** tab
2. **Expected to see**:
   - Count of discovered peers
   - List of peers with:
     - Display name
     - Avatar (colored circle)
     - Status (online/offline)
     - Signal strength (0-100%)
     - Last seen time
3. **If BLE/WiFi unavailable** (Expo Go limitation):
   - Peer list empty but NO CRASH ✅
   - App continues working
   - Console shows: "Transport/native modules not available"

**Expected Result**: ✅ Peer list shows gracefully (empty in Expo Go is OK)

---

### ✅ FEATURE 3: TEXT MESSAGE SENDING

#### Test on Mobile:
1. Go to **Conversations** → Select peer
2. Type message in input field
3. **Tap Send button**
4. **Check message status**:
   - Appears immediately (optimistic update)
   - Status changes: "sending" → "sent" → "delivered"
   - Timestamp displays correctly

#### Test on Web (http://localhost:3001/):
1. Open conversations view
2. Click on peer
3. Type message
4. Click send
5. Verify message appears with timestamp

**Expected Result**: ✅ Messages send and status updates correctly

---

### ✅ FEATURE 4: PROTOCOL ENGINE INITIALIZATION

#### Check Console Logs (DevTools):
1. **Mobile**: Press `Ctrl+M` in Expo Go → select "Debug remote JS"
2. **Web**: Open DevTools (F12) → Console tab
3. **Look for logs**:
   ```
   [MeshProvider] Initializing protocol
   [ProtocolEngine] Initialized
   [Modules] All protocol layers loaded
   ```

**For Expo Go (Native Module Handling)**:
```
[MeshProvider] Transport/native modules not available (Expo Go limitation)
[BLEScanner] BLE not available (Expo Go limitation)
[WiFiP2P] WiFi P2P not available, skipping discovery
```

**Expected Result**: ✅ App initializes without crashes

---

### ✅ FEATURE 5: MESSAGE BUBBLE UPDATES

#### Test Voice Message Bubble:
1. Send voice message (as in Feature 1)
2. **Check message bubble**:
   - Shows waveform visualization ✅
   - Displays duration (e.g., "3s") ✅
   - Has play button (▶️) ✅
   - Can be tapped to play ✅

#### Test Text Message Bubble:
1. Send text message
2. **Check bubble displays**:
   - Text content ✅
   - Delivery status icon ✅
   - Timestamp ✅
   - Your avatar (left/right based on sender) ✅

**Expected Result**: ✅ Both text and voice bubbles display correctly

---

### ✅ FEATURE 6: UI/UX IMPROVEMENTS

#### Test Loading State:
1. When app starts, look for loading indicator
2. Should show: "Initializing protocol..."
3. After ~2-3 seconds, should transition to main UI

#### Test Real-Time Updates:
1. Go to **Peers** tab
2. If peer comes online/offline:
   - Status should update automatically
   - Last seen time should refresh

#### Test Voice Recorder UI:
1. Tap microphone button
2. **Check UI elements**:
   - Pulsing red recording indicator ✅
   - Animated waveform bars ✅
   - Cancel button (❌) ✅
   - Confirm button (✓) ✅
   - Duration display ✅

**Expected Result**: ✅ All UI elements render and respond to input

---

## TESTING MATRIX

| Feature | Web | Mobile (Expo Go) | Expected Status |
|---------|-----|------------------|-----------------|
| Text Messages | ✅ | ✅ | Send & display |
| Voice Recording | ❌ | ✅ | Mic button appears |
| Voice Playback | ❌ | ✅ | Play button works |
| Peer Discovery | ✅ Mock | ⚠️ Empty (graceful) | No crash |
| Message Status | ✅ | ✅ | Updates correctly |
| Protocol Init | ✅ | ✅ | Loads gracefully |
| BLE Scanning | ❌ | ⚠️ Fails gracefully | Logs warning |
| WiFi P2P | ❌ | ⚠️ Fails gracefully | Logs warning |

---

## TROUBLESHOOTING

### Problem: App crashes on startup
**Solution**: Check console for errors, verify graceful error handling is in place
```
Look for: [MeshProvider] Failed to initialize protocol: [error details]
Should NOT crash the app
```

### Problem: Voice message button doesn't appear
**Solution**: 
- Make sure you're on chat screen
- Not available on Web (mobile-only feature)
- Check if expo-av imported correctly

### Problem: Peer list empty on mobile
**Solution**: This is EXPECTED in Expo Go
- Native BLE/WiFi modules not available
- Use EAS/Development Build for full features
- App should show graceful "No peers" state

### Problem: Messages not sending
**Solution**:
- Check if peer exists in list
- Verify mock peer has displayName
- Check console for encryption errors

---

## FEATURE VERIFICATION CHECKLIST

### Mobile Testing (Expo Go):
- [ ] App loads without crashing
- [ ] Chat screen displays
- [ ] Voice recorder button appears
- [ ] Can record voice message
- [ ] Voice message sends
- [ ] Message status updates (sending → sent → delivered)
- [ ] Peer list displays (even if empty)
- [ ] No native module crashes (fails gracefully)

### Web Testing (localhost:3001):
- [ ] App loads
- [ ] Conversations visible
- [ ] Can send text messages
- [ ] Message status displays
- [ ] Mock peers show in list
- [ ] UI responsive

### Console Logging:
- [ ] No uncaught errors
- [ ] Graceful warnings for unavailable modules
- [ ] Protocol initialization logs visible
- [ ] No "cannot find module" errors for Phase 6 code

---

## SUCCESS CRITERIA

✅ **PASS IF**:
1. App loads without crashes on both platforms
2. Messages send and display correctly
3. Voice recording UI appears on mobile
4. Peer list shows (with real discovery or gracefully empty)
5. Console has proper error handling (no fatal crashes)
6. Protocol initialization completes

❌ **FAIL IF**:
1. App crashes on startup
2. Native module errors cause white screen
3. Messages don't send
4. Peer discovery crashes the app
5. Console shows uncaught exceptions

---

## NEXT STEPS FOR FULL TESTING

### For Full Native Features (Android/iOS):
```bash
# Create EAS development build instead of Expo Go
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

### For Peer Discovery Testing:
- Build and deploy on 2+ devices
- Same WiFi network
- BLE should discover peers automatically
- Watch console for peer discovery events

---

## FEATURE VALIDATION SUMMARY

| Phase 6 Component | Status | Test Method | Expected Output |
|------------------|--------|-------------|-----------------|
| VoiceRecorder UI | ✅ | Tap mic button | Overlay appears |
| Voice Encoding | ✅/⚠️ | Send voice msg | Compresses audio |
| Voice Playback | ✅/⚠️ | Tap voice msg | Play controls show |
| MessageBubble Voice | ✅ | Send voice | Waveform displays |
| ProtocolEngine Init | ✅ | App startup | Logs completion |
| Peer Discovery | ⚠️ | Go to Peers | Empty/Graceful fail |
| Real-time Peer List | ⚠️ | Native only | Mock data on web |
| Error Handling | ✅ | Check logs | Graceful failures |

Legend:
- ✅ Fully functional
- ⚠️ Limited (Expo Go) / Requires native modules
- ❌ Not available on platform

---

Generated: May 11, 2026
Last Updated: Phase 6 Testing Guide v1.0
