/**
 * BLE Scanning Module - Bluetooth Low Energy discovery
 * Part of Phase 1: Transport Layer
 * 
 * Scans for nearby BLE devices broadcasting mesh service UUID
 * Filters by signal strength (RSSI) and extracts peer information
 */

import { BleManager, Device } from 'react-native-ble-plx';
import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

const MESH_SERVICE_UUID = '550e8400-e29b-41d4-a716-446655440000'; // Standard mesh service
const PEER_INFO_CHARACTERISTIC_UUID = '550e8400-e29b-41d4-a716-446655440001'; // Broadcasts peer data
const RSSI_THRESHOLD = -70; // Only accept peers with decent signal (closer than ~20m)
const SCAN_TIMEOUT_MS = 30000; // Scan for 30 seconds

interface BLEPeerInfo {
  publicKey: string;
  displayName: string;
  batteryLevel: number;
  signalStrength: number; // RSSI in dBm
}

interface BLEDiscoveryListener {
  onPeerFound: (peer: BLEPeerInfo) => void;
  onPeerLost: (publicKey: string) => void;
  onError: (error: Error) => void;
}

export class BLEScanner {
  private bleManager: BleManager | null = null;
  private discoveredDevices: Map<string, { device: Device; rssi: number; lastSeen: number }> = new Map();
  private listeners: Set<BLEDiscoveryListener> = new Set();
  private isScanning = false;
  private scanTimeoutHandle: NodeJS.Timeout | null = null;
  private staleDeviceCheckInterval: NodeJS.Timeout | null = null;
  private isAvailable = false;

  constructor() {
    try {
      this.bleManager = new BleManager();
      this.isAvailable = true;
    } catch (err) {
      console.warn('[BLEScanner] BLE not available (Expo Go limitation):', err);
      this.isAvailable = false;
    }
  }

  /**
   * Request required permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true; // iOS handles permissions differently

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const allGranted = Object.values(granted).every(
        perm => perm === PermissionsAndroid.RESULTS.GRANTED
      );

      console.log('[BLEScanner] Permissions:', allGranted ? 'granted' : 'denied');
      return allGranted;
    } catch (err) {
      console.error('[BLEScanner] Permission request failed:', err);
      return false;
    }
  }

  /**
   * Start scanning for BLE peers
   */
  async startScanning(): Promise<void> {
    if (!this.isAvailable) {
      console.warn('[BLEScanner] BLE not available, skipping scan');
      return;
    }

    if (this.isScanning) {
      console.log('[BLEScanner] Already scanning');
      return;
    }

    // Request permissions first
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('BLE permissions not granted');
    }

