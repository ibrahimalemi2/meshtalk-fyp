/**
 * Crypto Module - Public API
 * Other modules ONLY interact with these functions
 * Implementation (Ed25519, Double Ratchet) is encapsulated here
 */

import * as keypair from './keypair';
import * as doubleRatchet from './doubleRatchet';

export interface KeyPair {
  publicKey: string; // Hex-encoded Ed25519 public key
  privateKey: string; // Hex-encoded Ed25519 private key (SECRET - never exposed outside)
}

export interface DoubleRatchetSession {
  sessionId: string;
  state: doubleRatchet.DoubleRatchetState; // Internal Double Ratchet state
}

export interface EncryptedMessage {
  ciphertext: string; // Base64 encrypted payload
  dh: string; // Base64 DH public key
  pn: number; // Previous chain length
  n: number; // Message number
}

interface CryptoAPI {
  // Keypair management
  generateIdentity: () => Promise<KeyPair>;
  getLocalIdentity: () => Promise<KeyPair | null>;
  saveIdentity: (keypair: KeyPair) => Promise<void>;

  // Session management
  initializeSession: (remotePublicKey: string, initialRootKey?: string) => Promise<DoubleRatchetSession>;
  getSession: (remotePublicKey: string) => Promise<DoubleRatchetSession | null>;

  // E2EE operations
  encrypt: (remotePublicKey: string, plaintext: string) => Promise<EncryptedMessage>;
  decrypt: (remotePublicKey: string, encrypted: EncryptedMessage) => Promise<string>;

  // Signature operations (for emergency broadcasts)
  sign: (message: string) => Promise<string>;
  verify: (message: string, signature: string, publicKey: string) => Promise<boolean>;

  // Utility
  hashPublicKey: (publicKey: string) => Promise<string>; // For short display names
}

class CryptoModule implements CryptoAPI {
  private localIdentity: KeyPair | null = null;
  private sessions: Map<string, DoubleRatchetSession> = new Map();

  async generateIdentity() {
    console.log('[Crypto] Generating Ed25519 keypair');
    return await keypair.generateKeypair();
  }

  async getLocalIdentity() {
    return this.localIdentity;
  }

  async saveIdentity(kp: KeyPair) {
    this.localIdentity = kp;
    console.log('[Crypto] Saved local identity');
  }

  async initializeSession(remotePublicKey: string, initialRootKey?: string) {
    if (!this.localIdentity) {
      throw new Error('[Crypto] No local identity - initialize keypair first');
    }

    const sessionId = `${this.localIdentity.publicKey}:${remotePublicKey}`;
    console.log(`[Crypto] Initializing Double Ratchet session: ${sessionId.substring(0, 32)}...`);

    // Generate DH keypair for this session
    const ourDH = await keypair.generateKeypair();

    // Initial root key (random or provided)
    const rootKey =
      initialRootKey ||
      Buffer.from(Math.random().toString()).toString('hex').padEnd(64, '0').substring(0, 64);

    // Initialize Double Ratchet state
    // We assume we're the initiator; peer will be receiver
    const state = await doubleRatchet.initializeSession(
      sessionId,
      rootKey,
      ourDH.privateKey,
      ourDH.publicKey,
      remotePublicKey,
      true
    );

    const session: DoubleRatchetSession = {
      sessionId,
      state,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async getSession(remotePublicKey: string) {
    if (!this.localIdentity) return null;

    const sessionId = `${this.localIdentity.publicKey}:${remotePublicKey}`;
    return this.sessions.get(sessionId) || null;
  }

  async encrypt(remotePublicKey: string, plaintext: string) {
    const session = await this.getSession(remotePublicKey);
    if (!session) {
      throw new Error(
        `[Crypto] No session with ${remotePublicKey} - initialize session first`
      );
    }

    console.log(`[Crypto] Encrypting message for ${remotePublicKey.substring(0, 8)}`);

    // Encrypt using Double Ratchet
    const { encrypted, newState } = await doubleRatchet.encryptMessage(
      session.state,
      plaintext
    );

    // Update session state
    session.state = newState;
    this.sessions.set(session.sessionId, session);

    return encrypted;
  }

  async decrypt(remotePublicKey: string, encrypted: EncryptedMessage) {
    const session = await this.getSession(remotePublicKey);
    if (!session) {
      throw new Error(
        `[Crypto] No session with ${remotePublicKey} - initialize session first`
      );
    }

    console.log(`[Crypto] Decrypting message from ${remotePublicKey.substring(0, 8)}`);

    // Decrypt using Double Ratchet
    const { plaintext, newState } = await doubleRatchet.decryptMessage(
      session.state,
      encrypted
    );

    // Update session state
    session.state = doubleRatchet.cleanupSkippedKeys(newState);
    this.sessions.set(session.sessionId, session);

    return plaintext;
  }

  async sign(message: string) {
    if (!this.localIdentity) {
      throw new Error('[Crypto] No local identity');
    }

    console.log('[Crypto] Signing message with local private key');
    return await keypair.signMessage(message, this.localIdentity.privateKey);
  }

  async verify(message: string, signature: string, publicKeyHex: string) {
    console.log(`[Crypto] Verifying signature from ${publicKeyHex.substring(0, 8)}`);
    return await keypair.verifySignature(message, signature, publicKeyHex);
  }

  async hashPublicKey(publicKeyHex: string) {
    return await keypair.hashPublicKey(publicKeyHex);
  }
}

// Singleton instance
export const crypto = new CryptoModule();

// Export only the public API types
export type { CryptoAPI, KeyPair, DoubleRatchetSession, EncryptedMessage };
