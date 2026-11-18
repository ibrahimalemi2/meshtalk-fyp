/**
 * Module Index - Public API Gateway
 * All module imports happen through this single point
 * Ensures no cross-module dependencies
 */

import { Platform } from 'react-native';

export { storage, type StorageAPI } from './storage/index';
export { crypto, type CryptoAPI, type KeyPair, type DoubleRatchetSession, type EncryptedMessage } from './crypto/index';
export { transport, type TransportAPI, type DiscoveredPeer } from './transport/index';
export { routing, type RoutingAPI, type RouteEntry, type RoutingEnvelope } from './routing/index';
export { audio, type AudioAPI, type AudioChunk } from './audio/index';
export { ProtocolEngine } from './ProtocolEngine';

console.log(`[Modules] All protocol layers loaded (${Platform.OS} platform)`);
