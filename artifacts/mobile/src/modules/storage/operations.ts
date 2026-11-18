/**
 * Storage Operations - SQLite Database Access Layer
 * Implements all CRUD operations for Phase 4 persistence
 * Uses expo-sqlite for React Native compatibility
 */

import { Platform } from 'react-native';

let SQLite: any = null;
let users: any, messages: any, groups: any, groupMembers: any, routingTable: any, sessions: any, skippedMessages: any;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line global-require
  SQLite = require('expo-sqlite');
  // eslint-disable-next-line global-require
  const schema = require('./schema');
  users = schema.users;
  messages = schema.messages;
  groups = schema.groups;
  groupMembers = schema.groupMembers;
  routingTable = schema.routingTable;
  sessions = schema.sessions;
  skippedMessages = schema.skippedMessages;
}

type Database = any;

// In-memory fallback for web
class WebStorageORM {
  private data: Map<string, any[]> = new Map();

  async init(): Promise<void> {
    console.log('[StorageORM] Using in-memory storage (web platform)');
  }

  async saveUser(id: string, name: string, color: string): Promise<void> {
    const users = this.data.get('users') || [];
    const existing = users.findIndex((u: any) => u.id === id);
    if (existing >= 0) users[existing] = { id, name, color };
    else users.push({ id, name, color });
    this.data.set('users', users);
  }

  async getUser(id: string): Promise<any> {
    const users = this.data.get('users') || [];
    return users.find((u: any) => u.id === id);
  }

  async getAllUsers(): Promise<any[]> {
    return this.data.get('users') || [];
  }

  async updateUserStatus(id: string, isOnline: boolean): Promise<void> {
    const users = this.data.get('users') || [];
    const user = users.find((u: any) => u.id === id);
    if (user) user.isOnline = isOnline;
  }

  async saveMessage(message: any): Promise<void> {
    const messages = this.data.get('messages') || [];
    messages.push({ ...message, createdAt: new Date() });
    this.data.set('messages', messages);
  }

  async getMessages(conversationId: string, limit?: number): Promise<any[]> {
    const messages = (this.data.get('messages') || []).filter(
      (m: any) => m.conversationId === conversationId
    );
    return limit ? messages.slice(-limit) : messages;
  }

  async markMessageAsDelivered(messageId: string): Promise<void> {
    const messages = this.data.get('messages') || [];
    const msg = messages.find((m: any) => m.id === messageId);
    if (msg) msg.isDelivered = true;
  }

  async deleteExpiredMessages(): Promise<number> {
    const messages = this.data.get('messages') || [];
    const before = messages.length;
    const oneHourAgo = new Date(Date.now() - 3600000);
    const filtered = messages.filter((m: any) => m.createdAt > oneHourAgo);
    this.data.set('messages', filtered);
    return before - filtered.length;
  }

  async createGroup(name: string, creatorId: string): Promise<string> {
    const groups = this.data.get('groups') || [];
    const id = `group-${Date.now()}`;
    groups.push({ id, name, creatorId });
    this.data.set('groups', groups);
    return id;
  }

  async getGroup(groupId: string): Promise<any> {
    const groups = this.data.get('groups') || [];
    return groups.find((g: any) => g.id === groupId);
  }

  async addMemberToGroup(groupId: string, userId: string): Promise<void> {
    const members = this.data.get('groupMembers') || [];
    members.push({ groupId, userId });
    this.data.set('groupMembers', members);
  }

  async updateRoute(destination: string, nextHop: string, cost: number): Promise<void> {
    const routes = this.data.get('routingTable') || [];
    const existing = routes.findIndex((r: any) => r.destination === destination);
    if (existing >= 0) routes[existing] = { destination, nextHop, cost };
    else routes.push({ destination, nextHop, cost });
    this.data.set('routingTable', routes);
  }

  async getRoute(destination: string): Promise<any> {
    const routes = this.data.get('routingTable') || [];
    return routes.find((r: any) => r.destination === destination);
  }

  async getAllRoutes(): Promise<any[]> {
    return this.data.get('routingTable') || [];
  }

  async saveSession(key: string, value: string): Promise<void> {
    const sessions = this.data.get('sessions') || [];
    const existing = sessions.findIndex((s: any) => s.key === key);
    if (existing >= 0) sessions[existing] = { key, value };
    else sessions.push({ key, value });
    this.data.set('sessions', sessions);
  }

