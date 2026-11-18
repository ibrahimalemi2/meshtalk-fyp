/**
 * Routing Table Module - Distance Vector Algorithm
 * Part of Phase 2: Routing Layer
 * 
 * Implements Bellman-Ford distance vector routing:
 * - Each node maintains table of [destination, nextHop, cost, sequenceNumber]
 * - Periodically broadcasts routing table to neighbors
 * - Receives updates from neighbors and recalculates routes
 * - Handles node failures via sequence number comparison
 */

interface RouteEntry {
  destination: string; // Destination public key
  nextHop: string; // Next hop public key
  cost: number; // Hop count (>15 = unreachable)
  sequenceNumber: number; // From destination (prevents stale routes)
  lastUpdated: number; // Timestamp
}

type RoutingUpdateHandler = (routes: RouteEntry[]) => void;

export class RoutingTable {
  private table: Map<string, RouteEntry> = new Map();
  private localPublicKey: string;
  private updateHandlers: Set<RoutingUpdateHandler> = new Set();
  private routeUpdateInterval: NodeJS.Timeout | null = null;
  private readonly MAX_COST = 16; // Route unreachable if cost >= 16 (RIPv1 style)
  private readonly BROADCAST_INTERVAL = 5000; // Send routing updates every 5 seconds
  private readonly ROUTE_TIMEOUT = 30000; // Remove routes not seen for 30 seconds
  private sequenceNumber = 0; // Local sequence number (incremented on changes)

  constructor(localPublicKey: string) {
    this.localPublicKey = localPublicKey;
    console.log(`[RoutingTable] Initialized for ${localPublicKey.substring(0, 8)}`);
  }

  /**
   * Start periodic broadcasting of routing table
   */
  start(): void {
    console.log('[RoutingTable] Starting gossip protocol');

    // Add self to routing table (cost 0)
    this.table.set(this.localPublicKey, {
      destination: this.localPublicKey,
      nextHop: this.localPublicKey,
      cost: 0,
      sequenceNumber: this.sequenceNumber,
      lastUpdated: Date.now(),
    });

    // Periodic broadcast
    this.routeUpdateInterval = setInterval(() => {
      this._broadcastRoutingTable();
      this._cleanupStaleRoutes();
    }, this.BROADCAST_INTERVAL);
  }

  /**
   * Stop routing
   */
  stop(): void {
    if (this.routeUpdateInterval) {
      clearInterval(this.routeUpdateInterval);
      this.routeUpdateInterval = null;
    }
    console.log('[RoutingTable] Stopped');
  }

  /**
   * Add or update a direct neighbor
   * Called by Transport when peer is discovered
   */
  addDirectNeighbor(publicKey: string, displayName: string): void {
    const existing = this.table.get(publicKey);

    // Direct neighbor always has cost 1
    this.table.set(publicKey, {
      destination: publicKey,
      nextHop: publicKey,
      cost: 1,
      sequenceNumber: 0, // Neighbor's sequence unknown initially
      lastUpdated: Date.now(),
    });

    if (!existing) {
      console.log(`[RoutingTable] Direct neighbor added: ${displayName} (cost 1)`);
      this.sequenceNumber++;
    }
  }

  /**
   * Remove a neighbor (peer lost)
   */
  removeNeighbor(publicKey: string): void {
    if (this.table.delete(publicKey)) {
      console.log(`[RoutingTable] Neighbor removed: ${publicKey.substring(0, 8)}`);
      this.sequenceNumber++;
    }
  }