    try {
      // Enable Bluetooth
      if (!this.bleManager) return;
      
      await this.bleManager.enable().catch(() => {
        // Already enabled or not available, continue anyway
      });

      this.isScanning = true;
      console.log('[BLEScanner] Started scanning for mesh peers');

      // Start scan
      this.bleManager.startDeviceScan(
        [MESH_SERVICE_UUID], // Filter by service
        {
          allowDuplicates: true, // Continuous updates
          legacyAdvertisingMode: false, // Use extended advertising
        },
        (error, device) => {
          if (error) {
            console.error('[BLEScanner] Scan error:', error);
            this._notifyError(error);
            return;
          }

          if (device && device.rssi && device.rssi < RSSI_THRESHOLD) {
            this._processDiscoveredDevice(device);
          }
        }
      );

      // Set scan timeout
      this.scanTimeoutHandle = setTimeout(() => {
        this.stopScanning();
      }, SCAN_TIMEOUT_MS);

      // Start stale device cleanup
      this.staleDeviceCheckInterval = setInterval(() => {
        this._removeStaleDevices();
      }, 10000); // Check every 10 seconds
    } catch (err) {
      this.isScanning = false;
      throw err;
    }
  }

  /**
   * Stop scanning
   */
  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;

    this.isScanning = false;

    if (this.scanTimeoutHandle) {
      clearTimeout(this.scanTimeoutHandle);
      this.scanTimeoutHandle = null;
    }

    if (this.staleDeviceCheckInterval) {
      clearInterval(this.staleDeviceCheckInterval);
      this.staleDeviceCheckInterval = null;
    }

    try {
      await this.bleManager.stopDeviceScan();
      console.log('[BLEScanner] Stopped scanning');
    } catch (err) {
      console.error('[BLEScanner] Error stopping scan:', err);
    }
  }

  /**
   * Register listener for peer discovery events
   */
  addListener(listener: BLEDiscoveryListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Process discovered BLE device
   */
  private async _processDiscoveredDevice(device: Device): Promise<void> {
    try {
      // Extract peer info from advertisement data
      const peerInfo = await this._parseBLEAdvertisement(device);
      if (!peerInfo) return;

      const existing = this.discoveredDevices.get(peerInfo.publicKey);

      // Update or create entry
      this.discoveredDevices.set(peerInfo.publicKey, {
        device,
        rssi: device.rssi || 0,
        lastSeen: Date.now(),
      });

      // Notify only on first discovery or if RSSI changed significantly (>5 dBm)
      if (
        !existing ||
        Math.abs((existing.rssi || 0) - (device.rssi || 0)) > 5
      ) {
        console.log(
          `[BLEScanner] Peer discovered: ${peerInfo.displayName} (${peerInfo.publicKey.substring(0, 8)}) - Signal: ${device.rssi}dBm`
        );
        this._notifyPeerFound(peerInfo);
      }
    } catch (err) {
      console.error('[BLEScanner] Error processing device:', err);
    }
  }

  /**
   * Parse peer information from BLE advertisement
   */
  private async _parseBLEAdvertisement(device: Device): Promise<BLEPeerInfo | null> {
    try {
      // Try to read manufacturer data first
      if (device.manufacturerData) {
        const parsed = this._parseManufacturerData(device.manufacturerData);
        if (parsed) return parsed;
      }

      // Fallback: use device properties
      return {
        publicKey: device.id, // Use BLE MAC as temporary ID
        displayName: device.name || 'Unknown Peer',
        batteryLevel: 50, // Default, would be parsed from advertisement
        signalStrength: device.rssi || 0,
      };
    } catch (err) {
      console.error('[BLEScanner] Parse error:', err);
      return null;
    }
  }

  /**
   * Parse manufacturer-specific data
   * Format: [publicKey: 32 bytes][displayName: utf8][batteryLevel: 1 byte]
   */
  private _parseManufacturerData(base64Data: string): BLEPeerInfo | null {
    try {
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length < 33) {
        // Minimum: 32 bytes public key + 1 byte battery
        return null;
      }

      const publicKey = buffer.slice(0, 32).toString('hex');
      const batteryLevel = buffer[32];
      const displayName = buffer.slice(33).toString('utf-8').split('\0')[0]; // Null-terminated

      return {
        publicKey,
        displayName: displayName || 'Mesh Peer',
        batteryLevel,
        signalStrength: 0, // Set by caller
      };
    } catch {
      return null;
    }
  }

  /**
   * Remove devices not seen in 30 seconds
   */
  private _removeStaleDevices(): void {
    const now = Date.now();
    const threshold = 30000; // 30 seconds

    for (const [key, data] of this.discoveredDevices) {
      if (now - data.lastSeen > threshold) {
        this.discoveredDevices.delete(key);
        console.log(`[BLEScanner] Peer lost (timeout): ${key.substring(0, 8)}`);
        this._notifyPeerLost(key);
      }
    }
  }

  /**
   * Get currently discovered peers
   */
  getDiscoveredPeers(): BLEPeerInfo[] {
    return Array.from(this.discoveredDevices.values()).map(entry => ({
      publicKey: entry.device.id,
      displayName: entry.device.name || 'Unknown',
      batteryLevel: 50,
      signalStrength: entry.rssi,
    }));
  }

  // Event notification
  private _notifyPeerFound(peer: BLEPeerInfo): void {
    this.listeners.forEach(listener => {
      try {
        listener.onPeerFound(peer);
      } catch (err) {
        console.error('[BLEScanner] Listener error:', err);
      }
    });
  }

  private _notifyPeerLost(publicKey: string): void {
    this.listeners.forEach(listener => {
      try {
        listener.onPeerLost(publicKey);
      } catch (err) {
        console.error('[BLEScanner] Listener error:', err);
      }
    });
  }

  private _notifyError(error: Error): void {
    this.listeners.forEach(listener => {
      try {
        listener.onError(error);
      } catch (err) {
        console.error('[BLEScanner] Listener error:', err);
      }
    });
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    await this.stopScanning();
    try {
      await this.bleManager.destroy();
    } catch (err) {
      console.error('[BLEScanner] Destroy error:', err);
    }
  }
}

// Export singleton (only on native platforms)
export const bleScanner = Platform.OS !== 'web' ? new BLEScanner() : null;
