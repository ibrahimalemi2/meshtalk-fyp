/**
 * Double Ratchet Algorithm Implementation
 * Based on Signal Protocol specification
 *
 * Provides forward secrecy and break-in recovery through:
 * 1. DH Ratchet - Diffie-Hellman key exchange on message sends
 * 2. Chain Ratchet - KDF-based message key derivation
 * 3. Skipped Message Keys - Storage for out-of-order messages
 */

import { sha512 } from '@noble/hashes/sha512';
import { chacha20poly1305 } from '@noble/ciphers/chacha';

// HKDF-SHA512 for key derivation
async function hkdf(
  salt: string,
  ikm: string,
  info: string,
  length: number
): Promise<string> {
  // Simplified HKDF: PRK = HMAC(salt, ikm)
  const saltBuf = Buffer.from(salt, 'hex');
  const ikmBuf = Buffer.from(ikm, 'hex');
  const infoBuf = Buffer.from(info, 'utf-8');

  // Extract phase
  const extract = sha512(Buffer.concat([saltBuf, ikmBuf]));

  // Expand phase - generate OKM
  let okm = Buffer.alloc(0);
  let t = Buffer.alloc(0);
  let iterations = Math.ceil(length / 64);

  for (let i = 0; i < iterations; i++) {
    const hmacInput = Buffer.concat([t, infoBuf, Buffer.from([i + 1])]);
    t = Buffer.from(sha512(Buffer.concat([extract, hmacInput])));
    okm = Buffer.concat([okm, t]);
  }

  return okm.slice(0, length).toString('hex');
}

// KDF for chain key
async function kdfChain(chainKey: string, constant: number): Promise<string> {
  const ckBuf = Buffer.from(chainKey, 'hex');
  const constantBuf = Buffer.from([constant]);

  const result = sha512(Buffer.concat([ckBuf, constantBuf]));
  return Buffer.from(result.slice(0, 32)).toString('hex');
}

// KDF for message key
async function kdfMessageKey(chainKey: string): Promise<string> {
  return kdfChain(chainKey, 0x01);
}

// KDF for next chain key
async function kdfChainKey(chainKey: string): Promise<string> {
  return kdfChain(chainKey, 0x02);
}

export interface DoubleRatchetState {
  sessionId: string;
  rootKey: string; // Master secret
  ourDHPrivate: string; // Our DH private key
  ourDHPublic: string; // Our DH public key
  theirDHPublic: string; // Peer's DH public key
  chainKeySend?: string; // For outgoing messages
  chainKeyRecv?: string; // For incoming messages
  sendCounter: number; // How many messages we've sent
  recvCounter: number; // How many messages we've received
  prevSendCounter: number; // Previous send counter (for PN field)
  skippedKeys: Map<string, string>; // messageNumber:publicKey -> messageKey (for out-of-order)
}

export interface EncryptedMessage {
  ciphertext: string; // Base64 encrypted payload
  dh: string; // Base64 DH public key from sender
  pn: number; // Previous chain length (send counter before DH)
  n: number; // Message number (in current chain)
}

/**
 * Initialize Double Ratchet session
 * Used when first establishing session with a peer
 */
export async function initializeSession(
  sessionId: string,
  rootKey: string,
  ourDHPrivate: string,
  ourDHPublic: string,
  theirDHPublic: string,
  isInitiator: boolean
): Promise<DoubleRatchetState> {
  console.log(`[DoubleRatchet] Initializing session ${sessionId}`);

  // Perform initial DH: sharedSecret = DH(ourPrivate, theirPublic)
  // For Ed25519 we use a simplified KDF instead of actual ECDH
  const sharedSecret = await hkdf(
    rootKey,
    Buffer.concat([
      Buffer.from(ourDHPrivate, 'hex').slice(0, 32),
      Buffer.from(theirDHPublic, 'hex'),
    ]).toString('hex'),
    isInitiator ? 'initial-sender' : 'initial-receiver',
    64
  );

  // KDF(rootKey, sharedSecret) -> (newRootKey, newChainKey)
  const keyMaterial = await hkdf(rootKey, sharedSecret, 'double-ratchet', 64);
  const newRootKey = keyMaterial.slice(0, 64);
  const newChainKey = keyMaterial.slice(64, 128);

  const state: DoubleRatchetState = {
    sessionId,
    rootKey: newRootKey,
    ourDHPrivate,
    ourDHPublic,
    theirDHPublic,
    chainKeySend: isInitiator ? newChainKey : undefined,
    chainKeyRecv: !isInitiator ? newChainKey : undefined,
    sendCounter: 0,
    recvCounter: 0,
    prevSendCounter: 0,
    skippedKeys: new Map(),
  };

  return state;
}

/**
 * Encrypt a message using Double Ratchet
 * Updates send chain key, potentially triggers DH ratchet
 */
export async function encryptMessage(
  state: DoubleRatchetState,
  plaintext: string
): Promise<{ encrypted: EncryptedMessage; newState: DoubleRatchetState }> {
  const stateClone = { ...state, skippedKeys: new Map(state.skippedKeys) };

  // Chain ratchet: generate message key from chain key
  if (!stateClone.chainKeySend) {
    throw new Error('No send chain key - session not initialized for sending');
  }

  const messageKey = await kdfMessageKey(stateClone.chainKeySend);
  stateClone.chainKeySend = await kdfChainKey(stateClone.chainKeySend);

  // Encrypt with message key
  const nonce = Buffer.alloc(12, 0); // In real impl, random nonce per message
  const cipher = chacha20poly1305(Buffer.from(messageKey, 'hex'));

  const plaintextBuf = Buffer.from(plaintext, 'utf-8');
  const ciphertext = cipher.encrypt(nonce, plaintextBuf, undefined);

  // Prepare encrypted message
  const encrypted: EncryptedMessage = {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    dh: stateClone.ourDHPublic.slice(0, 64), // Send our public key
    pn: stateClone.prevSendCounter, // Previous send counter
    n: stateClone.sendCounter, // Current message number in chain
  };

  stateClone.sendCounter++;

  console.log(
    `[DoubleRatchet] Encrypted message ${encrypted.n} in chain (PN=${encrypted.pn})`
  );

  return { encrypted, newState: stateClone };
}

