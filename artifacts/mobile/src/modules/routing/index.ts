/**
 * Routing Module - Public API
 * Multi-hop distance vector routing implementation
 * 
 * Phase 2 Implementation: Full Bellman-Ford algorithm
 * - Each node maintains distance vector to all destinations
 * - Periodic gossip protocol broadcasts routing table
 * - Handles topology changes and link failures
 * - Prevents loops via sequence numbers and TTL
 */

import { RoutingTable } from './routingTable';
import { forwarder, type ForwardedPacket } from './forwarder';

interface RouteEntry {
  destinationPubKey: string;
  nextHopPubKey: string;
  cost: number;
  sequenceNumber: number;
  lastUpdated: number;
}

interface RoutingEnvelope {
  senderPubKey: string;
  recipientPubKey: string;
  messageId: string;
  payload: string; // Base64 encrypted
  ttl: number;
  hops: number;
}

interface RoutingAPI {
  // Initialization
  init: (localPublicKey: string) => Promise<void>;
  stop: () => Promise<void>;

  // Route management
  updateRoute: (destination: string, nextHop: string, cost: number, seqNum: number) => Promise<void>;
  getRoute: (destination: string) => Promise<RouteEntry | null>;
  getAllReachableDestinations: () => Promise<string[]>;

  // Neighbor management (called by Transport)
  addDirectNeighbor: (publicKey: string, displayName: string) => void;
  removeDirectNeighbor: (publicKey: string) => void;

  // Forwarding
  shouldForward: (envelope: RoutingEnvelope, myPublicKey: string) => Promise<boolean>;
  forward: (envelope: RoutingEnvelope) => Promise<RoutingEnvelope>;
  recordReceivedMessage: (messageId: string) => void;

  // Gossip protocol
  broadcastRoutingTable: () => Promise<void>;
  processRoutingUpdate: (neighborPublicKey: string, routes: RouteEntry[]) => Promise<void>;
  onRoutingUpdate: (callback: (routes: RouteEntry[]) => void) => { remove: () => void };

  // Debugging
  printRoutingTable: () => void;
  getStats: () => { routes: number; neighbors: number; seenMessages: number };
}

class RoutingModule implements RoutingAPI {
  private routingTable: RoutingTable | null = null;
  private localPublicKey = '';
  private routingUpdateCallbacks: Set<(routes: RouteEntry[]) => void> = new Set();

  async init(localPublicKey: string) {
    console.log('[Routing] Initializing for', localPublicKey.substring(0, 8));

    this.localPublicKey = localPublicKey;
    this.routingTable = new RoutingTable(localPublicKey);

    // Register for routing table updates (for gossip protocol)
    const unsubscribe = this.routingTable.onRouteUpdate(routes => {
      this._notifyRoutingUpdate(routes);
    });

    this.routingTable.start();
  }

  async stop() {
    if (this.routingTable) {
      this.routingTable.stop();
    }
    forwarder.stop();
    console.log('[Routing] Stopped');
  }

  async updateRoute(destination: string, nextHop: string, cost: number, seqNum: number) {
    if (!this.routingTable) throw new Error('Routing not initialized');

    // This is typically called from Transport (direct neighbor)
    if (cost === 1) {
      this.routingTable.addDirectNeighbor(destination, `Peer ${destination.substring(0, 8)}`);
    } else {
      // Process as routing update from neighbor
      this.routingTable.processRoutingUpdate(nextHop, [
        {
          destinationPubKey: destination,
          nextHopPubKey: destination,
          cost,
          sequenceNumber: seqNum,
          lastUpdated: Date.now(),
        },
      ]);
    }
  }

  async getRoute(destination: string) {
    if (!this.routingTable) return null;

    const route = this.routingTable.getRoute(destination);
    if (!route) return null;

    return {
      destinationPubKey: route.destination,
      nextHopPubKey: route.nextHop,
      cost: route.cost,
      sequenceNumber: route.sequenceNumber,
      lastUpdated: route.lastUpdated,
    };
  }

