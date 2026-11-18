/**
 * Forwarder Module - Multi-hop packet forwarding
 * Part of Phase 2: Routing Layer
 * 
 * Handles:
 * - TTL (Time To Live) decrement
 * - Loop prevention via message ID deduplication
 * - Duplicate packet detection
 * - Broadcast flooding with controlled TTL
 */

interface ForwardedPacket {
  messageId: string;
  sender: string;
  recipient: string;
  ttl: number;
  hops: number;
  sequenceNumber: number;
}

export class Forwarder {
  private seenMessages: Map<string, { ttl: number; timestamp: number }> = new Map();
  private readonly TTL_DECREASE = 1; // Decrement TTL by 1 per hop
  private readonly MAX_TTL = 32; // Maximum initial TTL
  private readonly MESSAGE_CACHE_TIMEOUT = 60000; // Forget about seen messages after 60s
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('[Forwarder] Initialized with MAX_TTL=' + this.MAX_TTL);
  }

  /**
   * Start cleanup of old message cache
   */
  start(): void {
    this.cleanupInterval = setInterval(() => {
      this._cleanupMessageCache();
    }, 30000); // Clean every 30 seconds
  }

  /**
   * Stop forwarder
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Check if packet should be forwarded
   * Returns true if:
   * - TTL > 0
   * - Not addressed to self
   * - Not a duplicate (not seen before or seen with higher TTL)
   */
  shouldForward(
    packet: ForwardedPacket,
    localPublicKey: string
  ): {
    shouldForward: boolean;
    reason: string;
  } {
    // Check if addressed to self
    if (packet.recipient === localPublicKey) {
      return {
        shouldForward: false,
        reason: 'packet_for_me',
      };
    }

    // Check TTL
    if (packet.ttl <= 0) {
      return {
        shouldForward: false,
        reason: 'ttl_expired',
      };
    }

    // Check for duplicate
    const seen = this.seenMessages.get(packet.messageId);
    if (seen) {
      // Only re-forward if we see it with higher TTL (path with more hops available)
      if (packet.ttl <= seen.ttl) {
        return {
          shouldForward: false,
          reason: 'duplicate_seen',
        };
      }
    }

    return {
      shouldForward: true,
      reason: 'ok',
    };
  }

  /**
   * Record that we've seen this message (for deduplication)
   */
  recordSeen(messageId: string, ttl: number): void {
    this.seenMessages.set(messageId, {
      ttl,
      timestamp: Date.now(),
    });
  }

  /**
   * Prepare packet for forwarding
   * - Decrement TTL
   * - Increment hop count
   * - Return modified packet
   */
  prepareForward(packet: ForwardedPacket): ForwardedPacket {
    const forwarded = {
      ...packet,
      ttl: packet.ttl - this.TTL_DECREASE,
      hops: packet.hops + 1,
    };

    console.log(
      `[Forwarder] Forwarding packet ${packet.messageId.substring(0, 8)}: TTL ${packet.ttl} -> ${forwarded.ttl}, hops ${packet.hops} -> ${forwarded.hops}`
    );

    return forwarded;
  }

  /**
   * Validate packet structure
   */
  isValidPacket(packet: any): packet is ForwardedPacket {
    return (
      typeof packet.messageId === 'string' &&
      typeof packet.sender === 'string' &&
      typeof packet.recipient === 'string' &&
      typeof packet.ttl === 'number' &&
      typeof packet.hops === 'number' &&
      typeof packet.sequenceNumber === 'number' &&
      packet.ttl >= 0 &&
      packet.ttl <= this.MAX_TTL &&
      packet.hops >= 0 &&
      packet.hops < this.MAX_TTL
    );
  }

  /**
   * Get message cache stats
   */
  getCacheStats(): {
    cachedMessages: number;
    oldestMessage: number;
    newestMessage: number;
  } {
    if (this.seenMessages.size === 0) {
      return {
        cachedMessages: 0,
        oldestMessage: 0,
        newestMessage: 0,
      };
    }

    const timestamps = Array.from(this.seenMessages.values()).map(m => m.timestamp);
    const oldest = Math.min(...timestamps);
    const newest = Math.max(...timestamps);

    return {
      cachedMessages: this.seenMessages.size,
      oldestMessage: oldest,
      newestMessage: newest,
    };
  }

  // Private methods

  private _cleanupMessageCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [messageId, data] of this.seenMessages) {
      if (now - data.timestamp > this.MESSAGE_CACHE_TIMEOUT) {
        this.seenMessages.delete(messageId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Forwarder] Cleaned ${cleaned} old messages from cache`);
    }
  }
}

export const forwarder = new Forwarder();