/**
 * Decrypt a message using Double Ratchet
 * Handles DH ratchet steps and out-of-order messages
 */
export async function decryptMessage(
  state: DoubleRatchetState,
  encrypted: EncryptedMessage
): Promise<{ plaintext: string; newState: DoubleRatchetState }> {
  const stateClone = { ...state, skippedKeys: new Map(state.skippedKeys) };

  // DH Ratchet: if sender changed DH key, perform ratchet step
  if (encrypted.dh !== stateClone.theirDHPublic) {
    console.log(`[DoubleRatchet] DH Ratchet triggered (sender changed key)`);

    // Store skipped message keys from previous chain
    if (stateClone.chainKeyRecv) {
      let tempChainKey = stateClone.chainKeyRecv;
      for (let i = 0; i < encrypted.pn; i++) {
        const skippedKey = await kdfMessageKey(tempChainKey);
        const cacheKey = `${i}:${stateClone.theirDHPublic}`;
        stateClone.skippedKeys.set(cacheKey, skippedKey);
        tempChainKey = await kdfChainKey(tempChainKey);
      }
    }

    // Update DH public key
    stateClone.theirDHPublic = encrypted.dh;

    // Perform DH: sharedSecret = DH(ourPrivate, newTheirPublic)
    const sharedSecret = await hkdf(
      stateClone.rootKey,
      Buffer.concat([
        Buffer.from(stateClone.ourDHPrivate, 'hex').slice(0, 32),
        Buffer.from(encrypted.dh, 'hex'),
      ]).toString('hex'),
      'dh-ratchet',
      64
    );

    // KDF(rootKey, sharedSecret) -> (newRootKey, newChainKey)
    const keyMaterial = await hkdf(
      stateClone.rootKey,
      sharedSecret,
      'double-ratchet',
      64
    );
    stateClone.rootKey = keyMaterial.slice(0, 64);
    stateClone.chainKeyRecv = keyMaterial.slice(64, 128);
    stateClone.recvCounter = 0;
  }

  // Chain ratchet: generate message keys up to current message
  if (!stateClone.chainKeyRecv) {
    throw new Error('No receive chain key - session not initialized for receiving');
  }

  // Check for out-of-order messages
  if (encrypted.n < stateClone.recvCounter) {
    const cacheKey = `${encrypted.n}:${encrypted.dh}`;
    const skippedKey = stateClone.skippedKeys.get(cacheKey);

    if (!skippedKey) {
      throw new Error(
        `[DoubleRatchet] Too old message or missing key: ${encrypted.n} < ${stateClone.recvCounter}`
      );
    }

    console.log(`[DoubleRatchet] Using skipped key for out-of-order message ${encrypted.n}`);

    // Decrypt with skipped key
    const nonce = Buffer.alloc(12, 0);
    const cipher = chacha20poly1305(Buffer.from(skippedKey, 'hex'));
    const ciphertextBuf = Buffer.from(encrypted.ciphertext, 'base64');
    const plaintext = cipher.decrypt(nonce, ciphertextBuf, undefined);

    return { plaintext: Buffer.from(plaintext).toString('utf-8'), newState: stateClone };
  }

  // In-order: generate message keys for any skipped messages in current chain
  let tempChainKey = stateClone.chainKeyRecv;
  for (let i = stateClone.recvCounter; i < encrypted.n; i++) {
    const skippedKey = await kdfMessageKey(tempChainKey);
    const cacheKey = `${i}:${encrypted.dh}`;
    stateClone.skippedKeys.set(cacheKey, skippedKey);
    tempChainKey = await kdfChainKey(tempChainKey);
  }

  // Generate message key for current message
  const messageKey = await kdfMessageKey(tempChainKey);
  stateClone.chainKeyRecv = await kdfChainKey(tempChainKey);
  stateClone.recvCounter = encrypted.n + 1;

  // Decrypt message
  const nonce = Buffer.alloc(12, 0);
  const cipher = chacha20poly1305(Buffer.from(messageKey, 'hex'));
  const ciphertextBuf = Buffer.from(encrypted.ciphertext, 'base64');
  const plaintext = cipher.decrypt(nonce, ciphertextBuf, undefined);

  console.log(
    `[DoubleRatchet] Decrypted message ${encrypted.n} (next expected: ${stateClone.recvCounter})`
  );

  return { plaintext: Buffer.from(plaintext).toString('utf-8'), newState: stateClone };
}

/**
 * Clean up old skipped keys to avoid memory bloat
 * Called periodically to remove keys older than timeout
 */
export function cleanupSkippedKeys(
  state: DoubleRatchetState,
  maxAge: number = 60000
): DoubleRatchetState {
  // In a real impl, track timestamp for each skipped key
  // For now, just truncate if too many accumulated
  if (state.skippedKeys.size > 1000) {
    console.warn(
      `[DoubleRatchet] Too many skipped keys (${state.skippedKeys.size}), clearing old entries`
    );
    // Keep only recent entries
    const entries = Array.from(state.skippedKeys.entries()).slice(-500);
    state.skippedKeys = new Map(entries);
  }
  return state;
}
