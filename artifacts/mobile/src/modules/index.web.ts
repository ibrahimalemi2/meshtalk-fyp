/**
 * Module Index - Public API Gateway (Web Platform)
 * Web-specific version that skips storage (expo-sqlite incompatible)
 */

import { Platform } from 'react-native';

export { storage, type StorageAPI } from './storage/index';

export { crypto, type CryptoAPI, type KeyPair, type DoubleRatchetSession, type EncryptedMessage } from './crypto/index';
export { transport, type TransportAPI, type DiscoveredPeer } from './transport/index';
export { routing, type RoutingAPI, type RouteEntry, type RoutingEnvelope } from './routing/index';
export { audio, type AudioAPI, type AudioChunk } from './audio/index';
export { ProtocolEngine } from './ProtocolEngine';

console.log('[Modules] Protocol layers loaded (web version)');
