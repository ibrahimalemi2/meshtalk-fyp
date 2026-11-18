/**
 * Protocol Engine - Orchestrates the modular architecture
 * Coordinates between modules WITHOUT creating direct dependencies
 * Each phase can be tested independently
 */

import { storage } from './storage/index';
import { crypto, type EncryptedMessage } from './crypto/index';
import { transport, type DiscoveredPeer } from './transport/index';
import { routing, type RoutingEnvelope } from './routing/index';
import { audio, type AudioChunk } from './audio/index';

interface ProtocolEngineConfig {
  displayName: string;
  avatarColor: string;
  enableRelay?: boolean;
}

export class ProtocolEngine {
  private config: ProtocolEngineConfig;
  private isRunning = false;
  private localPublicKey: string = '';

  constructor(config: ProtocolEngineConfig) {
    this.config = config;
  }

  /**
   * Initialize the protocol engine
   * Starts all modular subsystems in proper order
   */
  async init() {
    console.log('[ProtocolEngine] Initializing...');

    // Phase 0: Storage & Identity
    await storage.init();
    const identity = await crypto.getLocalIdentity();

    if (!identity) {
      const newIdentity = await crypto.generateIdentity();
      await crypto.saveIdentity(newIdentity);
      this.localPublicKey = newIdentity.publicKey;
      await storage.saveUser(newIdentity.publicKey, this.config.displayName, this.config.avatarColor);
    } else {
      this.localPublicKey = identity.publicKey;
    }

    // Phase 2: Routing initialization (before transport, so we can update routes)
    await routing.init(this.localPublicKey);

    routing.onRoutingUpdate((routes) => {
      console.log(`[ProtocolEngine] Received routing update: ${routes.length} routes`);
      routes.forEach(r => storage.updateRoute(r.destinationPubKey, r.nextHopPubKey, r.cost));
    });

    // Phase 1: Transport initialization
    await transport.start();

    // Register transport listeners
    transport.onPeerDiscovered((peer: DiscoveredPeer) => {
      this._handlePeerDiscovered(peer);
    });

    transport.onPeerLost((publicKey: string) => {
      this._handlePeerLost(publicKey);
    });

    transport.onPacketReceived((sender: string, payload: Uint8Array) => {
      this._handlePacketReceived(sender, payload);
    });

    this.isRunning = true;
    console.log(`[ProtocolEngine] Ready. Local ID: ${this.localPublicKey.substring(0, 8).toUpperCase()}`);
  }

  /**
   * Clean shutdown
   */
  async shutdown() {
    console.log('[ProtocolEngine] Shutting down...');
    await transport.stop();
    await routing.stop();
    await storage.close();
    this.isRunning = false;
  }

  /**
   * Send an encrypted message to a peer
   * Uses crypto module for E2EE, routing for path selection, transport for delivery
   */
  async sendMessage(recipientPublicKey: string, plaintext: string) {
    if (!this.isRunning) throw new Error('Protocol engine not running');

    console.log(`[ProtocolEngine] Sending message to ${recipientPublicKey.substring(0, 8)}`);

    // Encrypt using crypto module
    const encrypted = await crypto.encrypt(recipientPublicKey, plaintext);

    // Create message record
    const messageId = `msg-${Date.now()}`;
    await storage.saveMessage({
      id: messageId,
      senderId: this.localPublicKey,
      recipientId: recipientPublicKey,
      type: 'text',
      content: JSON.stringify(encrypted),
      timestamp: Date.now(),
      expiresAt: Date.now() + 24 * 3600 * 1000, // 24 hours TTL
      status: 'sending',
      hops: 0,
      sequenceNumber: 0,
    });

    // Get route using routing module
    const route = await routing.getRoute(recipientPublicKey);
    const nextHop = route?.nextHopPubKey || recipientPublicKey; // Direct if no route

    // Create routing envelope
    const envelope: RoutingEnvelope = {
      senderPubKey: this.localPublicKey,
      recipientPubKey: recipientPublicKey,
      messageId,
      payload: Buffer.from(JSON.stringify(encrypted)).toString('base64'),
      ttl: 32,
      hops: 0,
    };

    // Transmit using transport module
    try {
      const payload = Buffer.from(JSON.stringify(envelope));
      await transport.sendPacket(nextHop, payload);
      await storage.markMessageAsDelivered(messageId);
    } catch (err) {
      console.error(`[ProtocolEngine] Failed to send message:`, err);
    }
  }

  /**
   * Send voice message with audio chunking
   */
  async sendVoiceMessage(recipientPublicKey: string, audioData: Uint8Array) {
    if (!this.isRunning) throw new Error('Protocol engine not running');

    console.log(`[ProtocolEngine] Sending voice message to ${recipientPublicKey.substring(0, 8)}`);

    // Chunk using audio module
    const chunks = await audio.chunkAudio(audioData);

    for (const chunk of chunks) {
      const messageId = `voice-${Date.now()}-${chunk.fragmentIndex}`;

      // Each chunk is encrypted separately
      const encrypted = await crypto.encrypt(recipientPublicKey, JSON.stringify(chunk));

      await storage.saveMessage({
        id: messageId,
        senderId: this.localPublicKey,
        recipientId: recipientPublicKey,
        type: 'voice',
        content: JSON.stringify(encrypted),
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 3600 * 1000,
        status: 'sending',
        hops: 0,
        sequenceNumber: chunk.sequenceNumber,
      });

      // Send each chunk (may be received out of order)
      const envelope: RoutingEnvelope = {
        senderPubKey: this.localPublicKey,
        recipientPubKey: recipientPublicKey,
        messageId,
        payload: Buffer.from(JSON.stringify(encrypted)).toString('base64'),
        ttl: 32,
        hops: 0,
      };

      const route = await routing.getRoute(recipientPublicKey);
      const nextHop = route?.nextHopPubKey || recipientPublicKey;

      try {
        const payload = Buffer.from(JSON.stringify(envelope));
        await transport.sendPacket(nextHop, payload);
      } catch (err) {
        console.error(`[ProtocolEngine] Failed to send voice chunk:`, err);
      }
    }
  }