  async getSession(key: string): Promise<any> {
    const sessions = this.data.get('sessions') || [];
    const session = sessions.find((s: any) => s.key === key);
    return session?.value;
  }

  async deleteSession(key: string): Promise<void> {
    const sessions = this.data.get('sessions') || [];
    const index = sessions.findIndex((s: any) => s.key === key);
    if (index >= 0) sessions.splice(index, 1);
  }

  async saveSkippedKey(senderKey: string, chainKey: string, counter: number): Promise<void> {
    const skipped = this.data.get('skippedMessages') || [];
    skipped.push({ senderKey, chainKey, counter });
    this.data.set('skippedMessages', skipped);
  }

  async getSkippedKey(senderKey: string, counter: number): Promise<any> {
    const skipped = this.data.get('skippedMessages') || [];
    return skipped.find((s: any) => s.senderKey === senderKey && s.counter === counter);
  }

  async deleteSkippedKey(senderKey: string, counter: number): Promise<void> {
    const skipped = this.data.get('skippedMessages') || [];
    const index = skipped.findIndex((s: any) => s.senderKey === senderKey && s.counter === counter);
    if (index >= 0) skipped.splice(index, 1);
  }
}

export class StorageORM {
  private db: Database | null = null;

  async init(): Promise<void> {
    console.log('[StorageORM] Initializing SQLite database');

    try {
      // Open or create database
      this.db = await SQLite.openDatabaseAsync('mesh-protocol.db');

      // Enable foreign keys
      await this.db.execAsync('PRAGMA foreign_keys = ON;');

      // Create tables
      await this._createTables();

      console.log('[StorageORM] Database initialized successfully');
    } catch (err) {
      console.error('[StorageORM] Failed to initialize database:', err);
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      console.log('[StorageORM] Database closed');
    }
  }

  // =============================================================================
  // User Operations
  // =============================================================================

