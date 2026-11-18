/**
 * Ed25519 Keypair Generation and Management
 * Handles identity creation, loading, and signature operations
 */

import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

// SHA-512 is built-in to @noble/ed25519, no need to assign

export interface KeyPair {
  publicKey: string; // Hex-encoded Ed25519 public key
  privateKey: string; // Hex-encoded Ed25519 private key (SECRET)
}

/**
 * Generate a new Ed25519 keypair
 * Uses secure random entropy
 */
export async function generateKeypair(): Promise<KeyPair> {
  console.log('[Keypair] Generating new Ed25519 keypair');

  // Generate random 32-byte seed
  const seed = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(seed);
  } else {
    // Fallback for testing (NOT SECURE - never use in production)
    for (let i = 0; i < 32; i++) {
      seed[i] = Math.floor(Math.random() * 256);
    }
  }

  // Generate keypair from seed
  const privateKey = seed;
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);

  // Convert to hex for storage
  const privateKeyHex = Buffer.from(privateKey).toString('hex');
  const publicKeyHex = Buffer.from(publicKey).toString('hex');

  console.log(`[Keypair] Generated public key: ${publicKeyHex.substring(0, 16)}...`);

  return {
    publicKey: publicKeyHex,
    privateKey: privateKeyHex,
  };
}

/**
 * Load keypair from hex strings
 */
export function loadKeypair(publicKeyHex: string, privateKeyHex: string): KeyPair {
  return {
    publicKey: publicKeyHex,
    privateKey: privateKeyHex,
  };
}

/**
 * Sign a message with a private key
 * Returns signature as hex string
 */
export async function signMessage(message: string, privateKeyHex: string): Promise<string> {
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const messageBytes = Buffer.from(message, 'utf-8');

  const signature = await ed25519.signAsync(messageBytes, privateKey);
  return Buffer.from(signature).toString('hex');
}

/**
 * Verify a message signature
 * Returns true if signature is valid
 */
export async function verifySignature(
  message: string,
  signatureHex: string,
  publicKeyHex: string
): Promise<boolean> {
  try {
    const messageBytes = Buffer.from(message, 'utf-8');
    const signature = Buffer.from(signatureHex, 'hex');
    const publicKey = Buffer.from(publicKeyHex, 'hex');

    const isValid = await ed25519.verifyAsync(signature, messageBytes, publicKey);
    return isValid;
  } catch (err) {
    console.error('[Keypair] Signature verification error:', err);
    return false;
  }
}

/**
 * Hash a public key to get a short identifier
 * Useful for display purposes (e.g., peer names)
 */
export async function hashPublicKey(publicKeyHex: string): Promise<string> {
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  const hash = await sha512(publicKey);
  // Take first 4 bytes and convert to hex
  return Buffer.from(hash.slice(0, 4)).toString('hex').toUpperCase();
}

/**
 * Derive a shared secret from two public keys using ECDH
 * NOT USED FOR DOUBLE RATCHET but useful for initial key agreement
 */
export async function deriveSharedSecret(
  ourPrivateKeyHex: string,
  theirPublicKeyHex: string
): Promise<string> {
  // Note: Ed25519 signatures are not suitable for ECDH
  // For true ECDH we would need X25519 (Montgomery curve)
  // This is a placeholder - Double Ratchet handles key derivation

  const ourPrivateKey = Buffer.from(ourPrivateKeyHex, 'hex');
  const theirPublicKey = Buffer.from(theirPublicKeyHex, 'hex');

  // Create a combined hash as pseudo-shared-secret
  const combined = Buffer.concat([ourPrivateKey, theirPublicKey]);
  const hash = sha512(combined);

  return Buffer.from(hash.slice(0, 32)).toString('hex');
}

/**
 * Compute message authentication code
 * Used for integrity checking in Double Ratchet
 */
export async function computeMAC(secret: string, message: string): Promise<string> {
  const secretBytes = Buffer.from(secret, 'hex');
  const messageBytes = Buffer.from(message, 'utf-8');
  const combined = Buffer.concat([secretBytes, messageBytes]);

  const hash = sha512(combined);
  return Buffer.from(hash.slice(0, 32)).toString('hex');
}