  async getAllReachableDestinations() {
    if (!this.routingTable) return [];
    return this.routingTable.getAllReachableDestinations();
  }

  addDirectNeighbor(publicKey: string, displayName: string) {
    if (!this.routingTable) return;
    this.routingTable.addDirectNeighbor(publicKey, displayName);
  }

  removeDirectNeighbor(publicKey: string) {
    if (!this.routingTable) return;
    this.routingTable.removeNeighbor(publicKey);
  }

  async shouldForward(envelope: RoutingEnvelope, myPublicKey: string) {
    const check = forwarder.shouldForward(
      {
        messageId: envelope.messageId,
        sender: envelope.senderPubKey,
        recipient: envelope.recipientPubKey,
        ttl: envelope.ttl,
        hops: envelope.hops,
        sequenceNumber: 0,
      },
      myPublicKey
    );

    if (!check.shouldForward) {
      if (check.reason !== 'packet_for_me') {
        console.log(
          `[Routing] Not forwarding ${envelope.messageId.substring(0, 8)}: ${check.reason}`
        );
      }
    }

    return check.shouldForward;
  }

  async forward(envelope: RoutingEnvelope) {
    const packet: ForwardedPacket = {
      messageId: envelope.messageId,
      sender: envelope.senderPubKey,
      recipient: envelope.recipientPubKey,
      ttl: envelope.ttl,
      hops: envelope.hops,
      sequenceNumber: 0,
    };

    const forwarded = forwarder.prepareForward(packet);
    forwarder.recordSeen(envelope.messageId, envelope.ttl);

    return {
      ...envelope,
      ttl: forwarded.ttl,
      hops: forwarded.hops,
    };
  }

  recordReceivedMessage(messageId: string) {
    forwarder.recordSeen(messageId, 255); // High TTL means we got it through some path
  }

  async broadcastRoutingTable() {
    if (!this.routingTable) return;

    const routes = this.routingTable.getFullRoutingTable();
    console.log(`[Routing] Broadcasting routing table (${routes.length} entries)`);

    this._notifyRoutingUpdate(routes);
  }

  async processRoutingUpdate(neighborPublicKey: string, routes: RouteEntry[]) {
    if (!this.routingTable) return;

    const convertedRoutes = routes.map(r => ({
      destination: r.destinationPubKey,
      nextHop: r.nextHopPubKey,
      cost: r.cost,
      sequenceNumber: r.sequenceNumber,
      lastUpdated: r.lastUpdated,
    }));

    this.routingTable.processRoutingUpdate(neighborPublicKey, convertedRoutes);
  }

  onRoutingUpdate(callback: (routes: RouteEntry[]) => void) {
    this.routingUpdateCallbacks.add(callback);
    return {
      remove: () => this.routingUpdateCallbacks.delete(callback),
    };
  }

  printRoutingTable() {
    if (this.routingTable) {
      this.routingTable.printTable();
    }
  }

  getStats() {
    return {
      routes: this.routingTable?.getTableSize() || 0,
      neighbors: this.routingTable?.getDirectNeighbors().length || 0,
      seenMessages: forwarder.getCacheStats().cachedMessages,
    };
  }

  // Private

  private _notifyRoutingUpdate(routes: any[]): void {
    const converted = routes.map(r => ({
      destinationPubKey: r.destination,
      nextHopPubKey: r.nextHop,
      cost: r.cost,
      sequenceNumber: r.sequenceNumber,
      lastUpdated: r.lastUpdated,
    }));

    this.routingUpdateCallbacks.forEach(cb => {
      try {
        cb(converted);
      } catch (err) {
        console.error('[Routing] Callback error:', err);
      }
    });
  }
}

// Singleton instance
export const routing = new RoutingModule();

// Export only the public API types
export type { RoutingAPI, RouteEntry, RoutingEnvelope };