  async saveUser(
    publicKey: string,
    displayName: string,
    avatarColor: string,
    isTrusted: boolean = false
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `
        INSERT OR REPLACE INTO users (publicKey, displayName, avatarColor, isTrusted, isOnline, lastSeen)
        VALUES (?, ?, ?, ?, 1, ?)
        `,
        [publicKey, displayName, avatarColor, isTrusted ? 1 : 0, Date.now()]
      );
    } catch (err) {
      console.error('[StorageORM] Failed to save user:', err);
      throw err;
    }
  }

  async getUser(publicKey: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM users WHERE publicKey = ?',
        [publicKey]
      );
      return result || null;
    } catch (err) {
      console.error('[StorageORM] Failed to get user:', err);
      throw err;
    }
  }

  async getAllUsers(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const results = await this.db.getAllAsync('SELECT * FROM users ORDER BY lastSeen DESC');
      return results || [];
    } catch (err) {
      console.error('[StorageORM] Failed to get all users:', err);
      throw err;
    }
  }

  async updateUserStatus(publicKey: string, isOnline: boolean): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE users SET isOnline = ?, lastSeen = ? WHERE publicKey = ?',
        [isOnline ? 1 : 0, Date.now(), publicKey]
      );
    } catch (err) {
      console.error('[StorageORM] Failed to update user status:', err);
      throw err;
    }
  }

  // =============================================================================
  // Message Operations
  // =============================================================================

  async saveMessage(message: {
    id: string;
    senderId: string;
    recipientId?: string;
    groupId?: string;
    type: 'text' | 'voice' | 'broadcast';
    content: string;
    timestamp: number;
    expiresAt: number;
    status: 'pending' | 'sent' | 'delivered' | 'read';
    hops: number;
    sequenceNumber: number;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `
        INSERT OR REPLACE INTO messages 
        (id, senderId, recipientId, groupId, type, content, timestamp, expiresAt, status, hops, sequenceNumber)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          message.id,
          message.senderId,
          message.recipientId || null,
          message.groupId || null,
          message.type,
          message.content,
          message.timestamp,
          message.expiresAt,
          message.status,
          message.hops,
          message.sequenceNumber,
        ]
      );
    } catch (err) {
      console.error('[StorageORM] Failed to save message:', err);
      throw err;
    }
  }

  async getMessages(recipientId?: string, groupId?: string, limit: number = 100): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      let query = 'SELECT * FROM messages WHERE 1=1';
      const params: any[] = [];

      if (recipientId) {
        query += ' AND (recipientId = ? OR senderId = ?)';
        params.push(recipientId, recipientId);
      }

      if (groupId) {
        query += ' AND groupId = ?';
        params.push(groupId);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const results = await this.db.getAllAsync(query, params);
      return results || [];
    } catch (err) {
      console.error('[StorageORM] Failed to get messages:', err);
      throw err;
    }
  }

  async markMessageAsDelivered(messageId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE messages SET status = ? WHERE id = ?',
        ['delivered', messageId]
      );
    } catch (err) {
      console.error('[StorageORM] Failed to mark message as delivered:', err);
      throw err;
    }
  }

  async deleteExpiredMessages(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.runAsync(
        'DELETE FROM messages WHERE expiresAt < ?',
        [Date.now()]
      );
      return result.changes || 0;
    } catch (err) {
      console.error('[StorageORM] Failed to delete expired messages:', err);
      throw err;
    }
  }

  // =============================================================================
  // Group Operations
  // =============================================================================

  async createGroup(groupId: string, groupName: string, creatorId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO groups (id, name, creatorId, createdAt) VALUES (?, ?, ?, ?)',
        [groupId, groupName, creatorId, Date.now()]
      );
    } catch (err) {
      console.error('[StorageORM] Failed to create group:', err);
      throw err;
    }
  }

  async addMemberToGroup(groupId: string, memberId: string, role: string = 'member'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO groupMembers (groupId, memberId, role, joinedAt) VALUES (?, ?, ?, ?)',
        [groupId, memberId, role, Date.now()]
      );
    } catch (err) {
      console.error('[StorageORM] Failed to add member to group:', err);
      throw err;
    }
  }

  async getGroupMembers(groupId: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const results = await this.db.getAllAsync(
        'SELECT * FROM groupMembers WHERE groupId = ? ORDER BY joinedAt ASC',
        [groupId]
      );
      return results || [];
    } catch (err) {
      console.error('[StorageORM] Failed to get group members:', err);
      throw err;
    }
  }

  // =============================================================================
  // Routing Operations
  // =============================================================================

  async updateRoute(
    destinationPubKey: string,
    nextHopPubKey: string,
    cost: number,
    sequenceNumber: number = 0
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `
        INSERT OR REPLACE INTO routingTable 
        (destinationPubKey, nextHopPubKey, cost, sequenceNumber, lastUpdated)
        VALUES (?, ?, ?, ?, ?)
        `,
        [destinationPubKey, nextHopPubKey, cost, sequenceNumber, Date.now()]
      );
    } catch (err) {
      console.error('[StorageORM] Failed to update route:', err);
      throw err;
    }
  }

  async getRoute(destinationPubKey: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM routingTable WHERE destinationPubKey = ?',
        [destinationPubKey]
      );
      return result || null;
    } catch (err) {
      console.error('[StorageORM] Failed to get route:', err);
      throw err;
    }
  }

  async getAllRoutes(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const results = await this.db.getAllAsync(
        'SELECT * FROM routingTable ORDER BY cost ASC'
      );
      return results || [];
    } catch (err) {
      console.error('[StorageORM] Failed to get all routes:', err);
      throw err;
    }
  }

  // =============================================================================
  // Session Operations (Double Ratchet)
  // =============================================================================

  async saveSession(remotePublicKey: string, state: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `
        INSERT OR REPLACE INTO sessions 
        (remotePublicKey, rootKey, sendCounter, recvCounter, lastUpdated)
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          remotePublicKey,
          JSON.stringify(state),
          state.sendCounter || 0,
          state.recvCounter || 0,
          Date.now(),
        ]
      );
    } catch (err) {
      console.error('[StorageORM] Failed to save session:', err);
      throw err;
    }
  }

  async getSession(remotePublicKey: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM sessions WHERE remotePublicKey = ?',
        [remotePublicKey]
      );

      if (result && result.rootKey) {
        // Parse the stored state
        return JSON.parse(result.rootKey);
      }

      return null;
    } catch (err) {
      console.error('[StorageORM] Failed to get session:', err);
      throw err;
    }
  }

  // =============================================================================
  // Skipped Message Keys Operations
  // =============================================================================

  async saveSkippedMessage(
    remotePublicKey: string,
    messageNumber: number,
    messageKey: string
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `
        INSERT OR REPLACE INTO skippedMessages 
        (remotePublicKey, messageNumber, messageKey, savedAt)
        VALUES (?, ?, ?, ?)
        `,
        [remotePublicKey, messageNumber, messageKey, Date.now()]
      );
    } catch (err) {
      console.error('[StorageORM] Failed to save skipped message:', err);
      throw err;
    }
  }

  async getSkippedMessage(remotePublicKey: string, messageNumber: number): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM skippedMessages WHERE remotePublicKey = ? AND messageNumber = ?',
        [remotePublicKey, messageNumber]
      );
      return result || null;
    } catch (err) {
      console.error('[StorageORM] Failed to get skipped message:', err);
      throw err;
    }
  }

  async deleteOldSkippedMessages(olderThan: number = 86400000): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.runAsync(
        'DELETE FROM skippedMessages WHERE savedAt < ?',
        [Date.now() - olderThan]
      );
      return result.changes || 0;
    } catch (err) {
      console.error('[StorageORM] Failed to delete old skipped messages:', err);
      throw err;
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private async _createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        publicKey TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        avatarColor TEXT,
        isTrusted INTEGER DEFAULT 0,
        isOnline INTEGER DEFAULT 0,
        batteryLevel REAL DEFAULT 100,
        lastSeen INTEGER DEFAULT 0,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );
    `;

    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        senderId TEXT NOT NULL,
        recipientId TEXT,
        groupId TEXT,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        expiresAt INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        hops INTEGER DEFAULT 0,
        sequenceNumber INTEGER DEFAULT 0,
        FOREIGN KEY (senderId) REFERENCES users(publicKey),
        FOREIGN KEY (recipientId) REFERENCES users(publicKey),
        FOREIGN KEY (groupId) REFERENCES groups(id)
      );
    `;

    const createGroupsTable = `
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        creatorId TEXT NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (creatorId) REFERENCES users(publicKey)
      );
    `;

    const createGroupMembersTable = `
      CREATE TABLE IF NOT EXISTS groupMembers (
        groupId TEXT,
        memberId TEXT,
        role TEXT DEFAULT 'member',
        joinedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        PRIMARY KEY (groupId, memberId),
        FOREIGN KEY (groupId) REFERENCES groups(id),
        FOREIGN KEY (memberId) REFERENCES users(publicKey)
      );
    `;

    const createRoutingTableTable = `
      CREATE TABLE IF NOT EXISTS routingTable (
        destinationPubKey TEXT PRIMARY KEY,
        nextHopPubKey TEXT NOT NULL,
        cost INTEGER NOT NULL,
        sequenceNumber INTEGER DEFAULT 0,
        lastUpdated INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (nextHopPubKey) REFERENCES users(publicKey)
      );
    `;

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
        remotePublicKey TEXT PRIMARY KEY,
        rootKey TEXT NOT NULL,
        sendCounter INTEGER DEFAULT 0,
        recvCounter INTEGER DEFAULT 0,
        lastUpdated INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (remotePublicKey) REFERENCES users(publicKey)
      );
    `;

    const createSkippedMessagesTable = `
      CREATE TABLE IF NOT EXISTS skippedMessages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        remotePublicKey TEXT NOT NULL,
        messageNumber INTEGER NOT NULL,
        messageKey TEXT NOT NULL,
        savedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE (remotePublicKey, messageNumber),
        FOREIGN KEY (remotePublicKey) REFERENCES users(publicKey)
      );
    `;

    try {
      await this.db.execAsync(
        createUsersTable +
          createMessagesTable +
          createGroupsTable +
          createGroupMembersTable +
          createRoutingTableTable +
          createSessionsTable +
          createSkippedMessagesTable
      );
      console.log('[StorageORM] All tables created successfully');
    } catch (err) {
      console.error('[StorageORM] Failed to create tables:', err);
      throw err;
    }
  }
}

// Singleton instance - use appropriate ORM based on platform
export const orm = Platform.OS === 'web' ? new WebStorageORM() : new StorageORM();