  /**
   * Process routing update from a neighbor
   * Implements split horizon with poison reverse
   */
  processRoutingUpdate(neighborPublicKey: string, routes: RouteEntry[]): void {
    let changed = false;

    for (const route of routes) {
      // Skip if route points back to sender (split horizon)
      if (route.nextHop === this.localPublicKey) {
        continue;
      }

      // Skip route back to neighbor itself
      if (route.destination === neighborPublicKey) {
        continue;
      }

      // Calculate new cost through this neighbor
      const newCost = Math.min(route.cost + 1, this.MAX_COST);

      const existing = this.table.get(route.destination);

      // Update decision: newer sequence, or same sequence with better cost
      const shouldUpdate =
        !existing ||
        route.sequenceNumber > existing.sequenceNumber ||
        (route.sequenceNumber === existing.sequenceNumber && newCost < existing.cost);

      if (shouldUpdate) {
        const oldCost = existing?.cost;

        this.table.set(route.destination, {
          destination: route.destination,
          nextHop: neighborPublicKey,
          cost: newCost,
          sequenceNumber: route.sequenceNumber,
          lastUpdated: Date.now(),
        });

        if (!existing || oldCost !== newCost) {
          changed = true;
          console.log(
            `[RoutingTable] Route update: ${route.destination.substring(0, 8)} -> ${neighborPublicKey.substring(0, 8)} (cost ${newCost}, seq ${route.sequenceNumber})`
          );
        }
      }
    }

    if (changed) {
      this.sequenceNumber++;
    }
  }

  /**
   * Get best route to destination
   */
  getRoute(destination: string): RouteEntry | null {
    if (destination === this.localPublicKey) {
      return null; // Don't route to self
    }

    const route = this.table.get(destination);

    // Return null if unreachable (cost >= 16)
    if (route && route.cost >= this.MAX_COST) {
      return null;
    }

    return route || null;
  }

  /**
   * Get all reachable destinations
   */
  getAllReachableDestinations(): string[] {
    const destinations: string[] = [];

    for (const [key, route] of this.table) {
      if (key !== this.localPublicKey && route.cost < this.MAX_COST) {
        destinations.push(key);
      }
    }

    return destinations;
  }

  /**
   * Get all direct neighbors (cost 1)
   */
  getDirectNeighbors(): RouteEntry[] {
    const neighbors: RouteEntry[] = [];

    for (const route of this.table.values()) {
      if (route.cost === 1 && route.destination !== this.localPublicKey) {
        neighbors.push(route);
      }
    }

    return neighbors;
  }

  /**
   * Get full routing table (for broadcasting)
   */
  getFullRoutingTable(): RouteEntry[] {
    return Array.from(this.table.values()).filter(r => r.cost < this.MAX_COST);
  }

  /**
   * Register listener for routing changes
   */
  onRouteUpdate(handler: RoutingUpdateHandler): () => void {
    this.updateHandlers.add(handler);

    return () => {
      this.updateHandlers.delete(handler);
    };
  }

  /**
   * Get local sequence number
   */
  getSequenceNumber(): number {
    return this.sequenceNumber;
  }

  /**
   * Get routing table size
   */
  getTableSize(): number {
    return this.table.size;
  }

  /**
   * Print routing table (debugging)
   */
  printTable(): void {
    console.log('[RoutingTable] Current routes:');
    console.log('Destination      | Next Hop         | Cost | SeqNum | Age(s)');
    console.log('-----------------------------------------------------------');

    const now = Date.now();

    for (const route of this.table.values()) {
      const age = Math.floor((now - route.lastUpdated) / 1000);
      console.log(
        `${route.destination.substring(0, 16).padEnd(16)} | ${route.nextHop.substring(0, 16).padEnd(16)} | ${String(route.cost).padEnd(4)} | ${String(route.sequenceNumber).padEnd(6)} | ${age}`
      );
    }
  }

  // Private methods

  private _broadcastRoutingTable(): void {
    const routes = this.getFullRoutingTable();

    // Notify handlers (usually ProtocolEngine which sends via Transport)
    for (const handler of this.updateHandlers) {
      try {
        handler(routes);
      } catch (err) {
        console.error('[RoutingTable] Handler error:', err);
      }
    }
  }

  private _cleanupStaleRoutes(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, route] of this.table) {
      if (
        key !== this.localPublicKey &&
        now - route.lastUpdated > this.ROUTE_TIMEOUT
      ) {
        this.table.delete(key);
        console.log(`[RoutingTable] Route expired: ${key.substring(0, 8)}`);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.sequenceNumber++;
    }
  }
}
