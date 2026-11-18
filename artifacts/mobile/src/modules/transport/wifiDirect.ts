/**
 * Wi-Fi P2P Module - Direct connection discovery
 * Part of Phase 1: Transport Layer
 * 
 * Discovers nearby devices via Wi-Fi P2P (Android) or Multipeer Connectivity (iOS)
 * Allows direct socket communication without router infrastructure
 */

import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const MESH_SERVICE_TYPE = '_meshtalk._tcp'; // mDNS service type
const DISCOVERY_TIMEOUT_MS = 30000;

interface WiFiPeerInfo {
  publicKey: string;
  displayName: string;
  ipAddress: string;
  port: number;
  isRelay: boolean;
}

interface WiFiDiscoveryListener {
  onPeerFound: (peer: WiFiPeerInfo) => void;
  onPeerLost: (publicKey: string) => void;
  onError: (error: Error) => void;
}

export class WiFiP2PDiscovery {
  private RNWiFiP2P = NativeModules.RNWiFiP2P || NativeModules.ReactNativeWiFiP2P;
  private isDiscovering = false;
  private discoveredPeers: Map<string, WiFiPeerInfo> = new Map();
  private listeners: Set<WiFiDiscoveryListener> = new Set();
  private discoveryTimeoutHandle: NodeJS.Timeout | null = null;
  private staleDeviceCheckInterval: NodeJS.Timeout | null = null;
  private isAvailable = false;

  constructor() {
    if (Platform.OS === 'android' && this.RNWiFiP2P) {
      this.isAvailable = true;
      try {
        const eventEmitter = new NativeEventEmitter(this.RNWiFiP2P);

        // Register for peer discovery events
        eventEmitter.addListener('onPeersUpdated', (peers) => {
          console.log('[WiFiP2P] Peers updated:', peers?.length || 0);
          peers?.forEach((peer: any) => this._processPeer(peer));
        });

        eventEmitter.addListener('onConnectionInfoUpdated', (info) => {
          console.log('[WiFiP2P] Connection info updated:', info);
        });

        eventEmitter.addListener('onThisDeviceChanged', (device) => {
          console.log('[WiFiP2P] This device changed:', device);
        });
      } catch (err) {
        console.warn('[WiFiP2P] Failed to initialize native module:', err);
        this.isAvailable = false;
      }
    }
  }

  /**
   * Start Wi-Fi P2P discovery
   */
  async startDiscovery(): Promise<void> {
    if (!this.isAvailable) {
      console.warn('[WiFiP2P] WiFi P2P not available, skipping discovery');
      return;
    }

    if (this.isDiscovering) {
      console.log('[WiFiP2P] Already discovering');
      return;
    }

    try {
      if (Platform.OS === 'android' && this.RNWiFiP2P) {
        // Android: Use native Wi-Fi P2P module
        this.isDiscovering = true;
        console.log('[WiFiP2P] Started discovery');

        // Initialize Wi-Fi P2P
        await this.RNWiFiP2P.discoverPeers();

        // Set discovery timeout
        this.discoveryTimeoutHandle = setTimeout(() => {
          this.stopDiscovery();
        }, DISCOVERY_TIMEOUT_MS);

        // Periodic peer list refresh
        this.staleDeviceCheckInterval = setInterval(async () => {
          try {
            const peers = await this.RNWiFiP2P.requestPeers();
            console.log('[WiFiP2P] Peers list:', peers?.length || 0);
          } catch (err) {
            console.error('[WiFiP2P] Peer list error:', err);
          }
        }, 5000);
      } else if (Platform.OS === 'ios') {
        // iOS: Use Multipeer Connectivity framework (via native module)
        console.log('[WiFiP2P] iOS Multipeer Connectivity (stub)');
        this.isDiscovering = true;
      } else {
        throw new Error('Wi-Fi P2P not supported on this platform');
      }
    } catch (err) {
      this.isDiscovering = false;
      this._notifyError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Stop discovery
   */
  async stopDiscovery(): Promise<void> {
    if (!this.isDiscovering) return;

    this.isDiscovering = false;

    if (this.discoveryTimeoutHandle) {
      clearTimeout(this.discoveryTimeoutHandle);
      this.discoveryTimeoutHandle = null;
    }

    if (this.staleDeviceCheckInterval) {
      clearInterval(this.staleDeviceCheckInterval);
      this.staleDeviceCheckInterval = null;
    }

    try {
      if (Platform.OS === 'android' && this.RNWiFiP2P) {
        await this.RNWiFiP2P.stopPeerDiscovery();
      }
      console.log('[WiFiP2P] Stopped discovery');
    } catch (err) {
      console.error('[WiFiP2P] Error stopping discovery:', err);
    }
  }

  /**
   * Connect to a specific peer
   */
  async connectToPeer(peerId: string): Promise<string> {
    try {
      if (Platform.OS === 'android' && this.RNWiFiP2P) {
        const result = await this.RNWiFiP2P.connect(peerId);
        console.log('[WiFiP2P] Connected to', peerId, ':', result);
        return result?.ipAddress || '';
      }
      return '';
    } catch (err) {
      console.error('[WiFiP2P] Connection error:', err);
      throw err;
    }
  }

  /**
   * Register listener for peer discovery
   */
  addListener(listener: WiFiDiscoveryListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Process discovered Wi-Fi peer
   */
  private _processPeer(device: any): void {
    try {
      const peerInfo: WiFiPeerInfo = {
        publicKey: device.deviceAddress || device.primaryDeviceType || 'unknown',
        displayName: device.deviceName || 'Wi-Fi Peer',
        ipAddress: device.ipAddress || '0.0.0.0',
        port: 9999, // Default mesh port
        isRelay: device.isGroupOwner === true,
      };

      const existing = this.discoveredPeers.get(peerInfo.publicKey);

      this.discoveredPeers.set(peerInfo.publicKey, peerInfo);

      if (!existing) {
        console.log(
          `[WiFiP2P] Peer discovered: ${peerInfo.displayName} (${peerInfo.publicKey}) at ${peerInfo.ipAddress}`
        );
        this._notifyPeerFound(peerInfo);
      }
    } catch (err) {
      console.error('[WiFiP2P] Peer processing error:', err);
    }
  }

  /**
   * Get currently discovered peers
   */
  getDiscoveredPeers(): WiFiPeerInfo[] {
    return Array.from(this.discoveredPeers.values());
  }

  // Event notification
  private _notifyPeerFound(peer: WiFiPeerInfo): void {
    this.listeners.forEach(listener => {
      try {
        listener.onPeerFound(peer);
      } catch (err) {
        console.error('[WiFiP2P] Listener error:', err);
      }
    });
  }

  private _notifyPeerLost(publicKey: string): void {
    this.listeners.forEach(listener => {
      try {
        listener.onPeerLost(publicKey);
      } catch (err) {
        console.error('[WiFiP2P] Listener error:', err);
      }
    });
  }

  private _notifyError(error: Error): void {
    this.listeners.forEach(listener => {
      try {
        listener.onError(error);
      } catch (err) {
        console.error('[WiFiP2P] Listener error:', err);
      }
    });
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    await this.stopDiscovery();
  }
}

// Export singleton (only on Android)
export const wifiP2P = Platform.OS === 'android' ? new WiFiP2PDiscovery() : null;