  /**
   * Broadcast emergency alert (signed, to all peers)
   */
  async broadcastEmergency(message: string) {
    if (!this.isRunning) throw new Error('Protocol engine not running');

    console.log('[ProtocolEngine] Broadcasting emergency alert');

    // Sign message using crypto module
    const signature = await crypto.sign(message);

    const messageId = `emergency-${Date.now()}`;
    const envelope: RoutingEnvelope = {
      senderPubKey: this.localPublicKey,
      recipientPubKey: 'BROADCAST',
      messageId,
      payload: Buffer.from(JSON.stringify({ message, signature })).toString('base64'),
      ttl: 32,
      hops: 0,
    };

    const destinations = await routing.getAllReachableDestinations();
    for (const dest of destinations) {
      try {
        const payload = Buffer.from(JSON.stringify(envelope));
        await transport.sendPacket(dest, payload);
      } catch (err) {
        console.error(`[ProtocolEngine] Failed to broadcast to ${dest}:`, err);
      }
    }
  }

  // =============================================================================
  // Private event handlers - orchestrate module interactions
  // =============================================================================

  private async _handlePeerDiscovered(peer: DiscoveredPeer) {
    console.log(`[ProtocolEngine] Discovered peer: ${peer.displayName}`);

    // Save peer to storage
    await storage.saveUser(peer.publicKey, peer.displayName, 'default');

    // Initialize crypto session for E2EE
    await crypto.initializeSession(peer.publicKey);

    // Add as direct neighbor in routing table
    routing.addDirectNeighbor(peer.publicKey, peer.displayName);
  }

  private async _handlePeerLost(publicKey: string) {
    console.log(`[ProtocolEngine] Peer lost: ${publicKey.substring(0, 8)}`);

    // Remove from routing table
    routing.removeDirectNeighbor(publicKey);

    // Update status in storage
    await storage.updateUserStatus(publicKey, false);
  }

  private async _handlePacketReceived(sender: string, payload: Uint8Array) {
    try {
      const envelope: RoutingEnvelope = JSON.parse(Buffer.from(payload).toString('utf-8'));

      // Check if intended for me
      if (envelope.recipientPubKey === this.localPublicKey) {
        // Decrypt message
        const encrypted: EncryptedMessage = JSON.parse(
          Buffer.from(envelope.payload, 'base64').toString('utf-8')
        );
        const plaintext = await crypto.decrypt(envelope.senderPubKey, encrypted);

        // Save to storage
        const messageId = envelope.messageId;
        await storage.saveMessage({
          id: messageId,
          senderId: envelope.senderPubKey,
          recipientId: this.localPublicKey,
          type: 'text',
          content: plaintext,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 3600 * 1000,
          status: 'delivered',
          hops: envelope.hops,
          sequenceNumber: 0,
        });

        console.log(`[ProtocolEngine] Message received from ${envelope.senderPubKey.substring(0, 8)}`);
      } else if (envelope.recipientPubKey === 'BROADCAST') {
        // Handle broadcast message (emergency, route gossip, etc.)
        console.log(`[ProtocolEngine] Broadcast received from ${envelope.senderPubKey.substring(0, 8)}`);
        // TODO: Verify signature, handle emergency protocol
      } else {
        // Forward if TTL allows and not seen before
        if (await routing.shouldForward(envelope, this.localPublicKey)) {
          // Record that we've seen this message
          routing.recordReceivedMessage(envelope.messageId);

          // Prepare for forwarding (decrement TTL, increment hops)
          const forwarded = await routing.forward(envelope);

          // Find next hop
          const route = await routing.getRoute(forwarded.recipientPubKey);
          if (route) {
            console.log(
              `[ProtocolEngine] Forwarding packet to ${route.nextHopPubKey.substring(0, 8)} (TTL: ${forwarded.ttl}, hops: ${forwarded.hops})`
            );
            const forwardPayload = Buffer.from(JSON.stringify(forwarded));
            await transport.sendPacket(route.nextHopPubKey, forwardPayload);
          } else {
            console.warn(
              `[ProtocolEngine] No route found for ${forwarded.recipientPubKey.substring(0, 8)}`
            );
          }
        }
      }
    } catch (err) {
      console.error('[ProtocolEngine] Failed to handle packet:', err);
    }
  }
}

/**
 * Factory function to create and initialize engine
 */
export async function initializeProtocol(config: ProtocolEngineConfig) {
  const engine = new ProtocolEngine(config);
  await engine.init();
  return engine;
}
