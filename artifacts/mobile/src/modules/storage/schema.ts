import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * Storage Module - Drizzle ORM SQLite Schema
 * Each table is independent and can be modified without affecting other modules
 */

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Ed25519 public key
  displayName: text('display_name').notNull(),
  avatarColor: text('avatar_color').notNull(),
  batteryLevel: integer('battery_level').default(100),
  isOnline: integer('is_online', { mode: 'boolean' }).default(false),
  lastSeen: integer('last_seen').notNull(), // Unix timestamp
  isTrusted: integer('is_trusted', { mode: 'boolean' }).default(false),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(), // UUID
  senderId: text('sender_id').notNull(), // References users.id
  recipientId: text('recipient_id'), // Null for group messages
  groupId: text('group_id'), // Null for direct messages
  type: text('type', { enum: ['text', 'image', 'voice', 'emergency'] }).notNull(),
  content: text('content').notNull(), // Encrypted ciphertext
  timestamp: integer('timestamp').notNull(), // Unix timestamp
  expiresAt: integer('expires_at').notNull(), // TTL-based expiration
  status: text('status', { enum: ['sending', 'sent', 'delivered', 'failed'] }).notNull().default('sending'),
  hops: integer('hops').default(0), // Relay count
  sequenceNumber: integer('sequence_number').notNull(), // Loop prevention
});

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  description: text('description'),
  creatorId: text('creator_id').notNull(), // References users.id
  createdAt: integer('created_at').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const groupMembers = sqliteTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  userId: text('user_id').notNull(),
  joinedAt: integer('joined_at').notNull(),
});

export const routingTable = sqliteTable('routing_table', {
  id: text('id').primaryKey(),
  destinationPubKey: text('destination_pub_key').notNull().unique(),
  nextHopPubKey: text('next_hop_pub_key').notNull(),
  cost: integer('cost').notNull(), // Hop count
  sequenceNumber: integer('sequence_number').notNull(),
  lastUpdated: integer('last_updated').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // "${localPubKey}:${remotePubKey}"
  localPublicKey: text('local_public_key').notNull(),
  remotePublicKey: text('remote_public_key').notNull(),
  rootKey: text('root_key').notNull(), // Base64 encoded
  chainKeyS: text('chain_key_s'), // Sender chain key
  chainKeyR: text('chain_key_r'), // Receiver chain key
  messageNumber: integer('message_number').default(0),
  previousChainLength: integer('previous_chain_length').default(0),
  createdAt: integer('created_at').notNull(),
});

export const skippedMessages = sqliteTable('skipped_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  chainKey: text('chain_key').notNull(),
  messageKey: text('message_key').notNull(),
  messageNumber: integer('message_number').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
