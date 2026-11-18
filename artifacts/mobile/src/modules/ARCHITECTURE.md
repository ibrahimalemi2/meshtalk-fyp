# Modular Protocol Architecture

## Overview

This modular architecture decouples all major concerns of the mesh networking protocol into independent, testable layers. **Each module can be swapped, extended, or tested in isolation without affecting others.**

## Core Design Principle

> "If I want to change anything, it doesn't affect another"

**Implementation Strategy:**
- Each module has a **public API** (`index.ts`) with TypeScript interfaces
- Internal implementation details are hidden (e.g., `schema.ts`, actual encryption logic)
- Modules communicate ONLY through their public APIs
- No module imports from another module's private implementation
- All state is isolated within each module

## Module Structure

```
src/modules/
├── storage/              # Phase 4: SQLite persistence
│   ├── index.ts          # StorageAPI interface (PUBLIC)
│   └── schema.ts         # Drizzle ORM tables (PRIVATE)
│
├── crypto/               # Phase 3: E2EE & identity
│   ├── index.ts          # CryptoAPI interface (PUBLIC)
│   ├── keypair.ts        # Ed25519 generation (PRIVATE)
│   └── doubleRatchet.ts  # Ratchet algorithm (PRIVATE - NOT YET CREATED)
│
├── transport/            # Phase 1: Hardware discovery & transmission
│   ├── index.ts          # TransportAPI interface (PUBLIC)
│   ├── ble.ts            # BLE scanning (PRIVATE - NOT YET CREATED)
│   └── wifiDirect.ts     # Wi-Fi P2P (PRIVATE - NOT YET CREATED)
│
├── routing/              # Phase 2: Multi-hop relay & forwarding
│   ├── index.ts          # RoutingAPI interface (PUBLIC)
│   ├── routingTable.ts   # Distance vector (PRIVATE - NOT YET CREATED)
│   └── forwarder.ts      # TTL-based forwarding (PRIVATE - NOT YET CREATED)
│
├── audio/                # Phase 5: Opus codec & chunking
│   ├── index.ts          # AudioAPI interface (PUBLIC)
│   ├── recorder.ts       # Audio capture (PRIVATE - NOT YET CREATED)
│   └── chunks.ts         # Fragment reassembly (PRIVATE - NOT YET CREATED)
│
├── index.ts              # Module gateway exports
├── ProtocolEngine.ts     # Orchestrator (coordinates WITHOUT direct dependencies)
└── ARCHITECTURE.md       # This file
```

## Module APIs

### Storage (`storage/index.ts`)
**Phase 4 implementation** - Persistence layer

```typescript
interface StorageAPI {
  // Users
  saveUser(id, name, color): Promise<void>
  getUser(id): Promise<any>
  updateUserStatus(id, isOnline): Promise<void>
  
  // Messages (TTL-based expiration)
  saveMessage(message): Promise<void>
  getMessages(conversationId, limit): Promise<any[]>
  markMessageAsDelivered(id): Promise<void>
  deleteExpiredMessages(): Promise<number>
  
  // Groups
  createGroup(name, creatorId): Promise<string>
  addMemberToGroup(groupId, userId): Promise<void>
  
  // Routing
  updateRoute(dest, nextHop, cost): Promise<void>
  getRoute(dest): Promise<RouteEntry | null>
  getAllRoutes(): Promise<RouteEntry[]>
  
  // Sessions (E2EE state)
  saveSession(id, data): Promise<void>
  getSession(id): Promise<any>
  saveSkippedMessage(sessionId, chainKey, msgKey, number): Promise<void>
}
```

**Can be replaced with:**
- PostgreSQL (production)
- Realm (if SQLite doesn't work)
- IndexedDB (if web-only)
- Without touching other modules

---

### Crypto (`crypto/index.ts`)
**Phase 3 implementation** - Encryption & identity

```typescript
interface CryptoAPI {
  // Identity (Ed25519)
  generateIdentity(): Promise<KeyPair>
  getLocalIdentity(): Promise<KeyPair | null>
  saveIdentity(keypair): Promise<void>
  
  // Sessions (Double Ratchet E2EE)
  initializeSession(remotePubKey, initialRootKey?): Promise<DoubleRatchetSession>
  getSession(remotePubKey): Promise<DoubleRatchetSession | null>
  
  // Encryption
  encrypt(remotePubKey, plaintext): Promise<EncryptedMessage>
  decrypt(remotePubKey, encrypted): Promise<string>
  
  // Signing (emergency broadcasts)
  sign(message): Promise<string>
  verify(message, signature, publicKey): Promise<boolean>
}
```

**Can be replaced with:**
- Different identity schemes (secp256k1, RSA)
- Signal protocol instead of Double Ratchet
- Hardware security module (HSM) for key storage
- Without touching other modules

---

### Transport (`transport/index.ts`)
**Phase 1 implementation** - Hardware discovery & transmission

```typescript
interface TransportAPI {
  // Lifecycle
  start(): Promise<void>
  stop(): Promise<void>
  
  // Peer discovery (event-driven)
  onPeerDiscovered(callback): { remove: () => void }
  onPeerLost(callback): { remove: () => void }
  
  // Packet transmission
  sendPacket(recipientPubKey, payload): Promise<void>
  onPacketReceived(callback): { remove: () => void }
  
  // Relay election
  electRelayCandidate(): Promise<DiscoveredPeer | null>
  getLocalMetrics(): Promise<{ battery, uptime, isRelay }>
}
```

**Can be replaced with:**
- LoRa instead of BLE (long-range)
- Mesh WiFi instead of Wi-Fi Direct
- Cellular as fallback
- Without touching other modules

---

### Routing (`routing/index.ts`)
**Phase 2 implementation** - Multi-hop relay & forwarding

```typescript
interface RoutingAPI {
  // Route management
  updateRoute(dest, nextHop, cost, seqNum): Promise<void>
  getRoute(dest): Promise<RouteEntry | null>
  getAllReachableDestinations(): Promise<string[]>
  
  // Forwarding logic
  shouldForward(envelope, myPubKey): Promise<boolean>
  forward(envelope): Promise<void>
  recordReceivedMessage(messageId): void
  
  // Gossip protocol
  broadcastRoutingTable(): Promise<void>
  onRoutingUpdate(callback): { remove: () => void }
}
```

**Can be replaced with:**
- AODV instead of distance vector
- Babel mesh routing protocol
- Geographic routing (GPS)
- Without touching other modules

---

### Audio (`audio/index.ts`)
**Phase 5 implementation** - Opus codec & transmission

```typescript
interface AudioAPI {
  // Recording
  startRecording(): Promise<string>
  stopRecording(sessionId): Promise<Uint8Array>
  
  // Playback
  startPlayback(audioData): Promise<void>
  stopPlayback(): Promise<void>
  
  // Chunking
  chunkAudio(audioData, maxChunkSize?): Promise<AudioChunk[]>
  reassembleAudio(chunks): Promise<Uint8Array>
  
  // Events
  onAudioChunkReceived(callback): { remove: () => void }
}
```

**Can be replaced with:**
- Different codec (MP3, AAC)
- Variable bitrate encoding
- Real-time streaming instead of file-based
- Without touching other modules

---

## ProtocolEngine: Orchestration Without Coupling

The `ProtocolEngine` class coordinates all modules **without importing each other's internals**:

```typescript
class ProtocolEngine {
  async init() {
    await storage.init()                    // Startup Storage
    await crypto.getLocalIdentity()         // Load identity
    await transport.start()                 // Start discovery
    
    // Register listeners - each module is independent
    transport.onPeerDiscovered(peer => {
      storage.saveUser(...)                 // Storage handles persistence
      crypto.initializeSession(...)         // Crypto handles E2EE setup
      routing.updateRoute(...)              // Routing handles path discovery
    })
    
    transport.onPacketReceived((sender, payload) => {
      // Complex orchestration, but each module is still independent
      const encrypted = JSON.parse(...)
      const plaintext = await crypto.decrypt(...)  // Crypto handles decryption
      await storage.saveMessage(...)        // Storage handles persistence
      // etc.
    })
  }
  
  async sendMessage(recipientPubKey, plaintext) {
    const encrypted = await crypto.encrypt(...)     // Ask crypto module
    await storage.saveMessage(...)                  // Ask storage module
    const route = await routing.getRoute(...)       // Ask routing module
    await transport.sendPacket(nextHop, ...)        // Ask transport module
    // Each module works independently
  }
}
```

**Benefits:**
- Protocol logic in one place (ProtocolEngine)
- But implementation details isolated per module
- Can swap any module's implementation without touching the others
- Easy to test each module independently

## Testing Strategy

Each module can be tested independently:

```typescript
// Test storage module WITHOUT crypto
import { storage } from '@/modules/storage'
await storage.init()
await storage.saveUser('abc123', 'Alice', 'blue')
const user = await storage.getUser('abc123')
expect(user.displayName).toBe('Alice')

// Test crypto module WITHOUT storage or transport
import { crypto } from '@/modules/crypto'
const identity = await crypto.generateIdentity()
const encrypted = await crypto.encrypt(identity.publicKey, 'hello')
const decrypted = await crypto.decrypt(identity.publicKey, encrypted)
expect(decrypted).toBe('hello')

// Test routing WITHOUT transport or crypto
import { routing } from '@/modules/routing'
await routing.updateRoute('dest-123', 'hop-456', 2, 1)
const route = await routing.getRoute('dest-123')
expect(route?.nextHopPubKey).toBe('hop-456')
```

## Implementation Roadmap

### ✅ Done
- Module structure created
- Public API interfaces defined
- Storage schema (Drizzle ORM)
- ProtocolEngine orchestrator
- Index.ts gateway

### 🔄 Phase 1: Transport (BLE & Wi-Fi Direct)
- [ ] `transport/ble.ts` - BLE Central scanning
- [ ] `transport/wifiDirect.ts` - Wi-Fi P2P discovery
- [ ] Integration with react-native-ble-plx

### 🔄 Phase 2: Routing (Distance Vector)
- [ ] `routing/routingTable.ts` - Distance vector implementation
- [ ] `routing/forwarder.ts` - TTL-based message forwarding
- [ ] Gossip protocol broadcast

### 🔄 Phase 3: Crypto (Ed25519 & Double Ratchet)
- [ ] `crypto/keypair.ts` - Ed25519 generation
- [ ] `crypto/doubleRatchet.ts` - Double Ratchet algorithm
- [ ] Integration with @noble/ed25519, double-ratchet-ts

### 🔄 Phase 4: Storage (SQLite Integration)
- [ ] Drizzle ORM implementation
- [ ] DB schema creation in storage/operations.ts
- [ ] Migration system

### 🔄 Phase 5: Audio (Opus Codec)
- [ ] `audio/recorder.ts` - Audio capture with Opus encoding
- [ ] `audio/chunks.ts` - Fragment reassembly algorithm
- [ ] Integration with expo-audio

### 🔄 Phase 6: UI Bridge
- [ ] Update MeshContext.tsx to use ProtocolEngine
- [ ] Replace mock data with real module APIs
- [ ] UI components for peer list, messaging, voice calls

## Import Rules (CRITICAL)

```typescript
// ✅ GOOD - Import from public APIs
import { storage } from '@/modules'
import { crypto } from '@/modules'
import { ProtocolEngine } from '@/modules'

// ❌ WRONG - Never import private implementation
import { doubleRatchet } from '@/modules/crypto/doubleRatchet'  // FORBIDDEN
import { ble } from '@/modules/transport/ble'                  // FORBIDDEN
import { routingTable } from '@/modules/routing/routingTable'  // FORBIDDEN

// ❌ WRONG - Never cross-module dependencies
// In crypto module
import { storage } from '@/modules/storage'  // FORBIDDEN - creates coupling

// ✅ GOOD - Use ProtocolEngine for coordination
import { ProtocolEngine } from '@/modules'
const engine = new ProtocolEngine(config)
await engine.init()  // Engine coordinates all modules
```

## Deployment Flexibility

This architecture enables:

| Scenario | Change Required | Modules Affected |
|----------|-----------------|-----------------|
| Switch from BLE to LoRa | Replace `transport/` impl | Only transport |
| Add encryption algorithm | Replace `crypto/doubleRatchet.ts` | Only crypto |
| Change database to PostgreSQL | Replace `storage/` impl | Only storage |
| Use different routing protocol | Replace `routing/routingTable.ts` | Only routing |
| Add image compression | Add `audio/image.ts` | Only audio |
| Swap Ed25519 for secp256k1 | Replace `crypto/keypair.ts` | Only crypto |

**Zero impact on other layers.**

## Next Steps

1. Implement Phase 1: Transport (BLE/Wi-Fi Direct)
2. Implement Phase 2: Routing (Distance Vector)
3. Implement Phase 3: Crypto (Ed25519 + Double Ratchet)
4. Implement Phase 4: Storage (SQLite integration)
5. Implement Phase 5: Audio (Opus codec)
6. Update Phase 6: MeshContext.tsx to use ProtocolEngine
